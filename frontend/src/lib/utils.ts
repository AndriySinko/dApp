import type { ChallengeState, VerifierType } from "./types";

export const VERIFIER_ICON: Record<VerifierType, string> = {
  ON_CHAIN: "◆",
  API_ORACLE: "◇",
  AI_ORACLE: "◈",
};

export const VERIFIER_LABEL: Record<VerifierType, string> = {
  ON_CHAIN: "On-chain",
  API_ORACLE: "API Oracle",
  AI_ORACLE: "AI Oracle",
};

export const STATE_LABEL: Record<ChallengeState, string> = {
  BET_OPEN: "Bet Open",
  ACTIVE: "Active",
  STAKE_LOCK: "Stake Lock",
  JOIN_OPEN: "Join Open",
  SETTLED: "Settled",
};

export const STATE_CLASS: Record<ChallengeState, string> = {
  BET_OPEN: "tag acc",
  ACTIVE: "tag acc",
  STAKE_LOCK: "tag warn",
  JOIN_OPEN: "tag acc",
  SETTLED: "tag",
};

export const TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL: "Individual",
  GROUP: "Group",
  PUBLIC: "Public",
};

export function formatEth(n: number): string {
  return `Ξ ${n.toFixed(2)}`;
}

export function pct(a: number, b: number): number {
  const total = a + b;
  if (total === 0) return 50;
  return Math.round((a / total) * 100);
}

export function multiplier(pool: number, total: number): string {
  if (pool === 0) return "—";
  return (total / pool).toFixed(2) + "×";
}

export function timeLeft(deadline: Date): string {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return "ended";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `in ${mins}m`;
}

export function shortTx(hash: string): string {
  return hash.slice(0, 6) + "..." + hash.slice(-4);
}
