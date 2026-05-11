"use client";

import { useActivityFeed } from "@/lib/hooks/useActivityFeed";

function shortAddr(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function activityLabel(type: string): string {
    switch (type) {
        case "ChallengeCreated": return "created a challenge";
        case "BetFor":           return "bet FOR";
        case "BetAgainst":       return "bet AGAINST";
        case "Joined":           return "joined";
        default:                 return type.toLowerCase();
    }
}

function timeAgo(date: Date): string {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60)   return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
}

export function LiveActivityFeed() {
    const { activities, isLoading } = useActivityFeed();

    if (isLoading) {
        return (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
                Loading activity…
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>
                No activity yet.
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {activities.map((a, i) => (
                <div
                    key={a.id}
                    style={{
                        padding: "14px 20px",
                        borderBottom: i < activities.length - 1 ? "1px solid var(--line-soft)" : "none",
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
                            {" "}{activityLabel(a.activityType)}
                            {a.amount > 0 && (
                                <span className="muted"> · Ξ {a.amount.toFixed(3)}</span>
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
