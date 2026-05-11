"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";
import type { LeaderboardEntry } from "@/lib/types";

const QUERY = `
  query {
    userReputations(orderBy: score_DESC, limit: 10) {
      id
      score
      lastUpdated
    }
  }
`;

interface RawReputation {
    id: string;
    score: string;
    lastUpdated: string;
}

export function useLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        squidQuery<{ userReputations: RawReputation[] }>(QUERY)
            .then(data => {
                const entries = (data?.userReputations ?? []).map((r, i): LeaderboardEntry => ({
                    rank: i + 1,
                    addr: r.id,
                    reputation: Number(r.score),
                    won: 0,
                    lost: 0,
                    ethWon: 0,
                }));
                setLeaderboard(entries);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    return { leaderboard, isLoading };
}
