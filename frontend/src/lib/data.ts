import type {
  Challenge, Bet, ActivityItem,
  Profile, LeaderboardEntry,
  Proposal, EpochEntry, ProfileChallenge,
} from "./types";

const t = (offsetMs: number) => new Date(Date.now() + offsetMs);
const d = (days: number, hours = 0) => t(days * 86400000 + hours * 3600000);

export const CHALLENGES: Challenge[] = [
  {
    id: "C-0142",
    title: "Run 50km in 7 days",
    type: "INDIVIDUAL",
    verifier: "API_ORACLE",
    state: "BET_OPEN",
    creator: "alex.eth",
    creatorAddress: "0x7A4f9b8c3D1e2F4a5B6c7D8e9F0a1B2c3D4e3eD2",
    buyIn: 0.5,
    deadline: d(6, 14),
    forPool: 0.78,
    againstPool: 1.12,
    bettorsFor: 6,
    bettorsAgainst: 11,
    description: "I will run 50km total across 7 days tracked via Strava API. Daily splits are visible on-chain.",
  },
  {
    id: "C-0141",
    title: "Ship 5 PRs to my OSS lib this week",
    type: "INDIVIDUAL",
    verifier: "API_ORACLE",
    state: "ACTIVE",
    creator: "vix.eth",
    creatorAddress: "0x4f1a9b2c3D4e5f6a7B8c9D0e1F2a3B4c5D6e7F4f",
    buyIn: 0.3,
    deadline: d(1, 8),
    forPool: 0.49,
    againstPool: 1.08,
    bettorsFor: 5,
    bettorsAgainst: 12,
    description: "5 merged PRs to my open-source library in 7 days. Verified via GitHub API — PR count at deadline.",
  },
  {
    id: "C-0140",
    title: "Daily gym for 30 days",
    type: "GROUP",
    verifier: "AI_ORACLE",
    state: "ACTIVE",
    creator: "ren.eth",
    creatorAddress: "0x9e2a3b4c5D6e7f8a9B0c1D2e3F4a5B6c7D8e9F0c",
    buyIn: 0.2,
    deadline: d(17),
    forPool: 2.80,
    againstPool: 0,
    bettorsFor: 0,
    bettorsAgainst: 0,
    participants: 14,
    totalDays: 30,
    daysComplete: 12,
    description: "30-day gym streak. Daily photo evidence with AI-oracle nonce verification. Winners split losers pool.",
  },
  {
    id: "C-0139",
    title: "HODL ≥ 0.5 ETH for 30 days",
    type: "GROUP",
    verifier: "ON_CHAIN",
    state: "STAKE_LOCK",
    creator: "factory.eth",
    creatorAddress: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a1b2",
    buyIn: 0.5,
    deadline: d(0, 4),
    forPool: 23.50,
    againstPool: 0,
    bettorsFor: 0,
    bettorsAgainst: 0,
    participants: 47,
    description: "Hold at least 0.5 ETH in your wallet for 30 consecutive days. Balance checked on-chain at deadline.",
  },
  {
    id: "C-0138",
    title: "Public: 100 commits this month",
    type: "PUBLIC",
    verifier: "API_ORACLE",
    state: "JOIN_OPEN",
    creator: "admin",
    creatorAddress: "0x0000000000000000000000000000000000000001",
    buyIn: 0.3,
    deadline: d(2),
    forPool: 2.07,
    againstPool: 0,
    bettorsFor: 0,
    bettorsAgainst: 0,
    participants: 23,
    description: "100 GitHub commits in the month, verified via GitHub API. Treasury funds the prize pool.",
  },
  {
    id: "C-0137",
    title: "Read 4 books in November",
    type: "INDIVIDUAL",
    verifier: "AI_ORACLE",
    state: "SETTLED",
    creator: "lyra.eth",
    creatorAddress: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8b2c3d4",
    buyIn: 0.1,
    deadline: d(-5),
    forPool: 0.21,
    againstPool: 0.52,
    bettorsFor: 4,
    bettorsAgainst: 9,
    description: "Read 4 books in November. AI oracle reviews photo evidence: book cover + handwritten summary per book.",
  },
];

export const BETS: Bet[] = [
  { id: "b1", challengeId: "C-0142", side: "AGAINST", amount: 0.12, bettor: "0x4f...91", timestamp: t(-5 * 3600000), txHash: "0xabc1ef23" },
  { id: "b2", challengeId: "C-0142", side: "FOR",     amount: 0.05, bettor: "0xa1...22", timestamp: t(-2 * 3600000), txHash: "0xdef4ab56" },
  { id: "b3", challengeId: "C-0142", side: "AGAINST", amount: 0.08, bettor: "0x9e...0c", timestamp: t(-47 * 60000), txHash: "0x1234cd78" },
  { id: "b4", challengeId: "C-0142", side: "FOR",     amount: 0.20, bettor: "0xb2...4f", timestamp: t(-12 * 60000), txHash: "0x5678ef90" },
];

export const ACTIVITY: ActivityItem[] = [
  { time: "2m",  actor: "0xb2...4f", action: "bet 0.20 ETH FOR",                target: "C-0142" },
  { time: "12m", actor: "0x4f...91", action: "submitted evidence for day 12",   target: "C-0140" },
  { time: "31m", actor: "0x9e...0c", action: "registered",                      target: "C-0139" },
  { time: "47m", actor: "ren.eth",   action: "voted (weight ×42)",              target: "P-009"  },
  { time: "1h",  actor: "0xa1...22", action: "settled — won 0.41 ETH",          target: "C-0136" },
  { time: "2h",  actor: "vix.eth",   action: "created",                         target: "C-0141" },
  { time: "3h",  actor: "0x6c...7d", action: "AI verdict received: pass",       target: "C-0140" },
];

export const PROFILE: Profile = {
  address: "0x7A4f9b8c3D1e2F4a5B6c7D8e9F0a1B2c3D4e3eD2",
  ens: "alex.eth",
  reputation: 87,
  won: 14,
  lost: 3,
  winRate: 82,
  totalStaked: 4.2,
  netProfit: 2.33,
  since: "2025-09-12",
};

export const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, addr: "ren.eth",   reputation: 412, won: 38, lost: 4, ethWon: 14.2 },
  { rank: 2, addr: "vix.eth",   reputation: 289, won: 22, lost: 6, ethWon: 8.4  },
  { rank: 3, addr: "lyra.eth",  reputation: 211, won: 17, lost: 3, ethWon: 6.1  },
  { rank: 4, addr: "0xb2...4f", reputation: 187, won: 19, lost: 8, ethWon: 5.5  },
  { rank: 5, addr: "alex.eth",  reputation: 87,  won: 14, lost: 3, ethWon: 2.83 },
];

export const PROFILE_CHALLENGES: ProfileChallenge[] = [
  { id: "C-0142", title: "Run 50km in 7 days",       role: "creator",         state: "BET_OPEN", pnl: null  },
  { id: "C-0140", title: "Daily gym for 30 days",    role: "participant",      state: "ACTIVE",   pnl: null  },
  { id: "C-0136", title: "Read 4 books in November", role: "FOR bettor",       state: "SETTLED",  pnl: 0.41  },
  { id: "C-0131", title: "100km cycling",            role: "creator",          state: "SETTLED",  pnl: 0.62  },
  { id: "C-0128", title: "10 PRs in a month",        role: "AGAINST bettor",   state: "SETTLED",  pnl: -0.15 },
];

export const PROPOSALS: Proposal[] = [
  {
    id: "P-009",
    title: "Public Hack-a-thon: ship 1 demo each",
    description: "Group challenge for hackathon participants. Each submits a working demo URL by deadline. Winners split losing pool + 2 ETH from treasury.",
    verifier: "API_ORACLE",
    durationDays: 14,
    minStake: 0.05,
    votes: 1247,
    voters: 89,
    votePct: 44.6,
  },
  {
    id: "P-008",
    title: "Daily meditation, 21 days, photo+nonce",
    description: "AI Oracle challenge. Daily evidence: photo of yourself meditating with daily nonce visible. Bonus to streaks.",
    verifier: "AI_ORACLE",
    durationDays: 21,
    minStake: 0.02,
    votes: 932,
    voters: 71,
    votePct: 33.4,
  },
  {
    id: "P-007",
    title: "HODL ≥ 1 ETH through Q1",
    description: "On-chain verified. 90 days, no minimum participants, balance check at deadline.",
    verifier: "ON_CHAIN",
    durationDays: 90,
    minStake: 0.10,
    votes: 614,
    voters: 52,
    votePct: 22.0,
  },
];

export const PAST_EPOCHS: EpochEntry[] = [
  { epoch: 13, title: "Daily walk 30k steps",    verifier: "API_ORACLE", votes: 1402, prizePool: 1.20, outcome: "23 / 27 won" },
  { epoch: 12, title: "HODL ≥ 0.25 ETH for 30d", verifier: "ON_CHAIN",  votes: 983,  prizePool: 0.80, outcome: "47 / 47 won" },
  { epoch: 11, title: "5 books in 30 days",      verifier: "AI_ORACLE",  votes: 742,  prizePool: 0.60, outcome: "11 / 18 won" },
];

export const REPUTATION_SPARKLINE = [0, 5, 8, 12, 18, 24, 21, 28, 36, 42, 51, 58, 64, 71, 78, 87];
export const FOR_PROBABILITY_SPARKLINE = [52, 54, 49, 47, 50, 48, 46, 45, 43, 41, 42, 41];
export const LANDING_SPARKLINE = [40, 48, 45, 52, 49, 55, 53, 51, 48, 46, 43, 41];

export const MOCK_NONCE = "0xa3f2b819";
export const MOCK_CONNECTED_ADDRESS = "0x7A4f9b8c3D1e2F4a5B6c7D8e9F0a1B2c3D4e3eD2";
export const MOCK_CONNECTED_ENS = "alex.eth";
export const MOCK_REPUTATION = 87;
