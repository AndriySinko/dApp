"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";
import type { ChallengeState, ChallengeType, VerifierType } from "@/lib/types";

export interface UserChallenge {
  id: string;
  title: string;
  type: ChallengeType;
  state: ChallengeState;
  role: "creator" | "participant" | "bettor";
  side?: "FOR" | "AGAINST";
  pnl: number | null;
}

const QUERY = `
  query UserChallenges($address: String!) {
    created: challenges(where: { creator_eq: $address }, orderBy: createdAt_DESC) {
      id title type state
    }
    participated: participants(where: { participant_eq: $address }, orderBy: joinedAt_DESC) {
      pnl
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!address) { setIsLoading(false); return; }

    squidQuery<{
      created: { id: string; title: string; type: string; state: string }[];
      participated: { pnl: string | null; challenge: { id: string; title: string; type: string; state: string } }[];
      bets: { side: string; challenge: { id: string; title: string; type: string; state: string } }[];
    }>(QUERY, { address: address.toLowerCase() })
      .then(data => {
        const seen = new Set<string>();
        const items: UserChallenge[] = [];

        for (const c of data?.created ?? []) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            items.push({ id: c.id, title: c.title, type: c.type as ChallengeType, state: c.state as ChallengeState, role: "creator", pnl: null });
          }
        }
        for (const p of data?.participated ?? []) {
          const c = p.challenge;
          if (!seen.has(c.id)) {
            seen.add(c.id);
            items.push({ id: c.id, title: c.title, type: c.type as ChallengeType, state: c.state as ChallengeState, role: "participant", pnl: p.pnl ? Number(p.pnl) / 1e18 : null });
          }
        }
        for (const b of data?.bets ?? []) {
          const c = b.challenge;
          if (!seen.has(c.id)) {
            seen.add(c.id);
            items.push({ id: c.id, title: c.title, type: c.type as ChallengeType, state: c.state as ChallengeState, role: "bettor", side: b.side === "true" ? "FOR" : "AGAINST", pnl: null });
          }
        }

        setChallenges(items);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [address]);

  return { challenges, isLoading };
}
