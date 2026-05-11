"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { formatEther } from "viem";
import { Donut, Sparkline } from "@/components/ui";
import { BetPanel } from "@/components/BetPanel";
import { StateIndicator } from "@/components/StateIndicator";
import { WithdrawCard, BindAccountCard, SettleFallback } from "@/components/ActionCards";
import { VERIFIER_ICON, VERIFIER_LABEL, TYPE_LABEL, pct, formatEth, timeLeft, multiplier } from "@/lib/utils";
import { ADDRESSES, FACTORY_ABI } from "@/lib/contracts";
import { CHALLENGE_TYPE_FROM_NUM, VERIFIER_TYPE_FROM_NUM, type Challenge, type ChallengeType, type ChallengeState, type VerifierType } from "@/lib/types";
import { useChallenge } from "@/lib/hooks/useChallenge";

type ChainData = {
  state?: ChallengeState;
  joinDeadline?: bigint;
  challengeDeadline?: bigint;
  buyIn?: bigint;
  participantCount?: number;
  forPool?: bigint;
  againstPool?: bigint;
  bettorsFor?: bigint;
  bettorsAgainst?: bigint;
  isRegistered?: boolean;
  userPending?: bigint;
  creator?: `0x${string}`;
  isLoading: boolean;
};

type Tab = "Market" | "Details" | "Verifier" | "On-chain";
const TABS: Tab[] = ["Market", "Details", "Verifier", "On-chain"];

type RawChallengeInfo = {
  id: bigint;
  challengeType: number;
  verifier: number;
  creator: `0x${string}`;
  title: string;
};

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { address: userAddress } = useAccount();
  const [tab, setTab] = useState<Tab>("Market");

  const challengeAddress = id as `0x${string}`;

  const { data: infoRaw } = useReadContract({
    address: ADDRESSES.factory,
    abi: FACTORY_ABI,
    functionName: "getChallengeInfo",
    args: [challengeAddress],
    query: { enabled: !!challengeAddress },
  });

  const info = infoRaw as RawChallengeInfo | undefined;
  const challengeType: ChallengeType = info ? CHALLENGE_TYPE_FROM_NUM[info.challengeType] : "INDIVIDUAL";
  const verifierType: VerifierType   = info ? VERIFIER_TYPE_FROM_NUM[info.verifier]       : "ON_CHAIN";
  const creatorAddress                = info?.creator ?? challengeAddress;
  const title                         = info?.title   ?? "Loading…";

  const chainData = useChallenge(challengeAddress, challengeType, userAddress as `0x${string}` | undefined) as ChainData;

  const { data: verdictsData } = useReadContract({
    address: challengeAddress,
    abi: [
      { type: "function", name: "verdictsCompleted", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
      { type: "function", name: "verdictsExpected",  inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
    ] as const,
    functionName: "verdictsCompleted",
    query: { enabled: !!challengeAddress && chainData.state === "VERIFY_PENDING" },
  });
  const { data: verdictsExpected } = useReadContract({
    address: challengeAddress,
    abi: [{ type: "function", name: "verdictsExpected", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }] as const,
    functionName: "verdictsExpected",
    query: { enabled: !!challengeAddress && chainData.state === "VERIFY_PENDING" },
  });
  const allVerdictsIn = verdictsData !== undefined && verdictsExpected !== undefined && (verdictsData as bigint) >= (verdictsExpected as bigint) && (verdictsExpected as bigint) > BigInt(0);

  const isCreator = userAddress && chainData.creator && userAddress.toLowerCase() === chainData.creator.toLowerCase();
  const showBindAccount = verifierType === "API_ORACLE" && chainData.state === "JOIN_OPEN" && chainData.isRegistered &&
    (challengeType !== "INDIVIDUAL" || isCreator);
  const showSettle = chainData.state === "VERIFY_PENDING" && allVerdictsIn;
  const showWithdraw = chainData.state === "SETTLED" && chainData.userPending !== undefined && chainData.userPending > BigInt(0);

  const forPool    = chainData.forPool     ? parseFloat(formatEther(chainData.forPool))     : 0;
  const againstPool = chainData.againstPool ? parseFloat(formatEther(chainData.againstPool)) : 0;
  const buyIn       = chainData.buyIn       ? parseFloat(formatEther(chainData.buyIn))       : 0;
  const total       = forPool + againstPool + buyIn;
  const forP        = pct(forPool, againstPool);
  const agP         = 100 - forP;

  const challenge: Challenge = {
    id:               challengeAddress,
    address:          challengeAddress,
    title,
    type:             challengeType,
    verifier:         verifierType,
    state:            chainData.state ?? "JOIN_OPEN",
    creator:          `${creatorAddress.slice(0, 6)}…${creatorAddress.slice(-4)}`,
    creatorAddress,
    buyIn,
    joinDeadline:     chainData.joinDeadline      ? new Date(Number(chainData.joinDeadline)      * 1000) : new Date(),
    challengeDeadline: chainData.challengeDeadline ? new Date(Number(chainData.challengeDeadline) * 1000) : new Date(),
    forPool:          forPool     || undefined,
    againstPool:      againstPool || undefined,
    bettorsFor:       chainData.bettorsFor     ? Number(chainData.bettorsFor)     : 0,
    bettorsAgainst:   chainData.bettorsAgainst ? Number(chainData.bettorsAgainst) : 0,
    participants:     chainData.participantCount,
  };

  return (
    <div className="container-wide fade-in" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <div className="row gap-2 muted" style={{ fontSize: 12, marginBottom: 24, fontFamily: "var(--f-mono)" }}>
        <Link href="/dashboard" className="dim">← challenges</Link>
        <span className="dim">/</span>
        <span>{challenge.id}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div className="row gap-2" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <span className="tag">{TYPE_LABEL[challenge.type]}</span>
            <span className="tag" style={{ color: "var(--text-2)" }}>
              <span style={{ color: "var(--acc)" }}>{VERIFIER_ICON[challenge.verifier]}</span>{" "}
              {VERIFIER_LABEL[challenge.verifier]}
            </span>
            <StateIndicator state={challenge.state} />
            <span className="tag">{challenge.id}</span>
          </div>
          <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 16 }}>
            {challenge.title}
          </h1>
          {showSettle && (
            <div style={{ marginBottom: 16 }}>
              <SettleFallback challengeAddress={challengeAddress} />
            </div>
          )}
          <div className="row gap-3" style={{ fontSize: 13 }}>
            <span className="avatar sm" />
            <span>by <span style={{ color: "var(--text)" }}>{challenge.creator}</span></span>
            <span className="dim">·</span>
            <span className="chip">{challenge.creatorAddress.slice(0, 6)}...{challenge.creatorAddress.slice(-4)}</span>
            <span className="dim">·</span>
            <span className="muted">{timeLeft(challenge.challengeDeadline)}</span>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn sm">⌥ share</button>
          <button className="btn sm">↗ Etherscan</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        <div className="col gap-4">
          <div className="card" style={{ padding: 28 }}>
            <div className="row gap-6" style={{ alignItems: "center", marginBottom: 24 }}>
              <Donut pct={forP} color="var(--win)" size={120} stroke={12} />
              <div className="col gap-2 flex-1">
                <div className="eyebrow">Implied probability of success</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span className="serif" style={{ fontSize: 80, lineHeight: 1, color: "var(--win)" }}>{forP}%</span>
                  <span className="muted">FOR</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {challenge.bettorsFor ?? 0} bettors backing · {challenge.bettorsAgainst ?? 0} fading
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden", minWidth: 280 }}>
                <div style={{ padding: 14, background: "var(--bg)" }}>
                  <div className="eyebrow" style={{ color: "var(--win)" }}>FOR</div>
                  <div className="num-lg" style={{ marginTop: 4 }}>{formatEth(forPool)}</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{multiplier(forPool, total)} payout</div>
                </div>
                <div style={{ padding: 14, background: "var(--bg)" }}>
                  <div className="eyebrow" style={{ color: "var(--loss)" }}>AGAINST</div>
                  <div className="num-lg" style={{ marginTop: 4 }}>{formatEth(againstPool)}</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{multiplier(againstPool, total)} payout</div>
                </div>
              </div>
            </div>
            <div className="bar split">
              <div className="for" style={{ width: `${forP}%` }} />
              <div className="against" style={{ width: `${agP}%` }} />
            </div>
          </div>

          <div className="row gap-6" style={{ borderBottom: "1px solid var(--line-soft)" }}>
            {TABS.map(t => (
              <button
                key={t}
                style={{
                  padding: "12px 0", fontSize: 13, fontWeight: 500, marginBottom: -1,
                  borderBottom: tab === t ? "1px solid var(--text)" : "1px solid transparent",
                  color: tab === t ? "var(--text)" : "var(--text-3)",
                }}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Market" && (
            <div className="col gap-4">
              <div className="card" style={{ padding: 24 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <div className="eyebrow">FOR probability · 24h</div>
                </div>
                <div style={{ height: 220 }}>
                  <Sparkline points={[]} color="var(--win)" />
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
                  <div className="eyebrow">Recent bets</div>
                </div>
                <div style={{ padding: "24px 20px", color: "var(--text-4)", fontSize: 13, fontFamily: "var(--f-mono)" }}>
                  Bet history available after Subsquid indexer is deployed.
                </div>
              </div>
            </div>
          )}

          {tab === "Details" && (
            <div className="card" style={{ padding: 28 }}>
              <div className="col gap-4">
                <div className="field">
                  <label>Description</label>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-2)", marginTop: 4 }}>{challenge.description}</p>
                </div>
                <div className="divider" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="col gap-2"><div className="eyebrow">Buy-in</div><div className="num-lg">{formatEth(challenge.buyIn)}</div></div>
                  <div className="col gap-2"><div className="eyebrow">Join deadline</div><div className="num" style={{ fontSize: 14 }}>{challenge.joinDeadline.toUTCString().slice(0, 22)}</div></div>
                  <div className="col gap-2"><div className="eyebrow">Challenge deadline</div><div className="num" style={{ fontSize: 14 }}>{challenge.challengeDeadline.toUTCString().slice(0, 22)}</div></div>
                  <div className="col gap-2"><div className="eyebrow">Type</div><span className="tag">{TYPE_LABEL[challenge.type]}</span></div>
                  <div className="col gap-2"><div className="eyebrow">Creator</div><div className="mono" style={{ fontSize: 12 }}>{challenge.creator}</div></div>
                </div>
              </div>
            </div>
          )}

          {tab === "Verifier" && (
            <div className="card" style={{ padding: 28 }}>
              <div className="row gap-3" style={{ marginBottom: 20 }}>
                <span style={{ color: "var(--acc)", fontSize: 28, fontFamily: "var(--f-mono)" }}>{VERIFIER_ICON[challenge.verifier]}</span>
                <div className="h-2 serif" style={{ fontSize: 24 }}>{VERIFIER_LABEL[challenge.verifier]}</div>
              </div>
              <div className="col gap-3" style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-3)", lineHeight: 1.8 }}>
                {challenge.verifier === "ON_CHAIN" && <>
                  <div><span className="dim">→</span> read participant.balance at deadline</div>
                  <div><span className="dim">→</span> require balance ≥ {formatEth(challenge.buyIn)}</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> sync receiveVerdict(pass/fail)</div>
                </>}
                {challenge.verifier === "API_ORACLE" && <>
                  <div><span className="dim">→</span> Chainlink Functions _sendRequest(jsSrc, args)</div>
                  <div><span className="dim">→</span> Functions.makeHttpRequest(apiEndpoint)</div>
                  <div><span className="dim">→</span> fulfillRequest(reqId, response)</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> async receiveVerdict(pass/fail)</div>
                </>}
                {challenge.verifier === "AI_ORACLE" && <>
                  <div><span className="dim">→</span> participant.submitEvidence(ipfsCid, dailyNonce)</div>
                  <div><span className="dim">→</span> Gemini Vision: criteria + nonce check per photo</div>
                  <div><span className="dim">→</span> all_days_passed ? 1 : 0</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> async receiveVerdict(pass/fail)</div>
                </>}
              </div>
            </div>
          )}

          {tab === "On-chain" && (
            <div className="card" style={{ padding: 24, color: "var(--text-4)", fontSize: 13, fontFamily: "var(--f-mono)" }}>
              On-chain event history available after Subsquid indexer is deployed.
              <div style={{ marginTop: 12 }}>
                <a
                  href={`https://sepolia.etherscan.io/address/${challengeAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip"
                  style={{ color: "var(--acc)" }}
                >
                  View on Etherscan ↗
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="col gap-4" style={{ position: "sticky", top: 80, alignSelf: "flex-start" }}>
          {showWithdraw && (
            <WithdrawCard
              challengeAddress={challengeAddress}
              challengeType={challengeType}
              pendingWei={chainData.userPending!}
            />
          )}
          {showBindAccount && (
            <BindAccountCard
              challengeAddress={challengeAddress}
              challengeType={challengeType}
              verifierHint="generic"
            />
          )}
          <BetPanel challenge={challenge} />
        </div>
      </div>
    </div>
  );
}
