"use client";

import { useState } from "react";
import { PROPOSALS, PAST_EPOCHS, MOCK_REPUTATION } from "@/lib/data";
import { VERIFIER_ICON, VERIFIER_LABEL } from "@/lib/utils";

export default function PublicPage() {
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [votes, setVotes] = useState<Record<string, number>>(
    Object.fromEntries(PROPOSALS.map(p => [p.id, p.votes]))
  );

  const totalVotes = PROPOSALS.reduce((sum, p) => sum + (votes[p.id] ?? p.votes), 0);
  const hasVoted = Object.values(voted).some(Boolean);

  const castVote = (id: string) => {
    if (hasVoted) return;
    setVoted(v => ({ ...v, [id]: true }));
    setVotes(v => ({ ...v, [id]: (v[id] ?? 0) + MOCK_REPUTATION }));
  };

  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div className="page-head">
        <div>
          <div className="row gap-3" style={{ marginBottom: 12 }}>
            <span className="eyebrow">{`{ governance · epoch #14 }`}</span>
            <span className="status-dot warn" />
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

      <div className="card" style={{ padding: 28, marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div style={{ paddingRight: 28, borderRight: "1px solid var(--line-soft)" }}>
            <div className="col gap-2">
              <div className="eyebrow">Active proposals</div>
              <div className="num-xl">{PROPOSALS.length}</div>
            </div>
          </div>
          <div style={{ padding: "0 28px", borderRight: "1px solid var(--line-soft)" }}>
            <div className="col gap-2">
              <div className="eyebrow">Total vote weight</div>
              <div className="num-xl">{totalVotes.toLocaleString()}</div>
              <div className="muted" style={{ fontSize: 12 }}>across all proposals</div>
            </div>
          </div>
          <div style={{ padding: "0 28px", borderRight: "1px solid var(--line-soft)" }}>
            <div className="col gap-2">
              <div className="eyebrow">Your vote weight</div>
              <div className="num-xl" style={{ color: "var(--acc)" }}>×{MOCK_REPUTATION}</div>
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

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="h-2">Open proposals</h2>
        <span className="muted mono" style={{ fontSize: 12 }}>one vote per address per epoch</span>
      </div>

      <div className="col gap-3">
        {PROPOSALS.map((p, idx) => {
          const voteCount = votes[p.id] ?? p.votes;
          const pct = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : "0.0";
          const isLeading = idx === 0;
          const didVote = voted[p.id];

          return (
            <div key={p.id} className="card" style={{ padding: 24, position: "relative", borderColor: isLeading ? "rgba(212,255,61,0.3)" : undefined }}>
              {isLeading && <div className="tag acc" style={{ position: "absolute", top: -10, left: 24 }}>● Leading</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32, alignItems: "start" }}>
                <div className="col gap-3">
                  <div className="row gap-3" style={{ flexWrap: "wrap" }}>
                    <span className="tag">{p.id}</span>
                    <span className="tag" style={{ color: "var(--text-2)" }}>
                      <span style={{ color: "var(--acc)" }}>{VERIFIER_ICON[p.verifier]}</span>{" "}
                      {VERIFIER_LABEL[p.verifier]}
                    </span>
                    <span className="tag">{p.durationDays} days</span>
                    <span className="tag">min Ξ {p.minStake.toFixed(2)}</span>
                  </div>
                  <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>{p.title}</h3>
                  <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 560 }}>{p.description}</p>
                  <div className="row gap-3" style={{ fontSize: 12 }}>
                    <span className="avatar sm" />
                    <span>proposed by</span>
                    <span className="mono" style={{ color: "var(--text-2)" }}>admin.pact</span>
                  </div>
                </div>
                <div className="col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="eyebrow">votes</span>
                    <span className="num" style={{ fontSize: 13 }}>{pct}%</span>
                  </div>
                  <div className="num-xl">{voteCount.toLocaleString()}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{p.voters + (didVote ? 1 : 0)} voters</div>
                  <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                  <button
                    className="btn primary"
                    style={{ marginTop: 8, justifyContent: "center", opacity: hasVoted && !didVote ? 0.4 : 1 }}
                    onClick={() => castVote(p.id)}
                    disabled={hasVoted && !didVote}
                  >
                    {didVote ? `✓ Voted (×${MOCK_REPUTATION})` : `Vote with weight ×${MOCK_REPUTATION}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
              {PAST_EPOCHS.map(e => (
                <tr key={e.epoch}>
                  <td><span className="mono dim">#{e.epoch}</span></td>
                  <td>{e.title}</td>
                  <td>
                    <span className="tag" style={{ color: "var(--text-2)" }}>
                      <span style={{ color: "var(--acc)" }}>{VERIFIER_ICON[e.verifier]}</span>{" "}
                      {VERIFIER_LABEL[e.verifier]}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }} className="num">{e.votes.toLocaleString()}</td>
                  <td style={{ textAlign: "right" }} className="num">Ξ {e.prizePool.toFixed(2)}</td>
                  <td style={{ textAlign: "right" }} className="muted">{e.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
