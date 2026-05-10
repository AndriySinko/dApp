export type ChallengeType = "INDIVIDUAL" | "GROUP" | "PUBLIC";
export type VerifierType = "ON_CHAIN" | "API_ORACLE" | "AI_ORACLE";
export type ChallengeState = "JOIN_OPEN" | "ACTIVE" | "VERIFY_PENDING" | "SETTLED";
export type BetSide = "FOR" | "AGAINST";

// On-chain enum index ↔ TS type
export const CHALLENGE_TYPE_NUM: Record<ChallengeType, number> = {
  INDIVIDUAL: 0, GROUP: 1, PUBLIC: 2,
};
export const VERIFIER_TYPE_NUM: Record<VerifierType, number> = {
  ON_CHAIN: 0, API_ORACLE: 1, AI_ORACLE: 2,
};
export const CHALLENGE_STATE_FROM_NUM: Record<number, ChallengeState> = {
  0: "JOIN_OPEN", 1: "ACTIVE", 2: "VERIFY_PENDING", 3: "SETTLED",
};
export const CHALLENGE_TYPE_FROM_NUM: Record<number, ChallengeType> = {
  0: "INDIVIDUAL", 1: "GROUP", 2: "PUBLIC",
};
export const VERIFIER_TYPE_FROM_NUM: Record<number, VerifierType> = {
  0: "ON_CHAIN", 1: "API_ORACLE", 2: "AI_ORACLE",
};

export interface Challenge {
  id: string;
  address?: string;
  title: string;
  type: ChallengeType;
  verifier: VerifierType;
  state: ChallengeState;
  creator: string;
  creatorAddress: string;
  buyIn: number;
  joinDeadline: Date;
  challengeDeadline: Date;
  // Individual challenges only
  forPool?: number;
  againstPool?: number;
  bettorsFor?: number;
  bettorsAgainst?: number;
  // Group / Public
  participants?: number;
  totalDays?: number;
  daysComplete?: number;
  description?: string;
  criteria?: string;
}

export interface Bet {
  id: string;
  challengeId: string;
  side: BetSide;
  amount: number;
  bettor: string;
  timestamp: Date;
  txHash: string;
}

export interface ActivityItem {
  time: string;
  actor: string;
  action: string;
  target: string;
}

export interface Profile {
  address: string;
  ens: string;
  reputation: number;
  won: number;
  lost: number;
  winRate: number;
  totalStaked: number;
  netProfit: number;
  since: string;
}

export interface LeaderboardEntry {
  rank: number;
  addr: string;
  reputation: number;
  won: number;
  lost: number;
  ethWon: number;
}

export interface Proposal {
  index: number;
  title: string;
  description: string;
  verifier: VerifierType;
  durationDays: number;
  joinDays: number;
  minStake: number;
  votes: number;
  voters: number;
}

export interface EpochEntry {
  epoch: number;
  title: string;
  verifier: VerifierType;
  votes: number;
  prizePool: number;
  outcome: string;
}

export interface ProfileChallenge {
  id: string;
  title: string;
  role: string;
  state: ChallengeState;
  pnl: number | null;
}
