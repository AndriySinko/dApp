"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { STATE_CLASS, STATE_LABEL } from "@/lib/utils";
import type { ChallengeState } from "@/lib/types";
import { useReputation } from "@/lib/hooks/useReputation";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { useUserChallenges } from "@/lib/hooks/useUserChallenges";

type Filter = "All" | "Created" | "Bet";

export default function ProfilePage() {
  const { address: urlAddress } = useParams<{ address: string }>();
  const profileAddress = urlAddress as `0x${string}`;
  const { address: connectedAddress, isConnected } = useAccount();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [mounted, setMounted] = useState(false);
  const wasConnected = useRef(false);
  useEffect(() => { setMounted(true); }, []);

  // Track if user was ever connected — only redirect if they disconnect, not on first visit
  useEffect(() => {
    if (isConnected) wasConnected.current = true;
  }, [isConnected]);

  useEffect(() => {
    if (!mounted) return;
    if (wasConnected.current && !isConnected) {
      router.push("/profile");
    }
  }, [isConnected, mounted, router]);



  const { scoreNum } = useReputation(profileAddress);
  const { leaderboard } = useLeaderboard();
  const { challenges: userChallenges, stats, isLoading: challengesLoading } = useUserChallenges(profileAddress);

  const isMe = mounted && connectedAddress?.toLowerCase() === profileAddress?.toLowerCase();
  const shortAddr = profileAddress
    ? `${profileAddress.slice(0, 6)}…${profileAddress.slice(-4)}`
    : "—";

  const [searchInput, setSearchInput] = useState("");
  const goToAddress = () => {
    const val = searchInput.trim();
    if (val.startsWith("0x") && val.length === 42) router.push(`/profile/${val}`);
  };

  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div className="row gap-2" style={{ marginBottom: 20 }}>
        <input
          className="input"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && goToAddress()}
          placeholder="Look up another address 0x…"
          style={{ maxWidth: 360 }}
        />
        <button className="btn sm" disabled={!searchInput.trim().startsWith("0x") || searchInput.trim().length !== 42} onClick={goToAddress}>View →</button>
        {!isMe && <Link href="/profile" className="btn sm ghost">← Back</Link>}
      </div>
      <div className="card" style={{ padding: 36, marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "center" }}>
          <span className="avatar lg" />
          <div className="col gap-2">
            <div className="row gap-3">
              <h1 className="serif" style={{ fontSize: 38, fontWeight: 400 }}>
                {shortAddr}
                {isMe && <span className="tag acc" style={{ marginLeft: 12, fontSize: 14 }}>you</span>}
              </h1>
            </div>
            <div className="mono muted" style={{ fontSize: 12 }}>{profileAddress}</div>
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
          {[
            { label: "Won",          value: challengesLoading ? "…" : String(stats.won) },
            { label: "Lost",         value: challengesLoading ? "…" : String(stats.lost) },
            { label: "Win rate",     value: challengesLoading ? "…" : stats.winRate !== null ? `${stats.winRate}%` : "—" },
            { label: "Total staked", value: challengesLoading ? "…" : stats.totalStaked > 0 ? `${stats.totalStaked.toFixed(3)} ETH` : "—" },
            { label: "Net profit",   value: challengesLoading ? "…" : (stats.won > 0 || stats.lost > 0) ? `${stats.netProfit >= 0 ? "+" : ""}${stats.netProfit.toFixed(3)} ETH` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="col gap-2">
              <div className="eyebrow">{label}</div>
              <div className="num-xl" style={{ color: "var(--text-3)" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        <div className="col gap-4">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="h-2">{isMe ? "My challenges" : "Challenges"}</h2>
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
                {challengesLoading && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-4)" }}>Loading…</td></tr>
                )}
                {!challengesLoading && userChallenges.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-4)" }}>
                    {isMe ? "You haven't created or joined any challenges yet." : "No challenges found for this address."}
                  </td></tr>
                )}
                {userChallenges.map(c => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/challenge/${c.id}`}>
                    <td><span className="mono dim" style={{ fontSize: 11 }}>{c.id.slice(0, 6)}…{c.id.slice(-4)}</span></td>
                    <td style={{ fontWeight: 500 }}>{c.title}</td>
                    <td><span className="tag">{c.role}{c.side ? ` · ${c.side}` : ""}</span></td>
                    <td><span className="tag">{c.state.replace("_", " ")}</span></td>
                    <td style={{ textAlign: "right" }}>
                      {c.pnl === null ? (
                        <span className="num" style={{ color: "var(--text-3)" }}>—</span>
                      ) : (
                        <span className="num" style={{ color: c.pnl >= 0 ? "var(--win)" : "var(--loss)" }}>
                          {c.pnl >= 0 ? "+" : ""}{c.pnl.toFixed(3)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col gap-4">
          <h2 className="h-2">Leaderboard</h2>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {leaderboard.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>No data yet.</div>
            )}
            {leaderboard.map((r, i, arr) => {
              const isCurrentProfile = r.addr.toLowerCase() === profileAddress?.toLowerCase();
              return (
                <div key={r.rank} style={{ padding: "16px 20px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-soft)" : "none", background: isCurrentProfile ? "var(--acc-bg)" : "transparent" }}>
                  <div className="row gap-3" style={{ alignItems: "center" }}>
                    <span className="serif" style={{ fontSize: 24, color: r.rank <= 3 ? "var(--acc)" : "var(--text-3)", width: 28 }}>{r.rank}</span>
                    <span className="avatar" />
                    <div className="col gap-2 flex-1">
                      <span style={{ fontWeight: 500 }}>
                        {r.addr.slice(0, 6)}…{r.addr.slice(-4)}
                        {isCurrentProfile && <span className="tag acc" style={{ marginLeft: 6 }}>you</span>}
                      </span>
                      <span className="muted" style={{ fontSize: 11 }}>{r.won}W · {r.lost}L</span>
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
              <div className="row gap-3"><span style={{ color: "var(--win)" }}>+100</span><span className="muted">won challenge</span></div>
              <div className="row gap-3"><span style={{ color: "var(--loss)" }}>−50</span><span className="muted">failed challenge</span></div>
              <div className="row gap-3"><span style={{ color: "var(--win)" }}>+25</span><span className="muted">winning bet on individual</span></div>
              <div className="row gap-3"><span style={{ color: "var(--text-3)" }}>×100</span><span className="muted">max governance vote weight</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
