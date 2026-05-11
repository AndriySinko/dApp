"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useWithdraw } from "@/lib/hooks/useWithdraw";
import { useTickEpoch } from "@/lib/hooks/useGovernance";
import { INDIVIDUAL_CHALLENGE_ABI, GROUP_CHALLENGE_ABI } from "@/lib/contracts";
import type { ChallengeType } from "@/lib/types";

// ── WithdrawCard ──────────────────────────────────────────────────────────────
// Shows when state=SETTLED and user has pendingWithdrawals > 0

interface WithdrawCardProps {
  challengeAddress: `0x${string}`;
  challengeType: ChallengeType;
  pendingWei: bigint;
}

export function WithdrawCard({ challengeAddress, challengeType, pendingWei }: WithdrawCardProps) {
  const amount = Number(pendingWei) / 1e18;
  const { withdraw, txHash, isPending, isConfirming, isSuccess, error } = useWithdraw(challengeAddress, challengeType);

  if (amount === 0 && !isSuccess) {
    return (
      <div className="muted" style={{ fontSize: 12, padding: "12px 16px", border: "1px dashed var(--line-soft)", borderRadius: "var(--r)", fontFamily: "var(--f-mono)", textAlign: "center" }}>
        Nothing to withdraw.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 22, borderColor: isSuccess ? "var(--win)" : "var(--acc)", background: isSuccess ? "var(--win-bg)" : "var(--acc-bg)" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div className="col gap-2">
          <div className="eyebrow" style={{ color: isSuccess ? "var(--win)" : "var(--acc)" }}>
            {isSuccess ? "✓ Withdrawn" : "Claimable"}
          </div>
          <div className="num-xl" style={{ fontSize: 32 }}>Ξ {amount.toFixed(4)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {isSuccess ? "Funds sent to your wallet." : "Your share of the settlement."}
          </div>
          {isSuccess && txHash && (
            <div className="row gap-2" style={{ marginTop: 6, fontSize: 11, fontFamily: "var(--f-mono)" }}>
              <span className="dim">tx</span>
              <span className="chip">{txHash.slice(0, 10)}…</span>
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="dim">↗</a>
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: "var(--loss)", marginTop: 4 }}>Transaction failed. Try again.</div>}
        </div>
        <div className="col gap-2" style={{ minWidth: 160 }}>
          {!isSuccess && (
            <button
              className="btn primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={isPending || isConfirming}
              onClick={withdraw}
            >
              {isPending || isConfirming
                ? <><span className="spinner-dot" />Withdrawing…</>
                : "Withdraw →"}
            </button>
          )}
          <div className="dim mono" style={{ fontSize: 10, textAlign: "right" }}>gas est · 0.0004 ETH</div>
        </div>
      </div>
    </div>
  );
}

// ── BindAccountCard ───────────────────────────────────────────────────────────
// Shows when verifier=API_ORACLE, state=JOIN_OPEN, user registered, not yet bound

interface BindAccountCardProps {
  challengeAddress: `0x${string}`;
  challengeType: ChallengeType;
  verifierHint: "github" | "strava" | "generic";
  alreadyBound?: string;
}

const BIND_ABI = [
  { type: "function", name: "bindAccount", inputs: [{ name: "serviceAccountId", type: "string" }], outputs: [], stateMutability: "nonpayable" },
] as const;

export function BindAccountCard({ challengeAddress, verifierHint, alreadyBound }: BindAccountCardProps) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  const [val, setVal] = useState(alreadyBound ?? "");
  const isBound = !!(alreadyBound || isSuccess);

  const placeholder = verifierHint === "strava" ? "Strava athlete ID" : verifierHint === "github" ? "GitHub username" : "Service account ID";
  const label = verifierHint === "strava" ? "Strava" : verifierHint === "github" ? "GitHub" : "Off-chain account";

  const bind = () => {
    if (!val.trim()) return;
    writeContract({ address: challengeAddress, abi: BIND_ABI, functionName: "bindAccount", args: [val.trim()] });
  };

  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="eyebrow">Bind off-chain account</div>
        <span className="tag">{label}</span>
      </div>
      {isBound ? (
        <div className="col gap-3">
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Your account is linked. The oracle will fetch results from this ID at verdict time.
          </p>
          <div className="row gap-2" style={{ alignItems: "center" }}>
            <span className="tag acc">✓ Bound: {alreadyBound || val}</span>
            <span className="dim mono" style={{ fontSize: 11 }}>locked for this challenge</span>
          </div>
        </div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
            Link your off-chain account so the oracle can verify your result.
            One bind per challenge — cannot be changed once submitted.
          </p>
          <div className="row gap-2" style={{ alignItems: "stretch" }}>
            <input className="input" value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} disabled={isPending} style={{ flex: 1 }} />
            <button className="btn primary sm" disabled={!val.trim() || isPending} onClick={bind}>
              {isPending ? <><span className="spinner-dot" />Binding…</> : "Bind account"}
            </button>
          </div>
          <div className="dim mono" style={{ fontSize: 10, marginTop: 10 }}>↳ writes serviceAccountId to challenge contract</div>
        </>
      )}
    </div>
  );
}

// ── SettleFallback ────────────────────────────────────────────────────────────
// Subtle strip shown when VERIFY_PENDING and all verdicts are in

const SETTLE_ABI = [
  { type: "function", name: "settle", inputs: [], outputs: [], stateMutability: "nonpayable" },
] as const;

export function SettleFallback({ challengeAddress }: { challengeAddress: `0x${string}` }) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });

  return (
    <div style={{ padding: "10px 14px", borderRadius: "var(--r)", border: "1px dashed var(--line)", background: "var(--bg-1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div className="row gap-3" style={{ alignItems: "center" }}>
        <span className="status-dot warn" />
        <span className="muted" style={{ fontSize: 12.5 }}>
          {isSuccess ? "Settlement complete." : "All verdicts received. Settlement pending."}
        </span>
        {!isSuccess && <span className="dim mono" style={{ fontSize: 10 }}>↳ chainlink automation should trigger soon</span>}
      </div>
      {!isSuccess && (
        <button
          className="btn ghost sm"
          disabled={isPending}
          onClick={() => writeContract({ address: challengeAddress, abi: SETTLE_ABI, functionName: "settle", args: [] })}
        >
          {isPending ? <><span className="spinner-dot" />Settling…</> : "Settle now →"}
        </button>
      )}
      {isSuccess && <span className="tag acc">✓ settled</span>}
    </div>
  );
}

// ── TickEpochBanner ───────────────────────────────────────────────────────────
// Full-width accent banner when epoch has ended

interface TickEpochBannerProps {
  epochNumber: number;
  winningTitle: string;
  proposalId: string;
}

export function TickEpochBanner({ epochNumber, winningTitle, proposalId }: TickEpochBannerProps) {
  const { tickEpoch, txHash, isPending, isSuccess } = useTickEpoch();

  return (
    <div className="card" style={{ padding: 24, marginBottom: 32, background: isSuccess ? "var(--win-bg)" : "var(--acc-bg)", borderColor: isSuccess ? "var(--win)" : "var(--acc)", position: "relative", overflow: "hidden" }}>
      <div className="mono dim" style={{ position: "absolute", top: 12, right: 16, fontSize: 10, letterSpacing: "0.12em" }}>// EPOCH_ENDED</div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
        <div className="col gap-2" style={{ flex: 1, minWidth: 320 }}>
          <div className="row gap-3" style={{ alignItems: "center" }}>
            <span className="status-dot" style={{ background: isSuccess ? "var(--win)" : "var(--acc)", boxShadow: `0 0 10px ${isSuccess ? "var(--win)" : "var(--acc)"}` }} />
            <span className="eyebrow" style={{ color: isSuccess ? "var(--win)" : "var(--acc)" }}>
              {isSuccess ? "Deployed" : `Voting round #${epochNumber} closed`}
            </span>
            <span className="tag">{proposalId}</span>
          </div>
          <div className="serif" style={{ fontSize: 24, lineHeight: 1.25, fontWeight: 400, maxWidth: 540 }}>
            {isSuccess ? <>Challenge deployed — <em>"{winningTitle}"</em></> : <>Winning proposal: <em>"{winningTitle}"</em></>}
          </div>
          {isSuccess && txHash ? (
            <div className="row gap-2 mono" style={{ fontSize: 11, marginTop: 4 }}>
              <span className="dim">tx</span>
              <span className="chip">{txHash.slice(0, 10)}…</span>
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="dim">↗</a>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              Anyone can pay gas to deploy this challenge and start the next voting round.
              The treasury prize pool funds it automatically.
            </div>
          )}
        </div>
        <div className="col gap-2" style={{ minWidth: 220 }}>
          {!isSuccess && (
            <button className="btn primary lg" style={{ justifyContent: "center" }} disabled={isPending} onClick={tickEpoch}>
              {isPending ? <><span className="spinner-dot" />Deploying…</> : "Deploy winning challenge →"}
            </button>
          )}
          <div className="dim mono" style={{ fontSize: 10, textAlign: "center" }}>gas est · 0.0021 ETH · funded by treasury</div>
        </div>
      </div>
    </div>
  );
}
