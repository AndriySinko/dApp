export const ADDRESSES = {
  factory:     process.env.NEXT_PUBLIC_FACTORY_ADDRESS     as `0x${string}`,
  governance:  process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS  as `0x${string}`,
  treasury:    process.env.NEXT_PUBLIC_TREASURY_ADDRESS    as `0x${string}`,
  reputation:  process.env.NEXT_PUBLIC_REPUTATION_ADDRESS  as `0x${string}`,
  linkToken:   (process.env.NEXT_PUBLIC_LINK_TOKEN_ADDRESS ?? "0x779877A7B0D9E8603169DdbD7836e478b4624789") as `0x${string}`,
};

// 2 LINK required by factory for Chainlink Automation upkeep registration
export const LINK_UPKEEP_AMOUNT = BigInt("2000000000000000000"); // 2e18

export const ERC20_ABI = [
  {
    type: "function", name: "approve",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "allowance",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }], stateMutability: "view",
  },
] as const;

export const FACTORY_ABI = [
  {
    type: "function", name: "createChallenge",
    inputs: [
      { name: "challengeType", type: "uint8" },
      { name: "verifier",      type: "uint8" },
      { name: "title",         type: "string" },
      { name: "criteria",      type: "string" },
      { name: "joinDeadline",       type: "uint256" },
      { name: "challengeDeadline",  type: "uint256" },
      { name: "buyIn",         type: "uint256" },
    ],
    outputs: [{ name: "challengeAddress", type: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function", name: "getAllChallenges",
    inputs: [], outputs: [{ type: "address[]" }], stateMutability: "view",
  },
  {
    type: "function", name: "getUserChallenges",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address[]" }], stateMutability: "view",
  },
  {
    type: "function", name: "getChallengeInfo",
    inputs: [{ name: "challenge", type: "address" }],
    outputs: [
      { name: "id",            type: "uint256" },
      { name: "challengeType", type: "uint8"   },
      { name: "verifier",      type: "uint8"   },
      { name: "creator",       type: "address" },
      { name: "title",         type: "string"  },
    ],
    stateMutability: "view",
  },
  {
    type: "event", name: "ChallengeCreated",
    inputs: [
      { name: "challengeId",       type: "uint256",  indexed: true  },
      { name: "contractAddress",   type: "address",  indexed: true  },
      { name: "creator",           type: "address",  indexed: true  },
      { name: "challengeType",     type: "uint8",    indexed: false },
      { name: "verifier",          type: "uint8",    indexed: false },
      { name: "title",             type: "string",   indexed: false },
      { name: "criteria",          type: "string",   indexed: false },
      { name: "buyIn",             type: "uint256",  indexed: false },
      { name: "joinDeadline",      type: "uint256",  indexed: false },
      { name: "challengeDeadline", type: "uint256",  indexed: false },
    ],
  },
] as const;

// Shared base functions present in all challenge types
const BASE_CHALLENGE_ABI = [
  { type: "function", name: "state",             inputs: [], outputs: [{ type: "uint8"    }], stateMutability: "view" },
  { type: "function", name: "creator",           inputs: [], outputs: [{ type: "address"  }], stateMutability: "view" },
  { type: "function", name: "joinDeadline",      inputs: [], outputs: [{ type: "uint256"  }], stateMutability: "view" },
  { type: "function", name: "challengeDeadline", inputs: [], outputs: [{ type: "uint256"  }], stateMutability: "view" },
  { type: "function", name: "buyIn",             inputs: [], outputs: [{ type: "uint256"  }], stateMutability: "view" },
  { type: "function", name: "participants",      inputs: [], outputs: [{ type: "address[]"}], stateMutability: "view" },
  {
    type: "function", name: "isRegistered",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view",
  },
  {
    type: "function", name: "stakes",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "verdictReceived",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view",
  },
  { type: "function", name: "verdictsExpected",  inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "verdictsCompleted", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "bindAccount",
    inputs: [{ name: "serviceAccountId", type: "string" }], outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "submitEvidence",
    inputs: [{ name: "ipfsCid", type: "string" }, { name: "nonce", type: "bytes32" }],
    outputs: [], stateMutability: "nonpayable",
  },
  { type: "function", name: "getCurrentDayNonce", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  {
    type: "function", name: "getDaysComplete",
    inputs: [{ name: "participant", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  { type: "function", name: "settle", inputs: [], outputs: [], stateMutability: "nonpayable" },
  {
    type: "event", name: "StateChanged",
    inputs: [
      { name: "from",      type: "uint8",   indexed: false },
      { name: "to",        type: "uint8",   indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "ParticipantRegistered",
    inputs: [
      { name: "participant", type: "address", indexed: true  },
      { name: "stake",       type: "uint256", indexed: false },
      { name: "timestamp",   type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "VerdictReceived",
    inputs: [
      { name: "participant", type: "address", indexed: true  },
      { name: "passed",      type: "bool",    indexed: false },
      { name: "timestamp",   type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Settled",
    inputs: [
      { name: "winnersCount",      type: "uint256", indexed: false },
      { name: "losersCount",       type: "uint256", indexed: false },
      { name: "totalDistributed",  type: "uint256", indexed: false },
      { name: "fee",               type: "uint256", indexed: false },
      { name: "timestamp",         type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "ParticipantSettled",
    inputs: [
      { name: "participant", type: "address", indexed: true  },
      { name: "won",         type: "bool",    indexed: false },
      { name: "payout",      type: "uint256", indexed: false },
      { name: "pnl",         type: "int256",  indexed: false },
    ],
  },
] as const;

export const INDIVIDUAL_CHALLENGE_ABI = [
  ...BASE_CHALLENGE_ABI,
  {
    type: "function", name: "placeBet",
    inputs: [{ name: "side", type: "bool" }], outputs: [], stateMutability: "payable",
  },
  { type: "function", name: "forPool",        inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "againstPool",    inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "bettorsFor",     inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "bettorsAgainst", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "getBet",
    inputs: [{ name: "bettor", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }, { name: "side", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "pendingWithdrawals",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  { type: "function", name: "withdraw", inputs: [], outputs: [], stateMutability: "nonpayable" },
  {
    type: "event", name: "BetPlaced",
    inputs: [
      { name: "bettor",          type: "address", indexed: true  },
      { name: "side",            type: "bool",    indexed: false },
      { name: "amount",          type: "uint256", indexed: false },
      { name: "newForPool",      type: "uint256", indexed: false },
      { name: "newAgainstPool",  type: "uint256", indexed: false },
      { name: "timestamp",       type: "uint256", indexed: false },
    ],
  },
] as const;

export const GROUP_CHALLENGE_ABI = [
  ...BASE_CHALLENGE_ABI,
  { type: "function", name: "join", inputs: [], outputs: [], stateMutability: "payable" },
  {
    type: "function", name: "pendingWithdrawals",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  { type: "function", name: "withdraw", inputs: [], outputs: [], stateMutability: "nonpayable" },
] as const;

export const PUBLIC_CHALLENGE_ABI = [
  ...BASE_CHALLENGE_ABI,
  { type: "function", name: "join", inputs: [], outputs: [], stateMutability: "payable" },
  {
    type: "function", name: "pendingWithdrawals",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  { type: "function", name: "withdraw",        inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "prizePool",       inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "returnPrizePoolToTreasury", inputs: [], outputs: [], stateMutability: "nonpayable" },
] as const;

export const REPUTATION_ABI = [
  {
    type: "function", name: "getScore",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "int256" }], stateMutability: "view",
  },
  {
    type: "event", name: "ReputationUpdated",
    inputs: [
      { name: "user",      type: "address", indexed: true  },
      { name: "delta",     type: "int256",  indexed: false },
      { name: "newScore",  type: "int256",  indexed: false },
      { name: "challenge", type: "address", indexed: true  },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const GOVERNANCE_ABI = [
  {
    type: "function", name: "propose",
    inputs: [
      { name: "title",        type: "string"  },
      { name: "description",  type: "string"  },
      { name: "verifier",     type: "uint8"   },
      { name: "durationDays", type: "uint256" },
      { name: "joinDays",     type: "uint256" },
      { name: "minStake",     type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "getProposals",
    inputs: [],
    outputs: [{
      type: "tuple[]",
      components: [
        { name: "title",        type: "string"  },
        { name: "description",  type: "string"  },
        { name: "verifier",     type: "uint8"   },
        { name: "durationDays", type: "uint256" },
        { name: "joinDays",     type: "uint256" },
        { name: "minStake",     type: "uint256" },
        { name: "votes",        type: "uint256" },
        { name: "voters",       type: "uint256" },
      ],
    }],
    stateMutability: "view",
  },
  {
    type: "function", name: "vote",
    inputs: [{ name: "proposalIndex", type: "uint256" }], outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "hasVotedThisEpoch",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view",
  },
  {
    type: "function", name: "getVoteWeight",
    inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  { type: "function", name: "currentEpochEnd", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "currentEpoch",    inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "tickEpoch",       inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "prizePerEpoch",   inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "event", name: "Voted",
    inputs: [
      { name: "voter",          type: "address", indexed: true  },
      { name: "proposalIndex",  type: "uint256", indexed: false },
      { name: "weight",         type: "uint256", indexed: false },
      { name: "newVoteCount",   type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "EpochTicked",
    inputs: [
      { name: "epoch",                  type: "uint256", indexed: false },
      { name: "winningProposalIndex",   type: "uint256", indexed: false },
      { name: "winningTitle",           type: "string",  indexed: false },
      { name: "publicChallengeAddress", type: "address", indexed: false },
      { name: "prizePool",              type: "uint256", indexed: false },
    ],
  },
] as const;
