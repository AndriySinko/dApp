"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import { VERIFIER_ICON, VERIFIER_LABEL, timeLeft } from "@/lib/utils";
import { useGovernance, useVote } from "@/lib/hooks/useGovernance";
import { TickEpochBanner } from "@/components/ActionCards";
import { CriteriaBuilder } from "@/components/CriteriaBuilder";
import { ADDRESSES } from "@/lib/contracts";
import { useEpochResults } from "@/lib/hooks/useEpochResults";
import type { VerifierType } from "@/lib/types";
import { VERIFIER_TYPE_NUM } from "@/lib/types";

const OWNER_ABI = [{ type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }] as const;
const PROPOSE_VERIFIERS: { value: VerifierType; label: string }[] = [
  { value: "ON_CHAIN",   label: "On-chain" },
  { value: "API_ORACLE", label: "API Oracle" },
  { value: "AI_ORACLE",  label: "AI Oracle" },
];

function ProposeForm({ onProposed }: { onProposed: () => void }) {
  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [verifier, setVerifier] = useState<VerifierType>("ON_CHAIN");
  const [duration, setDuration] = useState("7");
  const [joinDays, setJoinDays] = useState("2");
  const [minStake, setMinStake] = useState("0.01");
  const [open,     setOpen]     = useState(false);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  const PROPOSE_ABI = [{
    type: "function", name: "propose",
    inputs: [
      { name: "title",        type: "string"  },
      { name: "description",  type: "string"  },
      { name: "verifier",     type: "uint8"   },
      { name: "durationDays", type: "uint256" },
      { name: "joinDays",     type: "uint256" },
      { name: "minStake",     type: "uint256" },
    ],
    outputs: [], stateMutability: "nonpayable",
  }] as const;

  const submit = () => {
    if (!ADDRESSES.governance || !title || !desc) return;
    writeContract({
      address: ADDRESSES.governance,
      abi: PROPOSE_ABI,
      functionName: "propose",
      args: [
        title, desc,
        VERIFIER_TYPE_NUM[verifier],
        BigInt(duration),
        BigInt(joinDays),
        BigInt(Math.round(parseFloat(minStake) * 1e18)),
      ],
    });
  };

  if (isSuccess) {
    return (
      <div className="card" style={{ padding: 24, borderColor: "var(--win)", background: "var(--win-bg)" }}>
        <div className="row gap-3"><span className="tag acc">✓ Proposed</span><span className="muted" style={{ fontSize: 13 }}>"{title}" is now open for voting.</span></div>
      </div>
    );
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 24 }}>
        <button className="btn primary sm" onClick={() => setOpen(true)}>+ New proposal</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 28, marginBottom: 24, borderColor: "var(--acc)" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div className="eyebrow">New proposal</div>
        <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <div className="col gap-4">
        <div className="field"><label>Title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="30-day fitness challenge" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
          <div className="field">
            <label>Verifier</label>
            <select className="input" value={verifier} onChange={e => { setVerifier(e.target.value as VerifierType); setDesc(""); }}>
              {PROPOSE_VERIFIERS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Duration (days)</label><input className="input" type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" /></div>
          <div className="field"><label>Join window (days)</label><input className="input" type="number" value={joinDays} onChange={e => setJoinDays(e.target.value)} min="1" /></div>
          <div className="field"><label>Min stake (ETH)</label><input className="input" type="number" value={minStake} onChange={e => setMinStake(e.target.value)} step="0.01" /></div>
        </div>
        <div className="dots" />
        <div className="eyebrow" style={{ marginBottom: 4 }}>Success criteria</div>
        <CriteriaBuilder verifier={verifier} value={desc} onChange={setDesc} />
        <button className="btn primary" disabled={!title || !desc || isPending} onClick={submit} style={{ alignSelf: "flex-start", marginTop: 8 }}>
          {isPending ? <><span className="spinner-dot" />Proposing…</> : "Submit proposal"}
        </button>
      </div>
    </div>
  );
}

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
  const { epochs: liveEpochs } = useEpochResults();

  const { data: ownerAddress } = useReadContract({ address: ADDRESSES.governance, abi: OWNER_ABI, functionName: "owner" });
  const isOwner = !!address && !!ownerAddress && address.toLowerCase() === (ownerAddress as string).toLowerCase();

  // setPrizePerEpoch
  const [prizeInput, setPrizeInput] = useState("");
  const { writeContract: writePrize, data: prizeTxHash, isPending: isPrizePending } = useWriteContract();
  const { isSuccess: isPrizeSet } = useWaitForTransactionReceipt({ hash: prizeTxHash, query: { enabled: !!prizeTxHash } });
  const SET_PRIZE_ABI = [{ type: "function", name: "setPrizePerEpoch", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }] as const;

  // Fund treasury
  const [fundInput, setFundInput] = useState("");
  const { sendTransaction: sendFund, data: fundTxHash, isPending: isFundPending } = useSendTransaction();
  const { isSuccess: isFunded } = useWaitForTransactionReceipt({ hash: fundTxHash, query: { enabled: !!fundTxHash } });

  const handleVote = (proposalIndex: number) => {
    vote(proposalIndex);
    setTimeout(refetch, 3000);
  };

  if (!isDeployed) {
    return <MockGovernancePage />;
  }

  const epochEnded = epochEnd !== null && epochEnd !== undefined && new Date() >= epochEnd;
  const winningProposal = proposals.length > 0 ? proposals.reduce((a, b) => a.votes >= b.votes ? a : b) : null;

  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80 }}>
      {isOwner && (
        <div className="card" style={{ padding: 24, marginBottom: 24, borderColor: "var(--line-soft)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <div className="eyebrow">Admin settings</div>
            <span className="tag">owner only</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="col gap-2">
              <div className="field">
                <label>Prize per round (ETH)</label>
                <div className="row gap-2">
                  <input className="input" type="number" value={prizeInput} onChange={e => setPrizeInput(e.target.value)} placeholder="1.0" step="0.1" style={{ flex: 1 }} />
                  <button className="btn primary sm" disabled={!prizeInput || isPrizePending} onClick={() => writePrize({ address: ADDRESSES.governance!, abi: SET_PRIZE_ABI, functionName: "setPrizePerEpoch", args: [parseEther(prizeInput || "0")] })}>
                    {isPrizePending ? <><span className="spinner-dot" />Setting…</> : isPrizeSet ? "✓ Set" : "Set →"}
                  </button>
                </div>
                <span className="field-hint">Current: Ξ {(prizePerEpoch ?? 0).toFixed(2)} · ETH pulled from treasury when round deploys</span>
              </div>
            </div>
            <div className="col gap-2">
              <div className="field">
                <label>Fund treasury (ETH)</label>
                <div className="row gap-2">
                  <input className="input" type="number" value={fundInput} onChange={e => setFundInput(e.target.value)} placeholder="1.0" step="0.1" style={{ flex: 1 }} />
                  <button className="btn primary sm" disabled={!fundInput || isFundPending} onClick={() => sendFund({ to: ADDRESSES.treasury!, value: parseEther(fundInput || "0") })}>
                    {isFundPending ? <><span className="spinner-dot" />Sending…</> : isFunded ? "✓ Funded" : "Fund →"}
                  </button>
                </div>
                <span className="field-hint">Send ETH to treasury so it can fund public challenges</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {epochEnded && winningProposal && (
        <TickEpochBanner
          epochNumber={currentEpoch ?? 1}
          winningTitle={winningProposal.title}
          proposalId={`P-${String(winningProposal.index).padStart(3, "0")}`}
        />
      )}
      <div className="page-head">
        <div>
          <div className="row gap-3" style={{ marginBottom: 12 }}>
            <span className="eyebrow">{`{ governance · round #${currentEpoch ?? "…"} }`}</span>
            {epochEnd && <><span className="status-dot warn" /><span className="muted" style={{ fontSize: 12 }}>voting closes {timeLeft(epochEnd)}</span></>}
          </div>
          <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: "-0.02em" }}>Vote the next public challenge.</h1>
          <p style={{ marginTop: 14, color: "var(--text-2)", fontSize: 15, maxWidth: 640, lineHeight: 1.55 }}>
            Admin proposes. Community votes — weighted by reputation, capped at 100×.
            The leading proposal when voting closes is automatically deployed as a public challenge
            and funded from the treasury prize pool.
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
        <span className="muted mono" style={{ fontSize: 12 }}>one vote per address per round</span>
      </div>
      {isOwner && <ProposeForm onProposed={refetch} />}

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
            No proposals this round.
          </div>
        )}
      </div>

      <div style={{ marginTop: 56 }}>
        <h2 className="h-2" style={{ marginBottom: 16 }}>Past challenges</h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>round</th><th>winning proposal</th><th>verifier</th>
                <th style={{ textAlign: "right" }}>votes</th>
                <th style={{ textAlign: "right" }}>prize pool</th>
                <th style={{ textAlign: "right" }}>outcome</th>
              </tr>
            </thead>
            <tbody>
              {liveEpochs.map(e => (
                  <tr key={e.epoch}>
                    <td><span className="mono dim">#{e.epoch}</span></td>
                    <td>{e.title}</td>
                    <td><span className="mono dim" style={{ fontSize: 11 }}>{e.publicChallengeAddress.slice(0, 6)}…{e.publicChallengeAddress.slice(-4)}</span></td>
                    <td style={{ textAlign: "right" }} className="num">—</td>
                    <td style={{ textAlign: "right" }} className="num">Ξ {e.prizePool.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }} className="muted">deployed</td>
                  </tr>
              ))}
              {liveEpochs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-4)" }}>No past challenges yet.</td></tr>
              )}
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
