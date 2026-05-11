"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { useProtocolStats } from "@/lib/hooks/useProtocolStats";

// ── SpecimenReceipt ───────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    kind: "individual",
    tag: "INDIVIDUAL",
    id: "C-0xEXMP",
    commitment: "Run a sub-20:00 5k by Aug 31.",
    committer: "alex.eth",
    verifier: "API · strava.com",
    buyIn: "Ξ 0.25",
    deadline: "14d 06h",
    forPool: "Ξ 1.84",
    againstPool: "Ξ 0.52",
    forPct: 78,
    sparkPath: "M0,18 L8,17 L16,15 L24,16 L32,12 L40,10 L48,11 L56,8 L64,9 L72,6 L80,5 L88,7 L96,4",
  },
  {
    kind: "group",
    tag: "GROUP",
    id: "C-0xGRP",
    commitment: "Read 12 books before year-end.",
    committer: "8 of 12 participants",
    verifier: "AI Oracle · photo evidence",
    buyIn: "Ξ 0.10 ea",
    deadline: "62d 04h",
    stakePool: "Ξ 0.80",
    filled: 8, total: 12,
  },
  {
    kind: "community",
    tag: "PUBLIC",
    id: "P-0042",
    commitment: "Ship 100 open-source PRs in 30 days.",
    committer: "vote-elected · epoch #14",
    verifier: "API · github.com",
    buyIn: "Ξ 0.05 ea",
    deadline: "29d 18h",
    stakePool: "Ξ 2.40",
    treasury: "Ξ 5.00",
    participants: 48,
  },
] as const;

function SpecimenReceipt() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const tick = setInterval(() => {
      setPhase("out");
      setTimeout(() => {
        setIdx(n => (n + 1) % EXAMPLES.length);
        setPhase("in");
      }, 450);
    }, 5500);
    return () => clearInterval(tick);
  }, []);

  const e = EXAMPLES[idx];

  return (
    <div className="card specimen-card" style={{ padding: 0, overflow: "hidden", position: "relative", fontFamily: "var(--f-mono)", fontSize: 12 }}>
      <div className="specimen-scan" />
      <div className="row" style={{ padding: "12px 16px", borderBottom: "1px dashed var(--line)", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <span className="dim">PACT::receipt</span>
        <span className="dim">illustrative · not live</span>
      </div>
      <div className={`specimen-body specimen-${phase}`} style={{ position: "relative", zIndex: 1 }}>
        <div key={idx} className="specimen-inner">
          <div style={{ padding: "20px 18px 14px" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ display: "inline-block", border: "1px solid var(--line)", padding: "2px 8px", fontSize: 10, letterSpacing: "0.12em", color: "var(--acc)" }}>◇ {e.tag}</span>
              <span className="dim" style={{ fontSize: 10 }}>{e.id}</span>
            </div>
            <div className="serif" style={{ fontSize: 19, lineHeight: 1.3, color: "var(--text-1)", fontStyle: "italic", marginBottom: 10, minHeight: 50 }}>
              "{e.commitment}"
            </div>
            <div className="dim" style={{ fontSize: 11 }}>— {e.committer}</div>
          </div>
          <div className="dots" style={{ margin: "0 18px" }} />
          <div style={{ padding: "14px 18px" }}>
            <div className="col gap-3">
              <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">buy-in</span><span>{e.buyIn}</span></div>
              <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">verifier</span><span style={{ color: "var(--text-2)" }}>{e.verifier}</span></div>
              <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">deadline</span><span>{e.deadline}</span></div>
            </div>
          </div>
          <div className="dots" style={{ margin: "0 18px" }} />
          <div style={{ padding: "14px 18px 18px" }}>
            {e.kind === "individual" && (
              <>
                <div className="col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">FOR pool</span><span style={{ color: "var(--win)" }}>{e.forPool} · {e.forPct}%</span></div>
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">AGAINST pool</span><span style={{ color: "var(--loss)" }}>{e.againstPool} · {100 - e.forPct}%</span></div>
                </div>
                <div className="bar split" style={{ marginTop: 10 }}>
                  <div className="for specimen-bar-grow" style={{ width: `${e.forPct}%` }} />
                  <div className="against specimen-bar-grow" style={{ width: `${100 - e.forPct}%` }} />
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                  <span className="dim" style={{ fontSize: 10 }}>FOR % · 24h</span>
                  <svg width="120" height="22" style={{ overflow: "visible" }}>
                    <path className="specimen-spark" d={e.sparkPath} fill="none" stroke="var(--acc)" strokeWidth="1.2" />
                  </svg>
                </div>
              </>
            )}
            {e.kind === "group" && (
              <>
                <div className="col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">stake pool</span><span style={{ color: "var(--win)" }}>{e.stakePool}</span></div>
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">seats</span><span>{e.filled} / {e.total} filled</span></div>
                </div>
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
                  {Array.from({ length: e.total }).map((_, i) => (
                    <div key={i} className="specimen-seat" style={{ aspectRatio: "1", background: i < e.filled ? "var(--acc)" : "transparent", border: i < e.filled ? "1px solid var(--acc)" : "1px dashed var(--line)", animationDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              </>
            )}
            {e.kind === "community" && (
              <>
                <div className="col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">stake pool</span><span style={{ color: "var(--win)" }}>{e.stakePool}</span></div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="dim row gap-2" style={{ alignItems: "center" }}><span className="treasury-pulse" />treasury bonus</span>
                    <span style={{ color: "var(--acc)" }}>+ {e.treasury}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">participants</span><span>{e.participants}</span></div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="bar" style={{ height: 6, display: "flex", overflow: "hidden" }}>
                    <div className="specimen-bar-grow" style={{ width: "32%", background: "var(--win)" }} />
                    <div className="specimen-bar-grow" style={{ width: "68%", background: "var(--acc)" }} />
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 6, fontSize: 10 }}>
                    <span className="dim">stake</span><span className="dim">treasury augment</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="stripe-bg" style={{ padding: "10px 16px", fontSize: 10, color: "var(--text-4)", display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--line)", position: "relative", zIndex: 1 }}>
        <span>↳ rotating examples · {idx + 1} of {EXAMPLES.length}</span>
        <span className="row gap-2">
          {EXAMPLES.map((_, i) => (
            <span key={i} style={{ display: "inline-block", width: 5, height: 5, borderRadius: 5, background: i === idx ? "var(--acc)" : "var(--text-4)", boxShadow: i === idx ? "0 0 6px var(--acc)" : "none", transition: "all 0.3s" }} />
          ))}
        </span>
      </div>
    </div>
  );
}

// ── TypeCard & StepCard helpers ───────────────────────────────────────────────

function TypeCard({ idx, name, tagline, body, bullets, cta, href }: {
  idx: string; name: string; tagline: string; body: string;
  bullets: string[]; cta: string; href: string;
}) {
  return (
    <div style={{ padding: "40px 36px 36px", background: "var(--bg)", display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 28 }}>
        <span className="mono dim" style={{ fontSize: 11 }}>{idx}</span>
        <span className="eyebrow" style={{ color: "var(--acc)" }}>{name}</span>
      </div>
      <div className="serif" style={{ fontSize: 30, lineHeight: 1.15, marginBottom: 18, fontWeight: 400 }}>
        <em>{tagline}</em>
      </div>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>{body}</p>
      <div className="col gap-3" style={{ marginBottom: 32, paddingTop: 20, borderTop: "1px solid var(--line-soft)" }}>
        {bullets.map((b, i) => (
          <div key={i} className="row gap-3" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
            <span style={{ color: "var(--acc)", fontFamily: "var(--f-mono)", fontSize: 11 }}>→</span>
            <span>{b}</span>
          </div>
        ))}
      </div>
      <Link href={href} className="btn ghost sm" style={{ marginTop: "auto", alignSelf: "flex-start" }}>{cta}</Link>
    </div>
  );
}

function StepCard({ n, title, body, last }: { n: string; title: string; body: string; last?: boolean }) {
  return (
    <div style={{ padding: "0 32px 0 0", borderRight: last ? "none" : "1px solid var(--line-soft)" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--acc)", marginBottom: 16 }}>{n}</div>
      <div className="serif" style={{ fontSize: 22, fontWeight: 400, marginBottom: 12 }}>{title}</div>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { tvl, activeChallenges, settledChallenges, prizePool } = useProtocolStats();
  const fmt = (n: number | null, d = 2) => n === null ? "…" : n.toFixed(d);

  return (
    <div className="fade-in">

      {/* HERO */}
      <section className="container" style={{ paddingTop: 100, paddingBottom: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 72, alignItems: "end" }}>
          <div>
            <div className="row gap-3" style={{ marginBottom: 32 }}>
              <span className="eyebrow">PACT Protocol</span>
              <span className="dim mono" style={{ fontSize: 11 }}>·</span>
              <span className="eyebrow" style={{ color: "var(--text-3)" }}>sepolia testnet</span>
            </div>
            <h1 className="h-display serif" style={{ marginBottom: 0 }}>
              Talk is cheap.<br /><em>Stakes aren{"'"}t.</em>
            </h1>
            <p style={{ marginTop: 40, fontSize: 18, color: "var(--text-2)", lineHeight: 1.5, maxWidth: 560, fontWeight: 400 }}>
              A trustless commitment protocol. Stake on a goal, let the world bet
              on whether you{"'"}ll do it, and let the chain settle. No referees, no
              recourse — only outcomes.
            </p>
            <div className="row gap-3" style={{ marginTop: 36 }}>
              <Link href="/dashboard" className="btn primary lg">Browse challenges →</Link>
              <Link href="/create" className="btn lg ghost">Stake on yourself</Link>
            </div>
          </div>
          <SpecimenReceipt />
        </div>
      </section>

      {/* STATS BAND */}
      <section style={{ borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-1)" }}>
        <div className="container" style={{ padding: "32px 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
            <div style={{ paddingRight: 32, borderRight: "1px solid var(--line-soft)" }}>
              <div className="col gap-2"><div className="eyebrow">Total Value Staked</div><div className="num-xl">Ξ {fmt(tvl)}</div><div className="muted" style={{ fontSize: 12 }}>across all live challenges</div></div>
            </div>
            <div style={{ padding: "0 32px", borderRight: "1px solid var(--line-soft)" }}>
              <div className="col gap-2"><div className="eyebrow">Active Challenges</div><div className="num-xl">{activeChallenges ?? "…"}</div><div className="muted" style={{ fontSize: 12 }}>+ {settledChallenges ?? "…"} settled</div></div>
            </div>
            <div style={{ padding: "0 32px", borderRight: "1px solid var(--line-soft)" }}>
              <div className="col gap-2"><div className="eyebrow">Treasury Prize Pool</div><div className="num-xl" style={{ color: "var(--acc)" }}>Ξ {fmt(prizePool)}</div><div className="muted" style={{ fontSize: 12 }}>for next public challenge</div></div>
            </div>
            <div style={{ paddingLeft: 32 }}>
              <div className="col gap-2"><div className="eyebrow">Challenges Settled</div><div className="num-xl">{settledChallenges ?? "…"}</div><div className="muted" style={{ fontSize: 12 }}>all time</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE TYPES */}
      <section style={{ borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-1)" }}>
        <div className="container" style={{ padding: "120px 28px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56 }}>
            <div>
              <div className="row gap-3" style={{ marginBottom: 14 }}>
                <span className="status-dot" />
                <span className="eyebrow">Choose your pact</span>
              </div>
              <h2 className="h-1 serif" style={{ fontSize: 56, fontWeight: 400, lineHeight: 1.05 }}>Three challenge<br />types.</h2>
            </div>
            <p className="muted" style={{ maxWidth: 360, fontSize: 14, lineHeight: 1.6 }}>
              All three share the same settlement engine and the same fee schedule.
              The difference is who stakes, who bets, and where the upside comes from.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <TypeCard idx="01" name="Personal" tagline="A market for self-belief."
              body="You stake ETH on a goal. The world bets FOR or AGAINST you. If you win, you and your backers split the doubters' pool. If you fail, the doubters split yours."
              bullets={["Single committer, public market", "FOR/AGAINST betting until lock", "AGAINST capped at 5× your buy-in"]}
              cta="Browse challenges →" href="/dashboard" />
            <TypeCard idx="02" name="Group" tagline="A pact with peers."
              body="A circle of participants stake on the same commitment. Whoever completes splits the pool of whoever didn't — proportional to stake."
              bullets={["Many committers, one goal", "Winners split losers' stakes", "No outside betting"]}
              cta="Browse groups →" href="/dashboard" />
            <TypeCard idx="03" name="Community" tagline="The protocol commits."
              body="Admins propose. The community votes by reputation weight. The winning proposal becomes a group challenge with the treasury prize pool stacked on top."
              bullets={["Admin-proposed, vote-elected", "Augmented by treasury prize pool", "Reputation-weighted votes"]}
              cta="Open governance →" href="/public" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container" style={{ paddingTop: 120, paddingBottom: 120 }}>
        <div style={{ marginBottom: 64 }}>
          <div className="row gap-3" style={{ marginBottom: 14 }}>
            <span className="status-dot" />
            <span className="eyebrow">From pact to payout</span>
          </div>
          <h2 className="h-1 serif" style={{ fontSize: 56, fontWeight: 400, lineHeight: 1.05 }}>How a pact <em>settles.</em></h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
          <StepCard n="01" title="Commit" body="Pick a goal, a verifier, a deadline, and a buy-in. Deploy the challenge contract from the factory." />
          <StepCard n="02" title="Join or bet" body="Group challenges accept stakers. Personal challenges accept FOR / AGAINST bettors. Stakes lock when the window closes." />
          <StepCard n="03" title="Verify" body="An on-chain read, an API oracle, or a vision model returns a per-participant verdict. The state machine doesn't care which." />
          <StepCard n="04" title="Settle" body="Winners are paid proportionally from the losing pool. 2% fee to treasury. Reputation updates. The contract closes." last />
        </div>
      </section>

      {/* LIVE ACTIVITY */}
      <section style={{ borderTop: "1px solid var(--line-soft)", background: "var(--bg-1)" }}>
        <div className="container" style={{ padding: "100px 28px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
            <div>
              <div className="row gap-3" style={{ marginBottom: 14 }}>
                <span className="status-dot" />
                <span className="eyebrow">Happening now</span>
              </div>
              <h2 className="h-1 serif" style={{ fontSize: 44, fontWeight: 400, lineHeight: 1.1 }}>Live activity.</h2>
            </div>
            <Link href="/dashboard" className="btn ghost sm">View all challenges →</Link>
          </div>
          <LiveActivityFeed />
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid var(--line-soft)", padding: "40px 0", background: "var(--bg-1)" }}>
        <div className="container row" style={{ justifyContent: "space-between", fontSize: 12 }}>
          <div className="row gap-4">
            <span className="brand-mark" />
            <span className="muted">PACT Protocol · Sepolia testnet · academic build</span>
          </div>
          <div className="row gap-4 muted">
            <span>Factory: <span className="chip">0x5b4B…1E8</span></span>
            <span>Treasury: <span className="chip">0x8232…854</span></span>
          </div>
        </div>
      </footer>

    </div>
  );
}
