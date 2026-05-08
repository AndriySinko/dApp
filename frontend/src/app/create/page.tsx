import Link from "next/link";

export default function CreatePage() {
  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 1080 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{`{ new challenge }`}</div>
          <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: "-0.02em" }}>Put it on-chain.</h1>
        </div>
        <div className="row gap-3">
          <Link href="/dashboard" className="btn ghost">Cancel</Link>
        </div>
      </div>

      {/* stepper */}
      <div className="row" style={{ marginBottom: 40 }}>
        <button className="row gap-3" style={{ background: "none", padding: 0 }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--f-mono)", fontSize: 12, background: "var(--acc)", color: "#0b0b0c", border: "1px solid var(--acc)" }}>1</span>
          <span style={{ fontSize: 13 }}>Type</span>
        </button>
        <div style={{ flex: 1, height: 1, background: "var(--line)", margin: "0 16px" }}></div>
        <button className="row gap-3" style={{ background: "none", padding: 0 }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--f-mono)", fontSize: 12, background: "var(--bg-2)", color: "var(--text-3)", border: "1px solid var(--line)" }}>2</span>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Verification</span>
        </button>
        <div style={{ flex: 1, height: 1, background: "var(--line)", margin: "0 16px" }}></div>
        <button className="row gap-3" style={{ background: "none", padding: 0 }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--f-mono)", fontSize: 12, background: "var(--bg-2)", color: "var(--text-3)", border: "1px solid var(--line)" }}>3</span>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Stakes &amp; deadlines</span>
        </button>
        <div style={{ flex: 1, height: 1, background: "var(--line)", margin: "0 16px" }}></div>
        <button className="row gap-3" style={{ background: "none", padding: 0 }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--f-mono)", fontSize: 12, background: "var(--bg-2)", color: "var(--text-3)", border: "1px solid var(--line)" }}>4</span>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Review &amp; deploy</span>
        </button>
      </div>

      <div className="card" style={{ padding: 36 }}>
        <div className="h-2 serif" style={{ fontSize: 28, marginBottom: 24 }}>Choose challenge type</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {/* Individual — selected */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, borderColor: "var(--acc)", background: "var(--acc-bg)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="serif" style={{ fontSize: 22 }}>Individual</span>
              <span style={{ color: "var(--acc)" }}>●</span>
            </div>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>One commits, outsiders bet FOR or AGAINST.</span>
          </div>
          {/* Group */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="serif" style={{ fontSize: 22 }}>Group</span>
            </div>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Many participants, same goal. Winners split losers&apos; pool.</span>
          </div>
          {/* Public */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="serif" style={{ fontSize: 22 }}>Public</span>
            </div>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Admin-proposed, community-voted. Augmented by treasury prize pool.</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 32, justifyContent: "flex-end" }}>
          <button className="btn primary">Continue →</button>
        </div>
      </div>
    </div>
  );
}
