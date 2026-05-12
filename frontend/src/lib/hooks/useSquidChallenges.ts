"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";
import type { Challenge, ChallengeType, ChallengeState, VerifierType } from "@/lib/types";

const QUERY = `
  query {
    challenges(orderBy: createdAt_DESC, limit: 100) {
      id
      type
      verifier
      state
      creator
      title
      criteria
      buyIn
      joinDeadline
      challengeDeadline
      createdAt
      forPool
      againstPool
      bettorsFor
      bettorsAgainst
    }
  }
`;

interface RawChallenge {
    id: string;
    type: string;
    verifier: string;
    state: string;
    creator: string;
    title: string;
    criteria: string;
    buyIn: string;
    joinDeadline: string;
    challengeDeadline: string;
    createdAt: string;
    forPool: string | null;
    againstPool: string | null;
    bettorsFor: number | null;
    bettorsAgainst: number | null;
}

function toEth(wei: string | null): number {
    if (!wei) return 0;
    return Number(BigInt(wei)) / 1e18;
}

function mapChallenge(r: RawChallenge): Challenge {
    const isGroup = r.type === "GROUP" || r.type === "PUBLIC";
    return {
        id: r.id,
        address: r.id,
        title: r.title,
        type: r.type as ChallengeType,
        verifier: r.verifier as VerifierType,
        state: r.state as ChallengeState,
        creator: r.creator,
        creatorAddress: r.creator,
        buyIn: toEth(r.buyIn),
        joinDeadline: new Date(Number(r.joinDeadline) * 1000),
        challengeDeadline: new Date(Number(r.challengeDeadline) * 1000),
        criteria: r.criteria,
        forPool: toEth(r.forPool),
        againstPool: toEth(r.againstPool),
        bettorsFor: isGroup ? 0 : (r.bettorsFor ?? 0),
        bettorsAgainst: r.bettorsAgainst ?? 0,
        participants: isGroup ? (r.bettorsFor ?? 0) : undefined,
    };
}

export function useSquidChallenges() {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        squidQuery<{ challenges: RawChallenge[] }>(QUERY)
            .then(data => setChallenges((data?.challenges ?? []).map(mapChallenge)))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    return { challenges, isLoading };
}
