"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";

interface EpochResult {
    epoch: number;
    title: string;
    publicChallengeAddress: string;
    prizePool: number;
}

const QUERY = `
  query {
    epochResults(orderBy: epoch_DESC, limit: 20) {
      id
      epoch
      winningTitle
      publicChallengeAddress
      prizePool
      timestamp
    }
  }
`;

interface RawEpochResult {
    id: string;
    epoch: string;
    winningTitle: string;
    publicChallengeAddress: string;
    prizePool: string;
    timestamp: string;
}

export function useEpochResults() {
    const [epochs, setEpochs] = useState<EpochResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        squidQuery<{ epochResults: RawEpochResult[] }>(QUERY)
            .then(data => {
                const results = (data?.epochResults ?? []).map((r): EpochResult => ({
                    epoch: Number(r.epoch),
                    title: r.winningTitle,
                    publicChallengeAddress: r.publicChallengeAddress,
                    prizePool: Number(BigInt(r.prizePool)) / 1e18,
                }));
                setEpochs(results);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    return { epochs, isLoading };
}
