"use client";

import { useAccount } from "wagmi";
import { PAST_EPOCHS } from "@/lib/data";
import { VERIFIER_ICON, VERIFIER_LABEL, timeLeft } from "@/lib/utils";
import { useGovernance, useVote } from "@/lib/hooks/useGovernance";
import { ADDRESSES } from "@/lib/contracts";

export default function PublicPage() {
  const { address } = useAccount();
  const isDeployed = !!ADDRESSES.governance;

  const {
    proposals,
    totalVotes,
    currentEpoch,
    epochEnd,
    prizePerEpoch,
    hasVoted,
    voteWeight,
    isLoading,
    refetch,
  } = useGovernance(address);

  const { vote, isPending: isVotePending, isSuccess: isVoteSuccess } = useVote();

  const handleVote = (proposalIndex: number) => {
    vote(proposalIndex);
    setTimeout(refetch, 3000);
  };

  // Fall back to mock data if contract not deployed yet
  if (!isDeployed || (!isLoading && proposals.length === 0)) {
    return <MockGovernancePage />;
  }

  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div className="page-head">
        <div>
          <div className="row gap-3" style={{ marginBottom: 12 }}>
            <span className="eyebrow">{`{ governance · epoch #${currentEpoch ?? "…"} }`}</span>
            {epochEnd && <><span className="status-dot warn" /><span className="muted" style={{ fontSize: 12 }}>tickEpoch {timeLeft(epochEnd)}</span></>}
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
              <div className="num-xl">{proposals.length}</div>
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
              <div className="num-xl" style={{ color: "var(--acc)" }}>×{voteWeight ?? 0}</div>
              <div className="muted" style={{ fontSize: 12 }}>from reputation</div>
            </div>
          </div>
          <div style={{ paddingLeft: 28 }}>
            <div className="col gap-2">
              <div className="eyebrow">Prize pool</div>
              <div className="num-xl" style={{ color: "var(--acc)" }}>Ξ {(prizePerEpoch ?? 0).toFixed(2)}</div>
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
        {proposals.map((p, idx) => {
          const pct = totalVotes > 0 ? ((p.votes / totalVotes) * 100).toFixed(1) : "0.0";
          const isLeading = idx === 0 && proposals.length > 1;

          return (
            <div key={p.index} className="card" style={{ padding: 24, position: "relative", borderColor: isLeading ? "rgba(212,255,61,0.3)" : undefined }}>
              {isLeading && <div className="tag acc" style={{ position: "absolute", top: -10, left: 24 }}>● Leading</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32, alignItems: "start" }}>
                <div className="col gap-3">
                  <div className="row gap-3" style={{ flexWrap: "wrap" }}>
                    <span className="tag">P-{String(p.index).padStart(3, "0")}</span>
                    <span className="tag" style={{ color: "var(--text-2)" }}>
                      <span style={{ color: "var(--acc)" }}>{VERIFIER_ICON[p.verifier]}</span>{" "}
                      {VERIFIER_LABEL[p.verifier]}
                    </span>
                    <span className="tag">{p.durationDays} days</span>
                    <span className="tag">{p.joinDays}d join window</span>
                    <span className="tag">min Ξ {p.minStake.toFixed(2)}</span>
                  </div>
                  <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>{p.title}</h3>
                  <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 560 }}>{p.description}</p>
                </div>
                <div className="col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="eyebrow">votes</span>
                    <span className="num" style={{ fontSize: 13 }}>{pct}%</span>
                  </div>
                  <div className="num-xl">{p.votes.toLocaleString()}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{p.voters} voters</div>
                  <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                  <button
                    className="btn primary"
                    style={{ marginTop: 8, justifyContent: "center", opacity: (hasVoted && !isVoteSuccess) ? 0.4 : 1 }}
                    onClick={() => handleVote(p.index)}
                    disabled={!!hasVoted || isVotePending || !address || (voteWeight ?? 0) === 0}
                  >
                    {isVotePending ? "⏳ Waiting…"
                      : isVoteSuccess ? `✓ Voted`
                      : hasVoted ? "Already voted"
                      : !address ? "Connect wallet"
                      : (voteWeight ?? 0) === 0 ? "No vote weight"
                      : `Vote with weight ×${voteWeight}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {proposals.length === 0 && !isLoading && (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-4)" }}>
            No proposals this epoch.
          </div>
        )}
      </div>

      <div style={{ marginTop: 56 }}>
        <h2 className="h-2" style={{ marginBottom: 16 }}>Recent epochs</h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>epoch</th><th>winning proposal</th><th>verifier</th>
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

// Shown when governance contract is not deployed yet
function MockGovernancePage() {
  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{`{ governance }`}</div>
          <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: "-0.02em" }}>Vote the next public challenge.</h1>
        </div>
      </div>
      <div className="card" style={{ padding: 40, textAlign: "center" }}>
        <div className="muted" style={{ fontSize: 14 }}>
          Governance contract not deployed yet. Set <span className="chip">NEXT_PUBLIC_GOVERNANCE_ADDRESS</span> after deployment.
        </div>
      </div>
    </div>
  );
}
