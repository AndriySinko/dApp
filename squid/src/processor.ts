import { EvmBatchProcessor } from "@subsquid/evm-processor";
import { TypeormDatabase }   from "@subsquid/typeorm-store";
import { In }                from "typeorm";
import { AbiCoder }          from "ethers";
import {
  Challenge, Bet, Participant, ReputationUpdate, UserReputation,
  EpochResult, FactoryActivity, ChallengeType, VerifierType, ChallengeState,
} from "./model";

// ─── Contract addresses ───────────────────────────────────────────────────────

const FACTORY_ADDRESS    = (process.env.FACTORY_ADDRESS    ?? "").toLowerCase();
const GOVERNANCE_ADDRESS = (process.env.GOVERNANCE_ADDRESS ?? "").toLowerCase();
const REPUTATION_ADDRESS = (process.env.REPUTATION_ADDRESS ?? "").toLowerCase();

// ─── Event topic hashes ───────────────────────────────────────────────────────
// Computed with ethers.id("EventSignature(argTypes,...)")

const topics = {
  // ChallengeFactory
  ChallengeCreated:      "0x2fa381b737cb2ed8e147ed6e89390a918233415b46266bac00dde7788861744e",
  UserActivity:          "0xbe19fc88fea9f53d45ce85c97a62653084a0fac09e0bc700f45ec3bd56f0b37e",
  // IndividualChallenge
  BetPlaced:             "0x70708ffef32a269391cf159a2d374eef6bbc3e9cea3c61f26955ca3738edf30d",
  // BaseChallenge (all challenge types)
  ParticipantRegistered: "0xfca29daec726c7d646604120b61c11d199d0ac57b2463299c0560d2762d730f9",
  StateChanged:          "0x6248a7c8a8dfdcb56514416ad7ed5cf43c516b01ebe5ec4716e35ea71e3ecf64",
  Settled:               "0xa973b04048409154dba42dd56f3d2787fcfae851d65aa083ef6231bf57e53669",
  ParticipantSettled:    "0x24baaee6ad398315a69362fc0cc0779713765dc947bf8d6b4abac1d1772619c7",
  // Reputation
  ReputationUpdated:     "0xd77216bfd8cf52571fb0485ce5047e22a8dfdf3685588fc64fa34fd916c3103e",
  // PublicGovernance
  EpochTicked:           "0x0a4672bd1ad7ceaa47c381ec9b9c37e38943701034554bc9a9ed3aa605273d88",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const abiCoder = AbiCoder.defaultAbiCoder();

function addrFromTopic(topic: string): string {
  return "0x" + topic.slice(-40).toLowerCase();
}

const CHALLENGE_TYPE_MAP: Record<number, ChallengeType> = {
  0: ChallengeType.INDIVIDUAL,
  1: ChallengeType.GROUP,
  2: ChallengeType.PUBLIC,
};
const VERIFIER_MAP: Record<number, VerifierType> = {
  0: VerifierType.ON_CHAIN,
  1: VerifierType.API_ORACLE,
  2: VerifierType.AI_ORACLE,
};
const STATE_MAP: Record<number, ChallengeState> = {
  0: ChallengeState.JOIN_OPEN,
  1: ChallengeState.ACTIVE,
  2: ChallengeState.VERIFY_PENDING,
  3: ChallengeState.SETTLED,
};
const ACTIVITY_MAP: Record<number, string> = {
  0: "Created", 1: "Joined", 2: "BetFor", 3: "BetAgainst", 4: "Settled",
};

// ─── Processor setup ──────────────────────────────────────────────────────────

const processor = new EvmBatchProcessor()
  .setGateway("https://v2.archive.subsquid.io/network/ethereum-sepolia")
  .setRpcEndpoint({ url: process.env.SEPOLIA_RPC_URL ?? "", rateLimit: 10 })
  .setFinalityConfirmation(75)
  .setFields({ log: { transactionHash: true } })
  // Factory: ChallengeCreated + UserActivity
  .addLog({
    address: [FACTORY_ADDRESS],
    topic0:  [topics.ChallengeCreated, topics.UserActivity],
  })
  // Any address: challenge-level events (filtered to known challenges in handler)
  .addLog({
    topic0: [
      topics.BetPlaced,
      topics.ParticipantRegistered,
      topics.StateChanged,
      topics.Settled,
      topics.ParticipantSettled,
    ],
  })
  // Reputation contract
  .addLog({
    address: [REPUTATION_ADDRESS],
    topic0:  [topics.ReputationUpdated],
  })
  // Governance contract
  .addLog({
    address: [GOVERNANCE_ADDRESS],
    topic0:  [topics.EpochTicked],
  })
  .setBlockRange({ from: Number(process.env.START_BLOCK ?? 0) });

// ─── Batch handler ────────────────────────────────────────────────────────────

processor.run(new TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
  // Pass 1: collect addresses of challenge contracts this batch references,
  //         so we can load them from DB once (batch read instead of per-event reads).
  const challengeAddrsNeeded    = new Set<string>();
  const participantKeysNeeded   = new Set<string>();

  for (const block of ctx.blocks) {
    for (const log of block.logs) {
      const a = log.address.toLowerCase();
      const t = log.topics[0];

      // Discover new challenge addresses from ChallengeCreated
      if (a === FACTORY_ADDRESS && t === topics.ChallengeCreated) {
        challengeAddrsNeeded.add(addrFromTopic(log.topics[2]));
      }

      // Challenge-level events from unknown (potentially challenge) addresses
      if (a !== FACTORY_ADDRESS && a !== GOVERNANCE_ADDRESS && a !== REPUTATION_ADDRESS) {
        if ([topics.BetPlaced, topics.ParticipantRegistered, topics.StateChanged,
             topics.Settled, topics.ParticipantSettled].includes(t)) {
          challengeAddrsNeeded.add(a);
        }
        if (t === topics.ParticipantSettled) {
          participantKeysNeeded.add(`${a}-${addrFromTopic(log.topics[1])}`);
        }
        if (t === topics.ParticipantRegistered) {
          participantKeysNeeded.add(`${a}-${addrFromTopic(log.topics[1])}`);
        }
      }
    }
  }

  // Load existing entities from DB
  const existingChallenges = challengeAddrsNeeded.size > 0
    ? await ctx.store.findBy(Challenge, { id: In([...challengeAddrsNeeded]) })
    : [];
  const existingParticipants = participantKeysNeeded.size > 0
    ? await ctx.store.findBy(Participant, { id: In([...participantKeysNeeded]) })
    : [];

  const challenges   = new Map<string, Challenge>(existingChallenges.map(c => [c.id, c]));
  const participants = new Map<string, Participant>(existingParticipants.map(p => [p.id, p]));
  const bets:        Bet[]              = [];
  const repUpdates:  ReputationUpdate[] = [];
  const userReps     = new Map<string, UserReputation>();
  const epochResults: EpochResult[]    = [];
  const activities:  FactoryActivity[] = [];

  // Pass 2: process all events
  for (const block of ctx.blocks) {
    const ts = new Date(block.header.timestamp);

    for (const log of block.logs) {
      const a  = log.address.toLowerCase();
      const t  = log.topics[0];
      const tx = log.transactionHash;
      const li = log.logIndex;

      // ── ChallengeFactory events ──────────────────────────────────────────
      if (a === FACTORY_ADDRESS) {
        if (t === topics.ChallengeCreated) {
          const challengeId    = BigInt(log.topics[1]);
          const contractAddr   = addrFromTopic(log.topics[2]);
          const creator        = addrFromTopic(log.topics[3]);

          const [typeNum, verifierNum, title, criteria, buyIn, joinDeadline, challengeDeadline] =
            abiCoder.decode(
              ["uint8", "uint8", "string", "string", "uint256", "uint256", "uint256"],
              log.data,
            );

          const c = challenges.get(contractAddr) ?? new Challenge({ id: contractAddr });
          c.challengeId       = challengeId;
          c.type              = CHALLENGE_TYPE_MAP[Number(typeNum)];
          c.verifier          = VERIFIER_MAP[Number(verifierNum)];
          c.state             = ChallengeState.JOIN_OPEN;
          c.creator           = creator;
          c.title             = title as string;
          c.criteria          = criteria as string;
          c.buyIn             = BigInt(buyIn as bigint);
          c.joinDeadline      = BigInt(joinDeadline as bigint);
          c.challengeDeadline = BigInt(challengeDeadline as bigint);
          c.createdAt         = ts;
          c.createdTxHash     = tx;
          c.forPool           = c.forPool    ?? 0n;
          c.againstPool       = c.againstPool ?? 0n;
          c.bettorsFor        = c.bettorsFor  ?? 0;
          c.bettorsAgainst    = c.bettorsAgainst ?? 0;
          challenges.set(contractAddr, c);
          challengeAddrsNeeded.add(contractAddr);

          ctx.log.info(`ChallengeCreated: ${contractAddr} "${title as string}"`);

        } else if (t === topics.UserActivity) {
          const user             = addrFromTopic(log.topics[1]);
          const challengeAddress = addrFromTopic(log.topics[2]);
          const [actTypeNum, amount] = abiCoder.decode(["uint8", "uint256"], log.data);

          const act       = new FactoryActivity({ id: `${tx}-${li}` });
          act.user        = user;
          act.challenge   = challengeAddress;
          act.activityType = ACTIVITY_MAP[Number(actTypeNum)] ?? "Unknown";
          act.amount      = BigInt(amount as bigint);
          act.timestamp   = ts;
          act.txHash      = tx;
          activities.push(act);
        }
        continue;
      }

      // ── Reputation events ────────────────────────────────────────────────
      if (a === REPUTATION_ADDRESS && t === topics.ReputationUpdated) {
        const user      = addrFromTopic(log.topics[1]);
        const challenge = addrFromTopic(log.topics[2]);
        const [delta, newScore] = abiCoder.decode(["int256", "int256", "uint256"], log.data);

        const ru       = new ReputationUpdate({ id: `${tx}-${li}` });
        ru.user        = user;
        ru.delta       = BigInt(delta as bigint);
        ru.newScore    = BigInt(newScore as bigint);
        ru.challenge   = challenge;
        ru.timestamp   = ts;
        repUpdates.push(ru);

        const ur      = userReps.get(user) ?? new UserReputation({ id: user });
        ur.score      = BigInt(newScore as bigint);
        ur.lastUpdated = ts;
        userReps.set(user, ur);
        continue;
      }

      // ── Governance events ────────────────────────────────────────────────
      if (a === GOVERNANCE_ADDRESS && t === topics.EpochTicked) {
        const [epoch, , winningTitle, publicChallengeAddress, prizePool] =
          abiCoder.decode(
            ["uint256", "uint256", "string", "address", "uint256"],
            log.data,
          );

        const er                        = new EpochResult({ id: BigInt(epoch as bigint).toString() });
        er.epoch                        = BigInt(epoch as bigint);
        er.winningTitle                 = winningTitle as string;
        er.publicChallengeAddress       = (publicChallengeAddress as string).toLowerCase();
        er.prizePool                    = BigInt(prizePool as bigint);
        er.timestamp                    = ts;
        epochResults.push(er);
        continue;
      }

      // ── Challenge-level events ───────────────────────────────────────────
      // Only process if this address is a known challenge contract
      const c = challenges.get(a);
      if (!c) continue;

      if (t === topics.BetPlaced) {
        const bettor = addrFromTopic(log.topics[1]);
        const [side, amount, newForPool, newAgainstPool] =
          abiCoder.decode(["bool", "uint256", "uint256", "uint256", "uint256"], log.data);

        const bet      = new Bet({ id: `${tx}-${li}` });
        bet.challenge  = c;
        bet.bettor     = bettor;
        bet.side       = Boolean(side);
        bet.amount     = BigInt(amount as bigint);
        bet.timestamp  = ts;
        bet.txHash     = tx;
        bets.push(bet);

        c.forPool     = BigInt(newForPool as bigint);
        c.againstPool = BigInt(newAgainstPool as bigint);
        if (Boolean(side)) c.bettorsFor     = (c.bettorsFor     ?? 0) + 1;
        else               c.bettorsAgainst = (c.bettorsAgainst ?? 0) + 1;

      } else if (t === topics.ParticipantRegistered) {
        const participant = addrFromTopic(log.topics[1]);
        const [stake]     = abiCoder.decode(["uint256", "uint256"], log.data);
        const key         = `${a}-${participant}`;

        const p           = participants.get(key) ?? new Participant({ id: key });
        p.challenge       = c;
        p.participant     = participant;
        p.stake           = BigInt(stake as bigint);
        p.joinedAt        = ts;
        participants.set(key, p);

        // For Group/Public, bettorsFor tracks participant count (no BetPlaced events)
        if (c.type !== ChallengeType.INDIVIDUAL) {
          c.bettorsFor = (c.bettorsFor ?? 0) + 1;
        }

      } else if (t === topics.StateChanged) {
        const [, toNum] = abiCoder.decode(["uint8", "uint8", "uint256"], log.data);
        const newState  = STATE_MAP[Number(toNum)];
        if (newState) c.state = newState;

      } else if (t === topics.Settled) {
        c.state = ChallengeState.SETTLED;

      } else if (t === topics.ParticipantSettled) {
        const participant = addrFromTopic(log.topics[1]);
        const [won, payout, pnl] = abiCoder.decode(["bool", "uint256", "int256"], log.data);
        const key = `${a}-${participant}`;

        const p       = participants.get(key) ?? new Participant({ id: key });
        p.challenge   = c;
        p.participant = participant;
        p.verdict     = Boolean(won);
        p.payout      = BigInt(payout as bigint);
        p.pnl         = BigInt(pnl as bigint);
        if (!p.stake)    p.stake    = 0n;
        if (!p.joinedAt) p.joinedAt = ts;
        participants.set(key, p);
      }
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  // Challenges must be saved before Bets/Participants (FK constraint)
  await ctx.store.upsert([...challenges.values()]);
  await ctx.store.upsert(bets);
  await ctx.store.upsert([...participants.values()]);
  await ctx.store.upsert(repUpdates);
  await ctx.store.upsert([...userReps.values()]);
  await ctx.store.upsert(epochResults);
  await ctx.store.upsert(activities);
});
