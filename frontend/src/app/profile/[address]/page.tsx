"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Sparkline } from "@/components/ui";
import { PROFILE, LEADERBOARD, PROFILE_CHALLENGES, REPUTATION_SPARKLINE } from "@/lib/data";
import { STATE_CLASS, STATE_LABEL } from "@/lib/utils";
import type { ChallengeState } from "@/lib/types";
import { useReputation } from "@/lib/hooks/useReputation";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";

type Filter = "All" | "Created" | "Bet";

export default function ProfilePage() {
  const { address: urlAddress } = useParams<{ address: string }>();
  const profileAddress = urlAddress as `0x${string}`;
  const [filter, setFilter] = useState<Filter>("All");

  const { scoreNum } = useReputation(profileAddress);
  const { leaderboard } = useLeaderboard();

  const filtered = PROFILE_CHALLENGES.filter(c => {
    if (filter === "Created") return c.role === "creator";
    if (filter === "Bet")     return c.role.includes("bettor");
    return true;
  });

  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div className="card" style={{ padding: 36, marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "center" }}>
          <span className="avatar lg" />
          <div className="col gap-2">
            <div className="row gap-3">
              <h1 className="serif" style={{ fontSize: 38, fontWeight: 400 }}>{PROFILE.ens}</h1>
              <span className="tag">since {PROFILE.since}</span>
            </div>
            <div className="mono muted" style={{ fontSize: 12 }}>{PROFILE.address}</div>
          </div>
          <div className="col gap-2" style={{ alignItems: "flex-end" }}>
            <div className="eyebrow">Reputation</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="serif" style={{ fontSize: 64, lineHeight: 1, color: "var(--acc)" }}>
                {scoreNum !== undefined ? scoreNum : "…"}
              </span>
              <span className="muted">vote weight</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", marginTop: 32, paddingTop: 28, borderTop: "1px solid var(--line-soft)" }}>
          <div className="col gap-2">
            <div className="eyebrow">Won</div>
            <div className="num-xl">{PROFILE.won}</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Lost</div>
            <div className="num-xl">{PROFILE.lost}</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Win rate</div>
            <div className="num-xl" style={{ color: "var(--acc)" }}>{PROFILE.winRate}%</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Total staked</div>
            <div className="num-xl">Ξ {PROFILE.totalStaked.toFixed(1)}</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Net profit</div>
            <div className="num-xl" style={{ color: "var(--acc)" }}>+ Ξ {PROFILE.netProfit.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        <div className="col gap-4">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="h-2">My challenges</h2>
            <div className="segmented">
              {(["All", "Created", "Bet"] as Filter[]).map(f => (
                <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>id</th><th>title</th><th>role</th><th>state</th>
                  <th style={{ textAlign: "right" }}>P / L</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td><span className="mono dim">{c.id}</span></td>
                    <td style={{ fontWeight: 500 }}>{c.title}</td>
                    <td><span className="tag">{c.role}</span></td>
                    <td><span className={STATE_CLASS[c.state as ChallengeState]}>{STATE_LABEL[c.state as ChallengeState]}</span></td>
                    <td style={{ textAlign: "right" }}>
                      {c.pnl === null ? (
                        <span className="num" style={{ color: "var(--text-3)" }}>—</span>
                      ) : (
                        <span className="num" style={{ color: c.pnl >= 0 ? "var(--win)" : "var(--loss)" }}>
                          {c.pnl >= 0 ? "+" : ""}{c.pnl.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-4)" }}>No challenges for this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <div className="eyebrow">Reputation over time</div>
              <span className="num muted" style={{ fontSize: 12 }}>score: {scoreNum !== undefined ? scoreNum : "…"}</span>
            </div>
            <div style={{ height: 120 }}>
              <Sparkline points={REPUTATION_SPARKLINE} color="var(--acc)" />
            </div>
          </div>
        </div>

        <div className="col gap-4">
          <h2 className="h-2">Leaderboard</h2>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {(leaderboard.length > 0 ? leaderboard : LEADERBOARD).map((r, i, arr) => {
              const isMe = r.addr === PROFILE.ens;
              return (
                <div key={r.rank} style={{ padding: "16px 20px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-soft)" : "none", background: isMe ? "var(--acc-bg)" : "transparent" }}>
                  <div className="row gap-3" style={{ alignItems: "center" }}>
                    <span className="serif" style={{ fontSize: 24, color: r.rank <= 3 ? "var(--acc)" : "var(--text-3)", width: 28 }}>{r.rank}</span>
                    <span className="avatar" />
                    <div className="col gap-2 flex-1">
                      <span style={{ fontWeight: 500 }}>
                        {r.addr} {isMe && <span className="tag acc" style={{ marginLeft: 6 }}>you</span>}
                      </span>
                      <span className="muted" style={{ fontSize: 11 }}>{r.won}W · {r.lost}L · Ξ {r.ethWon} won</span>
                    </div>
                    <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                      <span className="num-lg" style={{ color: "var(--acc)" }}>{r.reputation}</span>
                      <span className="dim" style={{ fontSize: 10, fontFamily: "var(--f-mono)" }}>REP</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Reputation rules</div>
            <div className="col gap-3" style={{ fontSize: 13 }}>
              <div className="row gap-3"><span style={{ color: "var(--win)" }}>+5</span><span className="muted">won challenge</span></div>
              <div className="row gap-3"><span style={{ color: "var(--loss)" }}>−2</span><span className="muted">failed challenge</span></div>
              <div className="row gap-3"><span style={{ color: "var(--win)" }}>+1</span><span className="muted">winning bet on individual</span></div>
              <div className="row gap-3"><span style={{ color: "var(--text-3)" }}>×100</span><span className="muted">max governance vote weight</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
