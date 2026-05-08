import Link from "next/link";
import { Donut, Sparkline } from "@/components/ui";

export default function ChallengePage() {
  return (
    <div className="container-wide fade-in" style={{ paddingTop: 32, paddingBottom: 80 }}>
      {/* breadcrumb */}
      <div className="row gap-2 muted" style={{ fontSize: 12, marginBottom: 24, fontFamily: "var(--f-mono)" }}>
        <Link href="/dashboard" className="dim">← challenges</Link>
        <span className="dim">/</span>
        <span>C-0142</span>
      </div>

      {/* header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div className="row gap-2" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <span className="tag">Individual</span>
            <span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◇</span> API Oracle</span>
            <span className="tag acc">Bet Open</span>
            <span className="tag">C-0142</span>
          </div>
          <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 16 }}>Run 50km in 7 days</h1>
          <div className="row gap-3" style={{ fontSize: 13 }}>
            <span className="avatar sm"></span>
            <span>by <span style={{ color: "var(--text)" }}>alex.eth</span></span>
            <span className="dim">·</span>
            <span className="chip">0x7A4f...3eD2</span>
            <span className="dim">·</span>
            <span className="muted">in 6d 14h</span>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn sm">⌥ share</button>
          <button className="btn sm">↗ Etherscan</button>
        </div>
      </div>

      {/* main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        {/* LEFT */}
        <div className="col gap-4">
          {/* market headline */}
          <div className="card" style={{ padding: 28 }}>
            <div className="row gap-6" style={{ alignItems: "center", marginBottom: 24 }}>
              <Donut pct={41} color="var(--win)" size={120} stroke={12} />
              <div className="col gap-2 flex-1">
                <div className="eyebrow">Implied probability of success</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span className="serif" style={{ fontSize: 80, lineHeight: 1, color: "var(--win)" }}>41%</span>
                  <span className="muted">FOR</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>6 bettors backing · 11 fading</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden", minWidth: 280 }}>
                <div style={{ padding: 14, background: "var(--bg)" }}>
                  <div className="eyebrow" style={{ color: "var(--win)" }}>FOR</div>
                  <div className="num-lg" style={{ marginTop: 4 }}>Ξ 0.78</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>1.62× payout</div>
                </div>
                <div style={{ padding: 14, background: "var(--bg)" }}>
                  <div className="eyebrow" style={{ color: "var(--loss)" }}>AGAINST</div>
                  <div className="num-lg" style={{ marginTop: 4 }}>Ξ 1.12</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>2.42× payout</div>
                </div>
              </div>
            </div>
            <div className="bar split">
              <div className="for" style={{ width: "41%" }}></div>
              <div className="against" style={{ width: "59%" }}></div>
            </div>
          </div>

          {/* tabs */}
          <div className="row gap-6" style={{ borderBottom: "1px solid var(--line-soft)" }}>
            <button style={{ padding: "12px 0", borderBottom: "1px solid var(--text)", color: "var(--text)", fontSize: 13, fontWeight: 500, marginBottom: -1 }}>Market</button>
            <button style={{ padding: "12px 0", borderBottom: "1px solid transparent", color: "var(--text-3)", fontSize: 13, fontWeight: 500, marginBottom: -1 }}>Details</button>
            <button style={{ padding: "12px 0", borderBottom: "1px solid transparent", color: "var(--text-3)", fontSize: 13, fontWeight: 500, marginBottom: -1 }}>Verifier</button>
            <button style={{ padding: "12px 0", borderBottom: "1px solid transparent", color: "var(--text-3)", fontSize: 13, fontWeight: 500, marginBottom: -1 }}>On-chain trail</button>
          </div>

          {/* market tab content */}
          <div className="col gap-4">
            <div className="card" style={{ padding: 24 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <div className="eyebrow">FOR probability · 24h</div>
                <div className="segmented">
                  <button className="active">24h</button>
                  <button>7d</button>
                  <button>all</button>
                </div>
              </div>
              <div style={{ height: 220 }}>
                <Sparkline points={[52, 54, 49, 47, 50, 48, 46, 45, 43, 41, 42, 41]} color="var(--win)" />
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
                <div className="eyebrow">Recent bets</div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>when</th>
                    <th>side</th>
                    <th>bettor</th>
                    <th style={{ textAlign: "right" }}>amount</th>
                    <th style={{ textAlign: "right" }}>tx</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="mono dim">−5h</span></td>
                    <td><span className="tag loss">AGAINST</span></td>
                    <td><div className="row gap-2"><span className="avatar sm"></span><span className="mono">0x4f...91</span></div></td>
                    <td style={{ textAlign: "right" }}><span className="num">Ξ 0.12</span></td>
                    <td style={{ textAlign: "right" }}><span className="dim">↗</span></td>
                  </tr>
                  <tr>
                    <td><span className="mono dim">−2h</span></td>
                    <td><span className="tag win">FOR</span></td>
                    <td><div className="row gap-2"><span className="avatar sm"></span><span className="mono">0xa1...22</span></div></td>
                    <td style={{ textAlign: "right" }}><span className="num">Ξ 0.05</span></td>
                    <td style={{ textAlign: "right" }}><span className="dim">↗</span></td>
                  </tr>
                  <tr>
                    <td><span className="mono dim">−47m</span></td>
                    <td><span className="tag loss">AGAINST</span></td>
                    <td><div className="row gap-2"><span className="avatar sm"></span><span className="mono">0x9e...0c</span></div></td>
                    <td style={{ textAlign: "right" }}><span className="num">Ξ 0.08</span></td>
                    <td style={{ textAlign: "right" }}><span className="dim">↗</span></td>
                  </tr>
                  <tr>
                    <td><span className="mono dim">−12m</span></td>
                    <td><span className="tag win">FOR</span></td>
                    <td><div className="row gap-2"><span className="avatar sm"></span><span className="mono">0xb2...4f</span></div></td>
                    <td style={{ textAlign: "right" }}><span className="num">Ξ 0.20</span></td>
                    <td style={{ textAlign: "right" }}><span className="dim">↗</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT — bet panel */}
        <div className="col gap-4" style={{ position: "sticky", top: 80, alignSelf: "flex-start" }}>
          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Place a bet</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              <button className="btn" style={{ flexDirection: "column", padding: 16, gap: 4, background: "var(--win-bg)", borderColor: "var(--win)", color: "var(--win)" }}>
                <span className="eyebrow" style={{ color: "inherit" }}>FOR</span>
                <span className="num-lg" style={{ color: "inherit" }}>1.62×</span>
              </button>
              <button className="btn" style={{ flexDirection: "column", padding: 16, gap: 4, color: "var(--text-2)" }}>
                <span className="eyebrow" style={{ color: "inherit" }}>AGAINST</span>
                <span className="num-lg" style={{ color: "inherit" }}>2.42×</span>
              </button>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Amount (ETH)</label>
              <input className="input" defaultValue="0.10" placeholder="0.00" />
            </div>
            <div className="row gap-2" style={{ marginBottom: 18 }}>
              <button className="btn sm">0.05</button>
              <button className="btn sm">0.10</button>
              <button className="btn sm">0.25</button>
              <button className="btn sm">max</button>
            </div>

            <div className="dots" style={{ marginBottom: 14 }}></div>
            <div className="col gap-2" style={{ fontSize: 12.5 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Side</span>
                <span style={{ color: "var(--win)" }}>FOR</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Stake</span>
                <span className="num">Ξ 0.10</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Payout if you win</span>
                <span className="num" style={{ color: "var(--acc)" }}>Ξ 0.162</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Protocol fee</span>
                <span className="dim">2% of losing pool</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Gas (est)</span>
                <span className="dim mono">~0.0008</span>
              </div>
            </div>
            <button className="btn primary lg" style={{ width: "100%", marginTop: 18, justifyContent: "center" }}>
              Bet Ξ 0.10 FOR
            </button>
            <div className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 10, fontFamily: "var(--f-mono)" }}>
              AGAINST cap: Ξ 2.50 (45% used)
            </div>
          </div>

          <div className="card" style={{ padding: 20, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Contracts</div>
            <div className="col gap-2">
              <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">challenge</span><span>0xC...0142</span></div>
              <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">verifier</span><span>0xV...API_</span></div>
              <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">treasury</span><span>0xT...0002</span></div>
              <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">factory</span><span>0xF...0001</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
