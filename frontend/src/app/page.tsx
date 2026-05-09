import Link from "next/link";
import { Sparkline } from "@/components/ui";
import { ACTIVITY, LANDING_SPARKLINE } from "@/lib/data";

export default function LandingPage() {
  return (
    <div className="fade-in">
      {/* HERO */}
      <section className="container" style={{ paddingTop: 90, paddingBottom: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 80, alignItems: "end" }}>
          <div>
            <div className="row gap-3" style={{ marginBottom: 24 }}>
              <span className="eyebrow">{`{ Sepolia testnet · v0.1.0 }`}</span>
              <span className="status-dot" />
              <span className="muted" style={{ fontSize: 12 }}>5 live challenges</span>
            </div>
            <h1 className="h-display serif">
              Promises<br />
              with <em>consequences.</em>
            </h1>
            <p style={{ marginTop: 32, fontSize: 17, color: "var(--text-2)", maxWidth: 540, lineHeight: 1.55 }}>
              PACT is a challenge protocol for putting goals on-chain. Stake ETH on yourself,
              let the world bet on whether you&apos;ll do it, and let an oracle decide. Three
              verification modes, one settlement engine.
            </p>
            <div className="row gap-3" style={{ marginTop: 36 }}>
              <Link href="/dashboard" className="btn primary lg">Browse challenges →</Link>
              <Link href="/create" className="btn lg ghost">Stake on yourself</Link>
            </div>
          </div>

          {/* receipt card */}
          <div className="card" style={{ padding: 0, overflow: "hidden", fontFamily: "var(--f-mono)", fontSize: 12 }}>
            <div className="row" style={{ padding: "12px 16px", borderBottom: "1px dashed var(--line)", justifyContent: "space-between" }}>
              <span className="dim">PACT::receipt</span>
              <span className="dim">#0142 / sepolia</span>
            </div>
            <div style={{ padding: 18 }}>
              <div className="col gap-3">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">type</span><span>INDIVIDUAL</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">verifier</span><span>API_ORACLE :: strava</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">commitment</span><span style={{ color: "var(--acc)" }}>50km / 7d</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">buy-in</span><span>0.5 ETH</span>
                </div>
                <div className="dots" style={{ margin: "4px 0" }} />
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">FOR pool</span>
                  <span style={{ color: "var(--win)" }}>0.78 ETH · 41%</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">AGAINST pool</span>
                  <span style={{ color: "var(--loss)" }}>1.12 ETH · 59%</span>
                </div>
                <div className="bar split" style={{ marginTop: 4 }}>
                  <div className="for" style={{ width: "41%" }} />
                  <div className="against" style={{ width: "59%" }} />
                </div>
                <div className="dots" style={{ margin: "4px 0" }} />
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">implied odds</span><span>2.42× / 1.62×</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="dim">verdict by</span><span>Dec 4, 18:00 UTC</span>
                </div>
              </div>
            </div>
            <div className="stripe-bg" style={{ padding: "10px 16px", fontSize: 10, color: "var(--text-4)", display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--line)" }}>
              <span>0x7A4f9b8c3D1e2F4a5B6c7D8e9F0a1B2c3D4e3eD2</span>
              <span>↗</span>
            </div>
          </div>
        </div>
      </section>

      {/* stats band */}
      <section style={{ borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-1)" }}>
        <div className="container" style={{ padding: "32px 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div style={{ paddingRight: 32, borderRight: "1px solid var(--line-soft)" }}>
              <div className="col gap-2">
                <div className="eyebrow">Total Value Staked</div>
                <div className="num-xl">Ξ 42.30</div>
                <div className="muted" style={{ fontSize: 12 }}>across all live challenges</div>
              </div>
            </div>
            <div style={{ padding: "0 32px", borderRight: "1px solid var(--line-soft)" }}>
              <div className="col gap-2">
                <div className="eyebrow">Active Challenges</div>
                <div className="num-xl">5</div>
                <div className="muted" style={{ fontSize: 12 }}>+ 1 settled</div>
              </div>
            </div>
            <div style={{ padding: "0 32px", borderRight: "1px solid var(--line-soft)" }}>
              <div className="col gap-2">
                <div className="eyebrow">Treasury Prize Pool</div>
                <div className="num-xl" style={{ color: "var(--acc)" }}>Ξ 1.40</div>
                <div className="muted" style={{ fontSize: 12 }}>for next public challenge</div>
              </div>
            </div>
            <div style={{ paddingLeft: 32 }}>
              <div className="col gap-2">
                <div className="eyebrow">Avg Settlement</div>
                <div className="num-xl">2.4 min</div>
                <div className="muted" style={{ fontSize: 12 }}>oracle callback latency</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="container" style={{ paddingTop: 100, paddingBottom: 80 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>01 — Architecture</div>
            <h2 className="h-1 serif" style={{ fontSize: 56, fontWeight: 400 }}>One protocol, three verifiers.</h2>
          </div>
          <p className="muted" style={{ maxWidth: 360, fontSize: 14 }}>
            Every challenge implements the same callback interface — the state machine doesn&apos;t care
            whether the verdict comes from a balance read, an API, or a vision model.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          {[
            { icon: "◆", n: "01", label: "On-chain", desc: "Reads ETH/ERC-20 balance at deadline. Fully trustless. Synchronous.", lines: ["read participant.balance", "require ≥ threshold", "sync receiveVerdict()"] },
            { icon: "◇", n: "02", label: "API Oracle", desc: "Chainlink Functions calls external API (GitHub, Strava, Spotify). Trust the API.", lines: ["_sendRequest(jsSrc, args)", "Functions.makeHttpRequest(api)", "fulfillRequest(reqId, response)", "async receiveVerdict()"] },
            { icon: "◈", n: "03", label: "AI Oracle", desc: "Photo evidence to IPFS, Gemini Vision classifies. Daily nonce prevents pre-stashing.", lines: ["evidence[ipfsCid] + dailyNonce", "Gemini Vision: criteria + nonce", "all_days_passed ? 1 : 0", "async receiveVerdict()"] },
          ].map(({ icon, n, label, desc, lines }) => (
            <div key={n} style={{ padding: 32, background: "var(--bg)" }}>
              <div className="row gap-3" style={{ marginBottom: 20 }}>
                <span style={{ color: "var(--acc)", fontSize: 28, fontFamily: "var(--f-mono)" }}>{icon}</span>
                <span className="mono dim" style={{ fontSize: 11 }}>{n}</span>
              </div>
              <div className="h-2 serif" style={{ fontSize: 28, marginBottom: 12 }}>{label}</div>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, marginBottom: 24 }}>{desc}</p>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--text-4)", lineHeight: 1.7 }}>
                {lines.map((l, i) => (
                  <div key={i}>
                    <span style={{ color: i === lines.length - 1 ? "var(--acc)" : "var(--text-4)" }}>
                      {i === lines.length - 1 ? "↳" : "→"}
                    </span>{" "}{l}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Individual spotlight */}
      <section style={{ background: "var(--bg-1)", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}>
        <div className="container" style={{ padding: "100px 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 80, alignItems: "center" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>02 — Individual Challenges</div>
              <h2 className="h-1 serif" style={{ fontSize: 56, fontWeight: 400, marginBottom: 24 }}>
                A market<br />for self-belief.
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: 16, lineHeight: 1.6, marginBottom: 28, maxWidth: 480 }}>
                When you stake on yourself, the world stakes against you. FOR bettors back you;
                AGAINST bettors fade you. Settlement pays winners proportionally from the losing pool —
                minus a 2% protocol fee.
              </p>
              <div className="col gap-3" style={{ fontFamily: "var(--f-mono)", fontSize: 12.5 }}>
                <div className="row gap-3"><span className="status-dot" />AGAINST pool capped at 5× buy-in</div>
                <div className="row gap-3"><span className="status-dot" />Bet window closes when challenge starts</div>
                <div className="row gap-3"><span className="status-dot" />Reentrancy-guarded settlement</div>
              </div>
              <Link href="/challenge/C-0142" className="btn primary" style={{ marginTop: 32, display: "inline-flex" }}>
                See live market →
              </Link>
            </div>

            <div className="card" style={{ padding: 28 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
                <div className="col">
                  <div className="eyebrow">C-0142</div>
                  <div className="serif" style={{ fontSize: 24, marginTop: 6 }}>Run 50km in 7 days</div>
                </div>
                <span className="tag acc">Bet Open</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                <div className="btn" style={{ flexDirection: "column", alignItems: "stretch", padding: 16, gap: 6, borderColor: "rgba(109,213,138,0.3)", background: "var(--win-bg)" }}>
                  <span className="eyebrow" style={{ color: "var(--win)" }}>FOR · 1.62×</span>
                  <span className="num-lg" style={{ color: "var(--win)" }}>41%</span>
                  <span className="muted" style={{ fontSize: 11 }}>Ξ 0.78 · 6 bettors</span>
                </div>
                <div className="btn" style={{ flexDirection: "column", alignItems: "stretch", padding: 16, gap: 6, borderColor: "rgba(255,107,107,0.3)", background: "var(--loss-bg)" }}>
                  <span className="eyebrow" style={{ color: "var(--loss)" }}>AGAINST · 2.42×</span>
                  <span className="num-lg" style={{ color: "var(--loss)" }}>59%</span>
                  <span className="muted" style={{ fontSize: 11 }}>Ξ 1.12 · 11 bettors</span>
                </div>
              </div>
              <div className="bar split" style={{ marginBottom: 14 }}>
                <div className="for" style={{ width: "41%" }} />
                <div className="against" style={{ width: "59%" }} />
              </div>
              <div style={{ height: 64, marginTop: 12 }}>
                <Sparkline points={LANDING_SPARKLINE} color="var(--win)" />
              </div>
              <div className="dots" style={{ margin: "16px 0" }} />
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span className="muted">Verdict by Dec 4 · 18:00 UTC</span>
                <span className="mono">Ξ 2.40 total</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* activity */}
      <section className="container" style={{ paddingTop: 80, paddingBottom: 100 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div className="row gap-3">
            <span className="status-dot" />
            <h2 className="h-2">Live activity</h2>
          </div>
          <Link href="/dashboard" className="btn ghost sm">View all →</Link>
        </div>
        <div className="card">
          {ACTIVITY.map((a, i) => (
            <div key={i} className="row" style={{ padding: "14px 20px", borderBottom: i < ACTIVITY.length - 1 ? "1px solid var(--line-soft)" : "none", justifyContent: "space-between", fontSize: 13 }}>
              <div className="row gap-3">
                <span className="mono dim" style={{ width: 40 }}>−{a.time}</span>
                <span className="avatar sm" />
                <span className="mono" style={{ color: "var(--text-2)" }}>{a.actor}</span>
                <span className="muted">{a.action}</span>
                <span className="chip">{a.target}</span>
              </div>
              <span className="dim mono" style={{ fontSize: 11 }}>tx ↗</span>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--line-soft)", padding: "40px 0", background: "var(--bg-1)" }}>
        <div className="container row" style={{ justifyContent: "space-between", fontSize: 12 }}>
          <div className="row gap-4">
            <span className="brand-mark" />
            <span className="muted">PACT Protocol · Sepolia testnet · academic build</span>
          </div>
          <div className="row gap-4 muted">
            <span>Factory: <span className="chip">0xPACT...0001</span></span>
            <span>Treasury: <span className="chip">0xPACT...0002</span></span>
            <span>Etherscan ↗</span>
            <span>GitHub ↗</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
