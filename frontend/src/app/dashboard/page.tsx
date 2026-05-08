import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="container fade-in" style={{ paddingTop: 56, paddingBottom: 80 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{`{ all challenges }`}</div>
          <h1 className="h-1 serif" style={{ fontSize: 56, fontWeight: 400 }}>Markets &amp; commitments</h1>
        </div>
        <div className="row gap-3">
          <Link href="/create" className="btn primary">+ New challenge</Link>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <div className="row gap-4">
          <div className="segmented">
            <button className="active">All</button>
            <button>Live</button>
            <button>Settled</button>
          </div>
          <div className="segmented">
            <button className="active">Any type</button>
            <button>Individual</button>
            <button>Group</button>
            <button>Public</button>
          </div>
        </div>
        <div className="row gap-3 muted" style={{ fontSize: 12, fontFamily: "var(--f-mono)" }}>
          6 results · sorted by activity
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>id</th>
              <th>title</th>
              <th>type</th>
              <th>verifier</th>
              <th>state</th>
              <th style={{ textAlign: "right" }}>pool split / size</th>
              <th style={{ textAlign: "right" }}>tvl</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="mono dim" style={{ fontSize: 11 }}>C-0142</span></td>
              <td>
                <div className="col gap-2">
                  <div style={{ fontWeight: 500 }}>Run 50km in 7 days</div>
                  <div className="row gap-3 muted" style={{ fontSize: 12 }}>
                    <span>by <span style={{ color: "var(--text-2)" }}>alex.eth</span></span>
                    <span>·</span>
                    <span>in 6d 14h</span>
                  </div>
                </div>
              </td>
              <td><span className="tag">Individual</span></td>
              <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◇</span> API Oracle</span></td>
              <td><span className="tag acc">Bet Open</span></td>
              <td style={{ textAlign: "right" }}>
                <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                  <div className="num" style={{ fontSize: 13 }}>
                    <span style={{ color: "var(--win)" }}>41%</span>
                    <span className="dim"> / </span>
                    <span style={{ color: "var(--loss)" }}>59%</span>
                  </div>
                  <div className="bar split" style={{ width: 80 }}>
                    <div className="for" style={{ width: "41%" }}></div>
                    <div className="against" style={{ width: "59%" }}></div>
                  </div>
                </div>
              </td>
              <td style={{ width: 110, textAlign: "right" }}><div className="num" style={{ fontSize: 14 }}>Ξ 2.40</div></td>
            </tr>
            <tr>
              <td><span className="mono dim" style={{ fontSize: 11 }}>C-0141</span></td>
              <td>
                <div className="col gap-2">
                  <div style={{ fontWeight: 500 }}>Ship 5 PRs to my OSS lib this week</div>
                  <div className="row gap-3 muted" style={{ fontSize: 12 }}>
                    <span>by <span style={{ color: "var(--text-2)" }}>vix.eth</span></span>
                    <span>·</span>
                    <span>ends in 1d 8h</span>
                  </div>
                </div>
              </td>
              <td><span className="tag">Individual</span></td>
              <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◇</span> API Oracle</span></td>
              <td><span className="tag acc">Active</span></td>
              <td style={{ textAlign: "right" }}>
                <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                  <div className="num" style={{ fontSize: 13 }}>
                    <span style={{ color: "var(--win)" }}>31%</span>
                    <span className="dim"> / </span>
                    <span style={{ color: "var(--loss)" }}>69%</span>
                  </div>
                  <div className="bar split" style={{ width: 80 }}>
                    <div className="for" style={{ width: "31%" }}></div>
                    <div className="against" style={{ width: "69%" }}></div>
                  </div>
                </div>
              </td>
              <td style={{ width: 110, textAlign: "right" }}><div className="num" style={{ fontSize: 14 }}>Ξ 1.57</div></td>
            </tr>
            <tr>
              <td><span className="mono dim" style={{ fontSize: 11 }}>C-0140</span></td>
              <td>
                <div className="col gap-2">
                  <div style={{ fontWeight: 500 }}>Daily gym for 30 days</div>
                  <div className="row gap-3 muted" style={{ fontSize: 12 }}>
                    <span>by <span style={{ color: "var(--text-2)" }}>ren.eth</span></span>
                    <span>·</span>
                    <span>12 / 30 days complete</span>
                  </div>
                </div>
              </td>
              <td><span className="tag">Group</span></td>
              <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◈</span> AI Oracle</span></td>
              <td><span className="tag acc">Active</span></td>
              <td style={{ textAlign: "right" }}>
                <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                  <div className="num" style={{ fontSize: 13 }}>14 <span className="dim">/ stakers</span></div>
                </div>
              </td>
              <td style={{ width: 110, textAlign: "right" }}><div className="num" style={{ fontSize: 14 }}>Ξ 4.20</div></td>
            </tr>
            <tr>
              <td><span className="mono dim" style={{ fontSize: 11 }}>C-0139</span></td>
              <td>
                <div className="col gap-2">
                  <div style={{ fontWeight: 500 }}>HODL ≥ 0.5 ETH for 30 days</div>
                  <div className="row gap-3 muted" style={{ fontSize: 12 }}>
                    <span>by <span style={{ color: "var(--text-2)" }}>factory.eth</span></span>
                    <span>·</span>
                    <span>stake closes in 4h</span>
                  </div>
                </div>
              </td>
              <td><span className="tag">Group</span></td>
              <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◆</span> On-chain</span></td>
              <td><span className="tag warn">Stake Lock</span></td>
              <td style={{ textAlign: "right" }}>
                <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                  <div className="num" style={{ fontSize: 13 }}>47 <span className="dim">/ stakers</span></div>
                </div>
              </td>
              <td style={{ width: 110, textAlign: "right" }}><div className="num" style={{ fontSize: 14 }}>Ξ 23.50</div></td>
            </tr>
            <tr>
              <td><span className="mono dim" style={{ fontSize: 11 }}>C-0138</span></td>
              <td>
                <div className="col gap-2">
                  <div style={{ fontWeight: 500 }}>Public: 100 commits this month</div>
                  <div className="row gap-3 muted" style={{ fontSize: 12 }}>
                    <span>by <span style={{ color: "var(--text-2)" }}>admin</span></span>
                    <span>·</span>
                    <span>joins close in 2d</span>
                  </div>
                </div>
              </td>
              <td><span className="tag">Public</span></td>
              <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◇</span> API Oracle</span></td>
              <td><span className="tag acc">Join Open</span></td>
              <td style={{ textAlign: "right" }}>
                <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                  <div className="num" style={{ fontSize: 13 }}>23 <span className="dim">/ stakers</span></div>
                </div>
              </td>
              <td style={{ width: 110, textAlign: "right" }}><div className="num" style={{ fontSize: 14 }}>Ξ 6.90</div></td>
            </tr>
            <tr>
              <td><span className="mono dim" style={{ fontSize: 11 }}>C-0137</span></td>
              <td>
                <div className="col gap-2">
                  <div style={{ fontWeight: 500 }}>Read 4 books in November</div>
                  <div className="row gap-3 muted" style={{ fontSize: 12 }}>
                    <span>by <span style={{ color: "var(--text-2)" }}>lyra.eth</span></span>
                    <span>·</span>
                    <span>settled</span>
                  </div>
                </div>
              </td>
              <td><span className="tag">Individual</span></td>
              <td><span className="tag" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--acc)" }}>◈</span> AI Oracle</span></td>
              <td><span className="tag">Settled</span></td>
              <td style={{ textAlign: "right" }}>
                <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                  <div className="num" style={{ fontSize: 13 }}>
                    <span style={{ color: "var(--win)" }}>29%</span>
                    <span className="dim"> / </span>
                    <span style={{ color: "var(--loss)" }}>71%</span>
                  </div>
                  <div className="bar split" style={{ width: 80 }}>
                    <div className="for" style={{ width: "29%" }}></div>
                    <div className="against" style={{ width: "71%" }}></div>
                  </div>
                </div>
              </td>
              <td style={{ width: 110, textAlign: "right" }}><div className="num" style={{ fontSize: 14 }}>Ξ 0.73</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
