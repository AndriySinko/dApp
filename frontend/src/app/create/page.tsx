"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useCreateChallenge } from "@/lib/hooks/useCreateChallenge";
import { TxButton } from "@/components/TxButton";
import { CriteriaBuilder } from "@/components/CriteriaBuilder";
import type { ChallengeType, VerifierType } from "@/lib/types";
import { VERIFIER_ICON, VERIFIER_LABEL } from "@/lib/utils";
import { LINK_UPKEEP_AMOUNT } from "@/lib/contracts";

type TimeUnit = "minutes" | "hours" | "days";

function toSeconds(value: string, unit: TimeUnit): number {
  const n = parseFloat(value) || 0;
  if (unit === "minutes") return n * 60;
  if (unit === "hours")   return n * 3600;
  return n * 86400;
}

function TimeInput({ label, value, onChange, unit, onUnitChange, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  unit: TimeUnit; onUnitChange: (u: TimeUnit) => void; hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row gap-2">
        <input className="input" type="number" value={value} onChange={e => onChange(e.target.value)} min="1" style={{ flex: 1 }} />
        <select className="input" value={unit} onChange={e => onUnitChange(e.target.value as TimeUnit)} style={{ width: 110 }}>
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

type Step = 1 | 2 | 3 | 4;

const TYPES: { value: ChallengeType; label: string; desc: string }[] = [
  { value: "INDIVIDUAL", label: "Individual", desc: "One commits, outsiders bet FOR or AGAINST." },
  { value: "GROUP",      label: "Group",      desc: "Many participants, same goal. Winners split losers' pool." },
];

const VERIFIERS: { value: VerifierType; label: string; desc: string }[] = [
  { value: "ON_CHAIN",   label: "On-chain",   desc: "Reads ETH/ERC-20 balance at deadline. Fully trustless." },
  { value: "API_ORACLE", label: "API Oracle", desc: "Chainlink Functions calls external API (GitHub, Strava…)." },
  { value: "AI_ORACLE",  label: "AI Oracle",  desc: "Photo evidence to IPFS, Gemini Vision classifies." },
];

const STEPS = ["Type", "Verification", "Stakes & deadlines", "Review & deploy"];

export default function CreatePage() {
  const { isConnected } = useAccount();
  const { deploy, step: txStep, isPending, isSuccess, isError, error, reset: resetTx, hasLinkApproval } = useCreateChallenge();

  const [step,         setStep]        = useState<Step>(1);
  const [type,         setType]        = useState<ChallengeType>("INDIVIDUAL");
  const [verifier,     setVerifier]    = useState<VerifierType>("API_ORACLE");
  const [title,        setTitle]       = useState("");
  const [criteria,     setCriteria]    = useState("");
  const [buyIn,        setBuyIn]       = useState("0.10");
  const [joinVal,      setJoinVal]     = useState("2");
  const [joinUnit,     setJoinUnit]    = useState<TimeUnit>("days");
  const [durVal,       setDurVal]      = useState("7");
  const [durUnit,      setDurUnit]     = useState<TimeUnit>("days");

  const next = () => setStep(s => Math.min(s + 1, 4) as Step);
  const prev = () => setStep(s => Math.max(s - 1, 1) as Step);

  const joinSecs = toSeconds(joinVal, joinUnit);
  const durSecs  = toSeconds(durVal,  durUnit);

  const handleDeploy = () => {
    const now = Math.floor(Date.now() / 1000);
    const joinDeadline      = BigInt(now + joinSecs);
    const challengeDeadline = BigInt(now + joinSecs + durSecs);
    deploy({ challengeType: type, verifier, title, criteria, joinDeadline, challengeDeadline, buyIn });
  };

  const deployLabel = !isConnected
    ? "Connect wallet to deploy"
    : isError
    ? "✗ Failed — retry"
    : !hasLinkApproval
    ? txStep === "approving" ? "Approving LINK…" : "Step 1: Approve 2 LINK →"
    : txStep === "creating" || txStep === "approved" ? "Deploying…"
    : "Deploy challenge →";

  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 1080 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{`{ new challenge }`}</div>
          <h1 className="serif" style={{ fontSize: 56, fontWeight: 400, letterSpacing: "-0.02em" }}>Put it on-chain.</h1>
        </div>
        <Link href="/dashboard" className="btn ghost">Cancel</Link>
      </div>

      {/* stepper */}
      <div className="row" style={{ marginBottom: 40 }}>
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const active = n === step;
          const done   = n < step;
          return (
            <div key={n} className="row flex-1" style={{ alignItems: "center" }}>
              <button className="row gap-3" style={{ background: "none", padding: 0 }} onClick={() => done && setStep(n)}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                  fontFamily: "var(--f-mono)", fontSize: 12,
                  background: active || done ? "var(--acc)" : "var(--bg-2)",
                  color: active || done ? "#0b0b0c" : "var(--text-3)",
                  border: active || done ? "1px solid var(--acc)" : "1px solid var(--line)",
                }}>
                  {done ? "✓" : n}
                </span>
                <span style={{ fontSize: 13, color: active ? "var(--text)" : "var(--text-3)" }}>{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: done ? "var(--acc)" : "var(--line)", margin: "0 16px", opacity: 0.5 }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 36 }}>
        {step === 1 && (
          <>
            <div className="h-2 serif" style={{ fontSize: 28, marginBottom: 24 }}>Choose challenge type</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {TYPES.map(({ value, label, desc }) => (
                <div
                  key={value}
                  className="card"
                  style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, cursor: "pointer",
                    borderColor: type === value ? "var(--acc)" : undefined,
                    background: type === value ? "var(--acc-bg)" : undefined,
                  }}
                  onClick={() => setType(value)}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="serif" style={{ fontSize: 22 }}>{label}</span>
                    {type === value && <span style={{ color: "var(--acc)" }}>●</span>}
                  </div>
                  <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="h-2 serif" style={{ fontSize: 28, marginBottom: 24 }}>Verification method</div>
            <div className="col gap-3" style={{ marginBottom: 28 }}>
              {VERIFIERS.map(({ value, desc }) => (
                <div
                  key={value}
                  className="card"
                  style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
                    borderColor: verifier === value ? "var(--acc)" : undefined,
                    background: verifier === value ? "var(--acc-bg)" : undefined,
                  }}
                  onClick={() => setVerifier(value)}
                >
                  <span style={{ color: "var(--acc)", fontSize: 24, fontFamily: "var(--f-mono)", width: 32 }}>{VERIFIER_ICON[value]}</span>
                  <div className="col gap-1 flex-1">
                    <span style={{ fontWeight: 500 }}>{VERIFIER_LABEL[value]}</span>
                    <span className="muted" style={{ fontSize: 12.5 }}>{desc}</span>
                  </div>
                  {verifier === value && <span style={{ color: "var(--acc)" }}>●</span>}
                </div>
              ))}
            </div>
            <div className="col gap-4">
              <div className="field">
                <label>Challenge title</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Make 30 GitHub commits in a month" />
              </div>
              <div className="dots" />
              <div className="eyebrow" style={{ marginBottom: 4 }}>Success criteria</div>
              <CriteriaBuilder verifier={verifier} value={criteria} onChange={setCriteria} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="h-2 serif" style={{ fontSize: 28, marginBottom: 24 }}>Stakes &amp; deadlines</div>
            <div className="col gap-6">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                <div className="field">
                  <label>Buy-in (ETH)</label>
                  <input className="input" value={buyIn} onChange={e => setBuyIn(e.target.value)} placeholder="0.10" />
                  <span className="field-hint">{type === "INDIVIDUAL" ? "Your stake — auto-registered as FOR." : "Min stake to join."}</span>
                </div>
                <TimeInput label="Join window" value={joinVal} onChange={setJoinVal} unit={joinUnit} onUnitChange={setJoinUnit} hint="Betting/joining closes after this." />
                <TimeInput label="Challenge duration" value={durVal} onChange={setDurVal} unit={durUnit} onUnitChange={setDurUnit} hint="Starts when join window closes." />
              </div>
              <div className="card" style={{ padding: 20, background: "var(--bg)" }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Fee structure</div>
                <div className="col gap-2" style={{ fontSize: 13 }}>
                  <div className="row gap-3"><span className="muted">Protocol fee</span><span>2% of losing pool at settlement</span></div>
                  {type === "INDIVIDUAL" && (
                    <div className="row gap-3"><span className="muted">AGAINST cap</span><span>5× buy-in ({(parseFloat(buyIn || "0") * 5).toFixed(2)} ETH)</span></div>
                  )}
                  <div className="row gap-3"><span className="muted">LINK required</span><span>2 LINK (Chainlink Automation deposit)</span></div>
                  <div className="row gap-3"><span className="muted">Oracle gas</span><span>~0.002 ETH est. (Chainlink Functions)</span></div>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="h-2 serif" style={{ fontSize: 28, marginBottom: 24 }}>Review &amp; deploy</div>
            <div className="col gap-3" style={{ marginBottom: 32, fontFamily: "var(--f-mono)", fontSize: 12.5 }}>
              {[
                ["Type",             type],
                ["Verifier",         VERIFIER_LABEL[verifier]],
                ["Title",            title    || "(not set)"],
                ["Criteria",         criteria || "(not set)"],
                ["Buy-in",           `${buyIn} ETH`],
                ["Join window",      `${joinVal} ${joinUnit}`],
                ["Challenge period", `${durVal} ${durUnit}`],
                ...(type === "INDIVIDUAL" ? [["AGAINST cap", `${(parseFloat(buyIn || "0") * 5).toFixed(2)} ETH`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="row" style={{ justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <span className="dim">{k}</span>
                  <span style={{ color: "var(--text-2)" }}>{v}</span>
                </div>
              ))}
            </div>

            {!hasLinkApproval && (
              <div className="card" style={{ padding: 16, marginBottom: 16, background: "var(--bg)", fontSize: 13 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Two-step deploy</div>
                <div className="col gap-2 muted">
                  <div>1. Approve 2 LINK → factory ({(Number(LINK_UPKEEP_AMOUNT) / 1e18).toFixed(0)} LINK for Automation upkeep)</div>
                  <div>2. Call factory.createChallenge() — your buy-in sent as ETH</div>
                </div>
              </div>
            )}

            <TxButton
              label={deployLabel}
              successLabel="Challenge deployed!"
              className={`btn primary lg${isError ? " ghost" : ""}`}
              style={{ justifyContent: "center" }}
              onSubmit={isConnected ? (isError ? resetTx : handleDeploy) : undefined}
              isPending={isPending}
              isSuccess={isSuccess}
              isError={isError}
              disabled={!isConnected || !title || !criteria}
            />
            {isError && error && (
              <div style={{ fontSize: 12, color: "var(--loss)", marginTop: 8, fontFamily: "var(--f-mono)" }}>
                {(error as Error).message?.slice(0, 120) ?? "Transaction failed"}
              </div>
            )}
            <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Deploying calls <span className="chip">factory.createChallenge()</span> — gas est. ~0.006 ETH.
            </div>
          </>
        )}

        <div className="row" style={{ marginTop: 32, justifyContent: "flex-end", gap: 12 }}>
          {step > 1 && <button className="btn ghost" onClick={prev}>← Back</button>}
          {step < 4 && <button className="btn primary" onClick={next}>Continue →</button>}
        </div>
      </div>
    </div>
  );
}
