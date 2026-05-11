"use client";

import { useEffect, useState } from "react";
import { squidQuery } from "@/lib/squid";

export interface ActivityFeedItem {
    id: string;
    user: string;
    challenge: string;
    activityType: string;
    amount: number;
    txHash: string;
    timestamp: Date;
}

const QUERY = `
  query {
    factoryActivities(orderBy: timestamp_DESC, limit: 20) {
      id
      user
      challenge
      activityType
      amount
      txHash
      timestamp
    }
  }
`;

interface RawActivity {
    id: string;
    user: string;
    challenge: string;
    activityType: string;
    amount: string;
    txHash: string;
    timestamp: string;
}

export function useActivityFeed() {
    const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        squidQuery<{ factoryActivities: RawActivity[] }>(QUERY)
            .then(data => {
                const items = (data?.factoryActivities ?? []).map((r): ActivityFeedItem => ({
                    id: r.id,
                    user: r.user,
                    challenge: r.challenge,
                    activityType: r.activityType,
                    amount: Number(BigInt(r.amount)) / 1e18,
                    txHash: r.txHash,
                    timestamp: new Date(r.timestamp),
                }));
                setActivities(items);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    return { activities, isLoading };
}
