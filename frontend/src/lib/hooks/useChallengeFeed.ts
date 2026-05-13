"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";
import type { ActivityFeedItem } from "./useActivityFeed";

const QUERY = `
  query ChallengeFeed($id: String!) {
    participants(where: { challenge: { id_eq: $id } }, orderBy: joinedAt_DESC) {
      participant
      stake
      joinedAt
      verdict
      pnl
    }
    bets(where: { challenge: { id_eq: $id } }, orderBy: timestamp_DESC) {
      id
      bettor
      side
      amount
      timestamp
      txHash
    }
    reputationUpdates(where: { challenge_eq: $id }, orderBy: timestamp_DESC) {
      id
      user
      delta
      timestamp
    }
  }
`;

interface RawParticipant { participant: string; stake: string; joinedAt: string; verdict?: boolean | null; pnl?: string | null; }
interface RawBet         { id: string; bettor: string; side: boolean; amount: string; timestamp: string; txHash: string; }
interface RawRepUpdate   { id: string; user: string; delta: string; timestamp: string; }

export function useChallengeFeed(challengeId: string | undefined) {
    const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!challengeId) { setIsLoading(false); return; }

        squidQuery<{ participants: RawParticipant[]; bets: RawBet[]; reputationUpdates: RawRepUpdate[] }>(
            QUERY, { id: challengeId.toLowerCase() }
        )
            .then(data => {
                // Build pnl lookup: userAddress → abs(pnl) in ETH
                const pnlMap = new Map<string, number>();
                for (const p of data?.participants ?? []) {
                    if (p.pnl) {
                        pnlMap.set(p.participant, Math.abs(Number(BigInt(p.pnl)) / 1e18));
                    }
                }

                const items: ActivityFeedItem[] = [];

                for (const p of data?.participants ?? []) {
                    items.push({
                        id: `joined-${challengeId}-${p.participant}`,
                        user: p.participant,
                        challenge: challengeId,
                        activityType: "Joined",
                        amount: Number(BigInt(p.stake)) / 1e18,
                        repDelta: 0,
                        txHash: "",
                        timestamp: new Date(p.joinedAt),
                    });
                }

                for (const b of data?.bets ?? []) {
                    items.push({
                        id: b.id,
                        user: b.bettor,
                        challenge: challengeId,
                        activityType: b.side ? "BetFor" : "BetAgainst",
                        amount: Number(BigInt(b.amount)) / 1e18,
                        repDelta: 0,
                        txHash: b.txHash,
                        timestamp: new Date(b.timestamp),
                    });
                }

                for (const r of data?.reputationUpdates ?? []) {
                    const delta = Number(r.delta);
                    if (delta === 0) continue;
                    items.push({
                        id: `rep-${r.id}`,
                        user: r.user,
                        challenge: challengeId,
                        activityType: delta > 0 ? "Won" : "Lost",
                        amount: pnlMap.get(r.user) ?? 0,
                        repDelta: delta,
                        txHash: "",
                        timestamp: new Date(r.timestamp),
                    });
                }

                items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                setActivities(items);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [challengeId]);

    return { activities, isLoading };
}
