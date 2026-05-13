"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { squidQuery } from "@/lib/squid";
import { ADDRESSES } from "@/lib/contracts";

const TREASURY_ABI = [
    { type: "function", name: "prizePool", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const STATS_QUERY = `
  query {
    challenges(limit: 1000) {
      state
      buyIn
    }
  }
`;

interface RawChallenge { state: string; buyIn: string; }

export function useProtocolStats() {
    const [tvl, setTvl] = useState<number | null>(null);
    const [activeChallenges, setActiveChallenges] = useState<number | null>(null);
    const [settledChallenges, setSettledChallenges] = useState<number | null>(null);

    const { data: prizePoolWei } = useReadContract({
        address: ADDRESSES.treasury,
        abi: TREASURY_ABI,
        functionName: "prizePool",
        query: { refetchInterval: 15_000 },
    });

    useEffect(() => {
        squidQuery<{ challenges: RawChallenge[] }>(STATS_QUERY)
            .then(data => {
                const all = data?.challenges ?? [];
                const active = all.filter(c => c.state !== "SETTLED");
                const settled = all.filter(c => c.state === "SETTLED");
                const totalTvl = active.reduce((sum, c) => sum + Number(BigInt(c.buyIn)) / 1e18, 0);
                setActiveChallenges(active.length);
                setSettledChallenges(settled.length);
                setTvl(totalTvl);
            })
            .catch(console.error);
    }, []);

    const prizePool = prizePoolWei !== undefined
        ? Number(prizePoolWei) / 1e18
        : null;

    return { tvl, activeChallenges, settledChallenges, prizePool };
}
