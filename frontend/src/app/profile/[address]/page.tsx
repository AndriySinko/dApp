import { Sparkline } from "@/components/ui";

export default function ProfilePage() {
  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      {/* hero */}
      <div className="card" style={{ padding: 36, marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "center" }}>
          <span className="avatar lg"></span>
          <div className="col gap-2">
            <div className="row gap-3">
              <h1 className="serif" style={{ fontSize: 38, fontWeight: 400 }}>alex.eth</h1>
              <span className="tag">since 2025-09-12</span>
            </div>
            <div className="mono muted" style={{ fontSize: 12 }}>0x7A4f9b8c3D1e2F4a5B6c7D8e9F0a1B2c3D4e3eD2</div>
          </div>
          <div className="col gap-2" style={{ alignItems: "flex-end" }}>
            <div className="eyebrow">Reputation</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="serif" style={{ fontSize: 64, lineHeight: 1, color: "var(--acc)" }}>87</span>
              <span className="muted">vote weight</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", marginTop: 32, paddingTop: 28, borderTop: "1px solid var(--line-soft)" }}>
          <div className="col gap-2">
            <div className="eyebrow">Won</div>
            <div className="num-xl">14</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Lost</div>
            <div className="num-xl">3</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Win rate</div>
            <div className="num-xl" style={{ color: "var(--acc)" }}>82%</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Total staked</div>
            <div className="num-xl">Ξ 4.2</div>
          </div>
          <div className="col gap-2">
            <div className="eyebrow">Net profit</div>
            <div className="num-xl" style={{ color: "var(--acc)" }}>+ Ξ 2.33</div>
          </div>
        </div>
      </div>

      {/* main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        <div className="col gap-4">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="h-2">My challenges</h2>
            <div className="segmented">
              <button className="active">All</button>
              <button>Created</button>
              <button>Bet</button>
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
                <tr>
                  <td><span className="mono dim">C-0142</span></td>
                  <td style={{ fontWeight: 500 }}>Run 50km in 7 days</td>
                  <td><span className="tag">creator</span></td>
                  <td><span className="tag acc">Bet Open</span></td>
                  <td style={{ textAlign: "right" }}><span className="num" style={{ color: "var(--text-3)" }}>—</span></td>
                </tr>
                <tr>
                  <td><span className="mono dim">C-0140</span></td>
                  <td style={{ fontWeight: 500 }}>Daily gym for 30 days</td>
                  <td><span className="tag">participant</span></td>
                  <td><span className="tag acc">Active</span></td>
                  <td style={{ textAlign: "right" }}><span className="num" style={{ color: "var(--text-3)" }}>—</span></td>
                </tr>
                <tr>
                  <td><span className="mono dim">C-0136</span></td>
                  <td style={{ fontWeight: 500 }}>Read 4 books in November</td>
                  <td><span className="tag">FOR bettor</span></td>
                  <td><span className="tag">Settled</span></td>
                  <td style={{ textAlign: "right" }}><span className="num" style={{ color: "var(--win)" }}>+0.41</span></td>
                </tr>
                <tr>
                  <td><span className="mono dim">C-0131</span></td>
                  <td style={{ fontWeight: 500 }}>100km cycling</td>
                  <td><span className="tag">creator</span></td>
                  <td><span className="tag">Settled</span></td>
                  <td style={{ textAlign: "right" }}><span className="num" style={{ color: "var(--win)" }}>+0.62</span></td>
                </tr>
                <tr>
                  <td><span className="mono dim">C-0128</span></td>
                  <td style={{ fontWeight: 500 }}>10 PRs in a month</td>
                  <td><span className="tag">AGAINST bettor</span></td>
                  <td><span className="tag">Settled</span></td>
                  <td style={{ textAlign: "right" }}><span className="num" style={{ color: "var(--loss)" }}>−0.15</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <div className="eyebrow">Reputation over time</div>
              <span className="num muted" style={{ fontSize: 12 }}>+87 since Sep</span>
            </div>
            <div style={{ height: 120 }}>
              <Sparkline points={[0, 5, 8, 12, 18, 24, 21, 28, 36, 42, 51, 58, 64, 71, 78, 87]} color="var(--acc)" />
            </div>
          </div>
        </div>

        <div className="col gap-4">
          <h2 className="h-2">Leaderboard</h2>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {[
              { rank: 1, addr: "ren.eth", rep: 412, w: 38, l: 4, won: 14.2, isMe: false },
              { rank: 2, addr: "vix.eth", rep: 289, w: 22, l: 6, won: 8.4, isMe: false },
              { rank: 3, addr: "lyra.eth", rep: 211, w: 17, l: 3, won: 6.1, isMe: false },
              { rank: 4, addr: "0xb2...4f", rep: 187, w: 19, l: 8, won: 5.5, isMe: false },
              { rank: 5, addr: "alex.eth", rep: 87, w: 14, l: 3, won: 2.83, isMe: true },
            ].map((r, i, arr) => (
              <div key={r.rank} style={{ padding: "16px 20px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-soft)" : "none", background: r.isMe ? "var(--acc-bg)" : "transparent" }}>
                <div className="row gap-3" style={{ alignItems: "center" }}>
                  <span className="serif" style={{ fontSize: 24, color: r.rank <= 3 ? "var(--acc)" : "var(--text-3)", width: 28 }}>{r.rank}</span>
                  <span className="avatar"></span>
                  <div className="col gap-2 flex-1">
                    <span style={{ fontWeight: 500 }}>
                      {r.addr} {r.isMe && <span className="tag acc" style={{ marginLeft: 6 }}>you</span>}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}>{r.w}W · {r.l}L · Ξ {r.won} won</span>
                  </div>
                  <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                    <span className="num-lg" style={{ color: "var(--acc)" }}>{r.rep}</span>
                    <span className="dim" style={{ fontSize: 10, fontFamily: "var(--f-mono)" }}>REP</span>
                  </div>
                </div>
              </div>
            ))}
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
