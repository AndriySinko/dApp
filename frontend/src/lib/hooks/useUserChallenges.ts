"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";
import type { ChallengeState, ChallengeType } from "@/lib/types";

export interface UserChallenge {
  id: string;
  title: string;
  type: ChallengeType;
  state: ChallengeState;
  role: "creator" | "participant" | "bettor";
  side?: "FOR" | "AGAINST";
  pnl: number | null;
  stake: number | null;
  verdict: boolean | null;
}

export interface UserStats {
  won: number;
  lost: number;
  winRate: number | null;
  totalStaked: number;
  netProfit: number;
}

const QUERY = `
  query UserChallenges($address: String!) {
    created: challenges(where: { creator_eq: $address }, orderBy: createdAt_DESC) {
      id title type state
    }
    participated: participants(where: { participant_eq: $address }, orderBy: joinedAt_DESC) {
      pnl
      stake
      verdict
      challenge { id title type state }
    }
    bets: bets(where: { bettor_eq: $address }, orderBy: timestamp_DESC) {
      side
      challenge { id title type state }
    }
  }
`;

export function useUserChallenges(address: string | undefined) {
  const [challenges, setChallenges] = useState<UserChallenge[]>([]);
  const [stats, setStats] = useState<UserStats>({ won: 0, lost: 0, winRate: null, totalStaked: 0, netProfit: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!address) { setIsLoading(false); return; }

    squidQuery<{
      created: { id: string; title: string; type: string; state: string }[];
      participated: { pnl: string | null; stake: string; verdict: boolean | null; challenge: { id: string; title: string; type: string; state: string } }[];
      bets: { side: string; challenge: { id: string; title: string; type: string; state: string } }[];
    }>(QUERY, { address: address.toLowerCase() })
      .then(data => {
        const seen = new Set<string>();
        const items: UserChallenge[] = [];

        for (const c of data?.created ?? []) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            items.push({ id: c.id, title: c.title, type: c.type as ChallengeType, state: c.state as ChallengeState, role: "creator", pnl: null, stake: null, verdict: null });
          }
        }
        for (const p of data?.participated ?? []) {
          const c = p.challenge;
          const pnl = p.pnl ? Number(p.pnl) / 1e18 : null;
          const stake = p.stake ? Number(BigInt(p.stake)) / 1e18 : null;
          const verdict = p.verdict ?? null;
          if (seen.has(c.id)) {
            // Creator who is also a participant — merge financial data onto existing entry
            const existing = items.find(item => item.id === c.id);
            if (existing) { existing.pnl = pnl; existing.stake = stake; existing.verdict = verdict; }
          } else {
            seen.add(c.id);
            items.push({
              id: c.id, title: c.title, type: c.type as ChallengeType, state: c.state as ChallengeState,
              role: "participant", pnl, stake, verdict,
            });
          }
        }
        for (const b of data?.bets ?? []) {
          const c = b.challenge;
          if (!seen.has(c.id)) {
            seen.add(c.id);
            items.push({ id: c.id, title: c.title, type: c.type as ChallengeType, state: c.state as ChallengeState, role: "bettor", side: b.side === "true" ? "FOR" : "AGAINST", pnl: null, stake: null, verdict: null });
          }
        }

        const participations = items.filter(c => c.state === "SETTLED" && c.pnl !== null);
        const won = participations.filter(c =>
          c.verdict === true || (c.verdict === null && (c.pnl ?? 0) > 0)
        ).length;
        const lost = participations.filter(c =>
          c.verdict === false || (c.verdict === null && (c.pnl ?? 0) < 0)
        ).length;
        const total = won + lost;
        const totalStaked = items
          .filter(c => c.role === "participant" && c.stake !== null)
          .reduce((s, c) => s + (c.stake ?? 0), 0);
        const netProfit = items
          .filter(c => c.role === "participant" && c.pnl !== null)
          .reduce((s, c) => s + (c.pnl ?? 0), 0);

        setChallenges(items);
        setStats({ won, lost, winRate: total > 0 ? Math.round((won / total) * 100) : null, totalStaked, netProfit });
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [address]);

  return { challenges, stats, isLoading };
}
