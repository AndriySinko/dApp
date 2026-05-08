export default function PublicPage() {
  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div className="page-head">
        <div>
          <div className="row gap-3" style={{ marginBottom: 12 }}>
            <span className="eyebrow">{`{ governance · epoch #14 }`}</span>
            <span className="status-dot warn"></span>
            <span className="muted" style={{ fontSize: 12 }}>tickEpoch in 2d 14h</span>
          </div>
          <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: "-0.02em" }}>Vote the next public challenge.</h1>
          <p style={{ marginTop: 14, color: "var(--text-2)", fontSize: 15, maxWidth: 640, lineHeight: 1.55 }}>
            Admin proposes. Community votes — weighted by reputation, capped at 100×.
            The leading proposal at epoch end is auto-deployed by the factory and funded
            from the treasury prize pool.
          </p>
        </div>
      </div>

      {/* epoch summary */}
      <div className="card" style={{ padding: 28, marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div style={{ paddingRight: 28, borderRight: "1px solid var(--line-soft)" }}>
            <div className="col gap-2">
              <div className="eyebrow">Active proposals</div>
              <div className="num-xl">3</div>
            </div>
          </div>
          <div style={{ padding: "0 28px", borderRight: "1px solid var(--line-soft)" }}>
            <div className="col gap-2">
              <div className="eyebrow">Total vote weight</div>
              <div className="num-xl">2,793</div>
              <div className="muted" style={{ fontSize: 12 }}>across all proposals</div>
            </div>
          </div>
          <div style={{ padding: "0 28px", borderRight: "1px solid var(--line-soft)" }}>
            <div className="col gap-2">
              <div className="eyebrow">Your vote weight</div>
              <div className="num-xl" style={{ color: "var(--acc)" }}>×87</div>
              <div className="muted" style={{ fontSize: 12 }}>from reputation</div>
            </div>
          </div>
          <div style={{ paddingLeft: 28 }}>
            <div className="col gap-2">
              <div className="eyebrow">Prize pool</div>
              <div className="num-xl" style={{ color: "var(--acc)" }}>Ξ 1.40</div>
              <div className="muted" style={{ fontSize: 12 }}>auto-funds winner</div>
            </div>
          </div>
        </div>
      </div>

      {/* proposals */}
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="h-2">Open proposals</h2>
        <span className="muted mono" style={{ fontSize: 12 }}>one vote per address per epoch</span>
      </div>
      <div className="col gap-3">
        {/* P-009 — leading */}
        <div className="card" style={{ padding: 24, position: "relative", borderColor: "rgba(212,255,61,0.3)" }}>
          <div className="tag acc" style={{ position: "absolute", top: -10, left: 24 }}>● Leading</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32, alignItems: "start" }}>
            <div className="col gap-3">
              <div className="row gap-3" style={{ flexWrap: "wrap" }}>
                <span className="tag">P-009</span>
                <span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◇</span> API Oracle</span>
                <span className="tag">14 days</span>
                <span className="tag">min Ξ 0.05</span>
              </div>
              <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>Public Hack-a-thon: ship 1 demo each</h3>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 560 }}>Group challenge for hackathon participants. Each submits a working demo URL by deadline. Winners split losing pool + 2 ETH from treasury.</p>
              <div className="row gap-3" style={{ fontSize: 12 }}>
                <span className="avatar sm"></span>
                <span>proposed by</span>
                <span className="mono" style={{ color: "var(--text-2)" }}>admin.pact</span>
              </div>
            </div>
            <div className="col gap-3">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="eyebrow">votes</span>
                <span className="num" style={{ fontSize: 13 }}>44.6%</span>
              </div>
              <div className="num-xl">1,247</div>
              <div className="muted" style={{ fontSize: 11 }}>89 voters</div>
              <div className="bar"><div className="bar-fill" style={{ width: "44.6%" }}></div></div>
              <button className="btn primary" style={{ marginTop: 8, justifyContent: "center" }}>Vote with weight ×87</button>
            </div>
          </div>
        </div>

        {/* P-008 */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32, alignItems: "start" }}>
            <div className="col gap-3">
              <div className="row gap-3" style={{ flexWrap: "wrap" }}>
                <span className="tag">P-008</span>
                <span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◈</span> AI Oracle</span>
                <span className="tag">21 days</span>
                <span className="tag">min Ξ 0.02</span>
              </div>
              <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>Daily meditation, 21 days, photo+nonce</h3>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 560 }}>AI Oracle challenge. Daily evidence: photo of yourself meditating with daily nonce visible. Bonus to streaks.</p>
              <div className="row gap-3" style={{ fontSize: 12 }}>
                <span className="avatar sm"></span>
                <span>proposed by</span>
                <span className="mono" style={{ color: "var(--text-2)" }}>admin.pact</span>
              </div>
            </div>
            <div className="col gap-3">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="eyebrow">votes</span>
                <span className="num" style={{ fontSize: 13 }}>33.4%</span>
              </div>
              <div className="num-xl">932</div>
              <div className="muted" style={{ fontSize: 11 }}>71 voters</div>
              <div className="bar"><div className="bar-fill" style={{ width: "33.4%" }}></div></div>
              <button className="btn primary" style={{ marginTop: 8, justifyContent: "center" }}>Vote with weight ×87</button>
            </div>
          </div>
        </div>

        {/* P-007 */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32, alignItems: "start" }}>
            <div className="col gap-3">
              <div className="row gap-3" style={{ flexWrap: "wrap" }}>
                <span className="tag">P-007</span>
                <span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◆</span> On-chain</span>
                <span className="tag">90 days</span>
                <span className="tag">min Ξ 0.10</span>
              </div>
              <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>HODL ≥ 1 ETH through Q1</h3>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 560 }}>On-chain verified. 90 days, no minimum participants, balance check at deadline.</p>
              <div className="row gap-3" style={{ fontSize: 12 }}>
                <span className="avatar sm"></span>
                <span>proposed by</span>
                <span className="mono" style={{ color: "var(--text-2)" }}>admin.pact</span>
              </div>
            </div>
            <div className="col gap-3">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="eyebrow">votes</span>
                <span className="num" style={{ fontSize: 13 }}>22.0%</span>
              </div>
              <div className="num-xl">614</div>
              <div className="muted" style={{ fontSize: 11 }}>52 voters</div>
              <div className="bar"><div className="bar-fill" style={{ width: "22%" }}></div></div>
              <button className="btn primary" style={{ marginTop: 8, justifyContent: "center" }}>Vote with weight ×87</button>
            </div>
          </div>
        </div>
      </div>

      {/* recent epochs */}
      <div style={{ marginTop: 56 }}>
        <h2 className="h-2" style={{ marginBottom: 16 }}>Recent epochs</h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>epoch</th>
                <th>winning proposal</th>
                <th>verifier</th>
                <th style={{ textAlign: "right" }}>votes</th>
                <th style={{ textAlign: "right" }}>prize pool</th>
                <th style={{ textAlign: "right" }}>outcome</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="mono dim">#13</span></td>
                <td>Daily walk 30k steps</td>
                <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◇</span> API Oracle</span></td>
                <td style={{ textAlign: "right" }} className="num">1,402</td>
                <td style={{ textAlign: "right" }} className="num">Ξ 1.20</td>
                <td style={{ textAlign: "right" }} className="muted">23 / 27 won</td>
              </tr>
              <tr>
                <td><span className="mono dim">#12</span></td>
                <td>HODL ≥ 0.25 ETH for 30d</td>
                <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◆</span> On-chain</span></td>
                <td style={{ textAlign: "right" }} className="num">983</td>
                <td style={{ textAlign: "right" }} className="num">Ξ 0.80</td>
                <td style={{ textAlign: "right" }} className="muted">47 / 47 won</td>
              </tr>
              <tr>
                <td><span className="mono dim">#11</span></td>
                <td>5 books in 30 days</td>
                <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◈</span> AI Oracle</span></td>
                <td style={{ textAlign: "right" }} className="num">742</td>
                <td style={{ textAlign: "right" }} className="num">Ξ 0.60</td>
                <td style={{ textAlign: "right" }} className="muted">11 / 18 won</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
