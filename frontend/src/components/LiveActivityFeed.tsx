"use client";

import { useActivityFeed } from "@/lib/hooks/useActivityFeed";
import type { ActivityFeedItem } from "@/lib/hooks/useActivityFeed";

function shortAddr(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const TYPE_COLOR: Record<ActivityFeedItem["activityType"], string> = {
    Created:    "var(--acc)",
    Joined:     "var(--text-2)",
    BetFor:     "var(--win)",
    BetAgainst: "var(--loss)",
    Won:        "var(--win)",
    Lost:       "var(--loss)",
};

const TYPE_LABEL: Record<ActivityFeedItem["activityType"], string> = {
    Created:    "created a challenge",
    Joined:     "joined",
    BetFor:     "bet FOR",
    BetAgainst: "bet AGAINST",
    Won:        "won",
    Lost:       "lost",
};

function timeAgo(date: Date): string {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60)    return `${secs}s ago`;
    if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
}

export function LiveActivityFeed() {
    const { activities, isLoading } = useActivityFeed();
    const visible = activities.slice(0, 10);

    if (isLoading) {
        return (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
                Loading activity…
            </div>
        );
    }

    if (visible.length === 0) {
        return (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
                No activity yet.
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {visible.map((a, i) => (
                <div
                    key={a.id}
                    style={{
                        padding: "14px 20px",
                        borderBottom: i < visible.length - 1 ? "1px solid var(--line-soft)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 13,
                    }}
                >
                    <div className="row gap-3" style={{ alignItems: "center" }}>
                        <span className="avatar" style={{ width: 28, height: 28 }} />
                        <span>
                            <span className="mono" style={{ color: "var(--acc)" }}>{shortAddr(a.user)}</span>
                            {" "}
                            <span style={{ color: TYPE_COLOR[a.activityType] }}>
                                {TYPE_LABEL[a.activityType]}
                            </span>
                            {a.amount > 0 && (
                                <span style={{ color: TYPE_COLOR[a.activityType] === "var(--text-2)" ? "var(--text-3)" : TYPE_COLOR[a.activityType], marginLeft: 2 }}>
                                    {" "}· {a.activityType === "Lost" ? "-" : ""}Ξ {a.amount.toFixed(3)}
                                </span>
                            )}
                            {a.repDelta !== 0 && (
                                <span style={{ color: "var(--text-3)", marginLeft: 4, fontSize: 11 }}>
                                    · {a.repDelta > 0 ? "+" : ""}{a.repDelta} rep
                                </span>
                            )}
                        </span>
                    </div>
                    <span className="muted" style={{ fontSize: 11, fontFamily: "var(--f-mono)" }}>
                        {timeAgo(a.timestamp)}
                    </span>
                </div>
            ))}
        </div>
    );
}
