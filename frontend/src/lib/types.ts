export type ChallengeType = "INDIVIDUAL" | "GROUP" | "PUBLIC";
export type VerifierType = "ON_CHAIN" | "API_ORACLE" | "AI_ORACLE";
export type ChallengeState = "BET_OPEN" | "ACTIVE" | "STAKE_LOCK" | "JOIN_OPEN" | "SETTLED";
export type BetSide = "FOR" | "AGAINST";

export interface Challenge {
  id: string;
  title: string;
  type: ChallengeType;
  verifier: VerifierType;
  state: ChallengeState;
  creator: string;
  creatorAddress: string;
  buyIn: number;
  deadline: Date;
  forPool: number;
  againstPool: number;
  bettorsFor: number;
  bettorsAgainst: number;
  participants?: number;
  totalDays?: number;
  daysComplete?: number;
  description?: string;
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
  id: string;
  title: string;
  description: string;
  verifier: VerifierType;
  durationDays: number;
  minStake: number;
  votes: number;
  voters: number;
  votePct: number;
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
