"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";

export interface ActivityFeedItem {
    id: string;
    user: string;
    challenge: string;
    activityType: "Created" | "Joined" | "BetFor" | "BetAgainst" | "Won" | "Lost";
    amount: number;    // ETH: buy-in / stake / bet / pnl (abs)
    repDelta: number;  // reputation delta, non-zero for Won/Lost
    txHash: string;
    timestamp: Date;
}

const QUERY = `
  query {
    challenges(orderBy: createdAt_DESC, limit: 50) {
      id
      creator
      buyIn
      createdAt
      createdTxHash
    }
    participants(orderBy: joinedAt_DESC, limit: 50) {
      participant
      stake
      joinedAt
      verdict
      pnl
      challenge { id }
    }
    settledParticipants: participants(
      where: { verdict_isNull: false }
      orderBy: joinedAt_DESC
      limit: 100
    ) {
      participant
      pnl
      challenge { id }
    }
    bets(orderBy: timestamp_DESC, limit: 50) {
      id
      bettor
      side
      amount
      timestamp
      txHash
      challenge { id }
    }
    reputationUpdates(orderBy: timestamp_DESC, limit: 50) {
      id
      user
      delta
      challenge
      timestamp
    }
  }
`;

interface RawChallenge    { id: string; creator: string; buyIn: string; createdAt: string; createdTxHash: string; }
interface RawParticipant  { participant: string; stake: string; joinedAt: string; verdict?: boolean | null; pnl?: string | null; challenge: { id: string }; }
interface RawSettled      { participant: string; pnl: string | null; challenge: { id: string }; }
interface RawBet          { id: string; bettor: string; side: boolean; amount: string; timestamp: string; txHash: string; challenge: { id: string }; }
interface RawRepUpdate    { id: string; user: string; delta: string; challenge: string; timestamp: string; }

export function useActivityFeed() {
    const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        squidQuery<{
            challenges: RawChallenge[];
            participants: RawParticipant[];
            settledParticipants: RawSettled[];
            bets: RawBet[];
            reputationUpdates: RawRepUpdate[];
        }>(QUERY)
            .then(data => {
                // Build pnl lookup: "${challengeId}-${userAddress}" → ETH pnl
                const pnlMap = new Map<string, number>();
                for (const p of data?.settledParticipants ?? []) {
                    if (p.pnl) {
                        pnlMap.set(
                            `${p.challenge.id}-${p.participant}`,
                            Math.abs(Number(BigInt(p.pnl)) / 1e18),
                        );
                    }
                }

                const items: ActivityFeedItem[] = [];

                for (const c of data?.challenges ?? []) {
                    items.push({
                        id: `created-${c.id}`,
                        user: c.creator,
                        challenge: c.id,
                        activityType: "Created",
                        amount: Number(BigInt(c.buyIn)) / 1e18,
                        repDelta: 0,
                        txHash: c.createdTxHash,
                        timestamp: new Date(c.createdAt),
                    });
                }

                for (const p of data?.participants ?? []) {
                    items.push({
                        id: `joined-${p.challenge.id}-${p.participant}`,
                        user: p.participant,
                        challenge: p.challenge.id,
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
                        challenge: b.challenge.id,
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
                    const ethAmount = pnlMap.get(`${r.challenge}-${r.user}`) ?? 0;
                    items.push({
                        id: `rep-${r.id}`,
                        user: r.user,
                        challenge: r.challenge,
                        activityType: delta > 0 ? "Won" : "Lost",
                        amount: ethAmount,
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
    }, []);

    return { activities, isLoading };
}
