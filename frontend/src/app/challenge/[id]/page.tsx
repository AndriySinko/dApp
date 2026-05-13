"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { Donut, Sparkline } from "@/components/ui";
import { BetPanel } from "@/components/BetPanel";
import { StateIndicator } from "@/components/StateIndicator";
import { WithdrawCard, BindAccountCard, SettleFallback } from "@/components/ActionCards";
import { VERIFIER_ICON, VERIFIER_LABEL, TYPE_LABEL, pct, formatEth, timeLeft, multiplier } from "@/lib/utils";
import { type Challenge, type ChallengeType, type ChallengeState, type VerifierType } from "@/lib/types";
import { useChallenge } from "@/lib/hooks/useChallenge";
import { useChallengeFeed } from "@/lib/hooks/useChallengeFeed";

type ChainData = {
  state?: ChallengeState;
  joinDeadline?: bigint;
  challengeDeadline?: bigint;
  buyIn?: bigint;
  participantCount?: number;
  forPool?: bigint;
  againstPool?: bigint;
  bettorsFor?: bigint;
  bettorsAgainst?: bigint;
  isRegistered?: boolean;
  userPending?: bigint;
  creator?: `0x${string}`;
  isLoading: boolean;
};

type Tab = "Market" | "Details" | "Verifier" | "On-chain";
const TABS: Tab[] = ["Market", "Details", "Verifier", "On-chain"];

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { address: userAddress } = useAccount();
  const [tab, setTab] = useState<Tab>("Market");

  const challengeAddress = id as `0x${string}`;

  // All metadata comes from Subsquid — no factory call needed
  const [challengeType, setChallengeType] = useState<ChallengeType>("INDIVIDUAL");
  const [verifierType,  setVerifierType]  = useState<VerifierType>("ON_CHAIN");
  const [verifierKnown, setVerifierKnown] = useState(false);
  const [title,         setTitle]         = useState("Loading…");
  const [creatorAddress, setCreatorAddress] = useState<string>(challengeAddress);

  // Criteria + verifier hint
  const [criteriaDisplay, setCriteriaDisplay] = useState<string>("");
  const [verifierHint, setVerifierHint] = useState<"github"|"strava"|"generic">("generic");
  const [rawCriteriaStr, setRawCriteriaStr] = useState<string>("");

  const chainData = useChallenge(challengeAddress, challengeType, userAddress as `0x${string}` | undefined) as ChainData;
  const { activities: challengeActivities, isLoading: feedLoading } = useChallengeFeed(challengeAddress);

  const { data: verdictsData } = useReadContract({
    address: challengeAddress,
    abi: [
      { type: "function", name: "verdictsCompleted", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
      { type: "function", name: "verdictsExpected",  inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
    ] as const,
    functionName: "verdictsCompleted",
    query: { enabled: !!challengeAddress && chainData.state === "VERIFY_PENDING" },
  });
  const { data: verdictsExpected } = useReadContract({
    address: challengeAddress,
    abi: [{ type: "function", name: "verdictsExpected", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }] as const,
    functionName: "verdictsExpected",
    query: { enabled: !!challengeAddress && chainData.state === "VERIFY_PENDING" },
  });
  const allVerdictsIn = verdictsData !== undefined && verdictsExpected !== undefined && (verdictsData as bigint) >= (verdictsExpected as bigint) && (verdictsExpected as bigint) > BigInt(0);

  const isCreator = userAddress && chainData.creator && userAddress.toLowerCase() === chainData.creator.toLowerCase();
  // Show bind card for any API Oracle challenge in JoinOpen — registered or not
  // (unregistered users see it as a prompt to join+bind; submit disabled until registered)
  // Only show standalone bind card for INDIVIDUAL — group/public handle binding inside the join panel
  const showBindAccount = verifierKnown && verifierType === "API_ORACLE" && chainData.state === "JOIN_OPEN" && challengeType === "INDIVIDUAL";
  const showSettle = chainData.state === "VERIFY_PENDING" && allVerdictsIn;
  const showWithdraw = chainData.state === "SETTLED" && chainData.userPending !== undefined && chainData.userPending > BigInt(0);

  // Advance state button — when deadline passed but Chainlink hasn't fired yet
  const now = Math.floor(Date.now() / 1000);
  const joinDeadlinePassed      = chainData.joinDeadline      && now >= Number(chainData.joinDeadline);
  const challengeDeadlinePassed = chainData.challengeDeadline && now >= Number(chainData.challengeDeadline);
  const canAdvanceState = (
    (chainData.state === "JOIN_OPEN"  && joinDeadlinePassed) ||
    (chainData.state === "ACTIVE"     && challengeDeadlinePassed)
  );
  const PERF_ABI = [{ type: "function", name: "performUpkeep", inputs: [{ type: "bytes" }], outputs: [], stateMutability: "nonpayable" }] as const;
  const { writeContract: performUpkeep, isPending: isAdvancing } = useWriteContract();

  const forPool    = chainData.forPool     != null ? parseFloat(formatEther(chainData.forPool))     : 0;
  const againstPool = chainData.againstPool != null ? parseFloat(formatEther(chainData.againstPool)) : 0;
  const buyIn       = chainData.buyIn       != null ? parseFloat(formatEther(chainData.buyIn))       : 0;
  const total       = forPool + againstPool + buyIn;
  const forP        = pct(forPool, againstPool);
  const agP         = 100 - forP;

  const challenge: Challenge = {
    id:               challengeAddress,
    address:          challengeAddress,
    title,
    type:             challengeType,
    verifier:         verifierType,
    state:            chainData.state ?? "JOIN_OPEN",
    creator:          `${creatorAddress.slice(0, 6)}…${creatorAddress.slice(-4)}`,
    creatorAddress,
    buyIn,
    joinDeadline:     chainData.joinDeadline      ? new Date(Number(chainData.joinDeadline)      * 1000) : new Date(),
    challengeDeadline: chainData.challengeDeadline ? new Date(Number(chainData.challengeDeadline) * 1000) : new Date(),
    forPool:          forPool     || undefined,
    againstPool:      againstPool || undefined,
    bettorsFor:       chainData.bettorsFor     ? Number(chainData.bettorsFor)     : 0,
    bettorsAgainst:   chainData.bettorsAgainst ? Number(chainData.bettorsAgainst) : 0,
    participants:     chainData.participantCount,
  };

  // Fix 1: fetch criteria from Subsquid (contract has no external getter)
  useEffect(() => {
    if (!challengeAddress) return;
    const SQUID = process.env.NEXT_PUBLIC_SQUID_URL;
    if (!SQUID) return;
    fetch(SQUID, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { challengeById(id: "${challengeAddress.toLowerCase()}") { criteria verifier type title creator } }`,
      }),
    })
      .then(r => r.json())
      .then(data => {
        const c = data?.data?.challengeById;
        if (!c) return;
        if (c.verifier) { setVerifierType(c.verifier as VerifierType); setVerifierKnown(true); }
        if (c.type)     setChallengeType(c.type as ChallengeType);
        if (c.title)    setTitle(c.title);
        if (c.creator)  setCreatorAddress(c.creator);
        const raw: string = c.criteria ?? "";
        if (!raw) return;
        setRawCriteriaStr(raw);
        if (raw.startsWith("ipfs:")) {
          fetch(`https://ipfs.io/ipfs/${raw.slice(5).trim()}`)
            .then(r => r.json())
            .then(json => {
              setCriteriaDisplay(json.criteria || json.prompt || raw);
              if (json.sources?.[0]?.url?.includes("github")) setVerifierHint("github");
              else if (json.sources?.[0]?.url?.includes("strava")) setVerifierHint("strava");
            })
            .catch(() => setCriteriaDisplay(raw));
        } else {
          if (raw.startsWith("github:")) setVerifierHint("github");
          else if (raw.startsWith("strava:")) setVerifierHint("strava");
          setCriteriaDisplay(raw);
        }
      })
      .catch(() => {});
  }, [challengeAddress]);

  return (
    <div className="container-wide fade-in" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <div className="row gap-2 muted" style={{ fontSize: 12, marginBottom: 24, fontFamily: "var(--f-mono)" }}>
        <Link href="/dashboard" className="dim">← challenges</Link>
        <span className="dim">/</span>
        <span>{challenge.id}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div className="row gap-2" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <span className="tag">{TYPE_LABEL[challenge.type]}</span>
            <span className="tag" style={{ color: "var(--text-2)" }}>
              <span style={{ color: "var(--acc)" }}>{VERIFIER_ICON[challenge.verifier]}</span>{" "}
              {VERIFIER_LABEL[challenge.verifier]}
            </span>
            <StateIndicator state={challenge.state} />
            <span className="tag">{challenge.id}</span>
          </div>
          <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 16 }}>
            {challenge.title}
          </h1>
          {canAdvanceState && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--r)", border: "1px dashed var(--acc)", background: "var(--acc-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {chainData.state === "JOIN_OPEN" ? "Join window closed." : "Challenge ended."} Chainlink automation pending.
              </span>
              <button className="btn primary sm" disabled={isAdvancing}
                onClick={() => performUpkeep({ address: challengeAddress, abi: PERF_ABI, functionName: "performUpkeep", args: ["0x"] })}>
                {isAdvancing ? <><span className="spinner-dot" />Advancing…</> : "Advance state →"}
              </button>
            </div>
          )}
          {showSettle && (
            <div style={{ marginBottom: 16 }}>
              <SettleFallback challengeAddress={challengeAddress} />
            </div>
          )}
          <div className="row gap-3" style={{ fontSize: 13 }}>
            <span className="avatar sm" />
            <span>by <span style={{ color: "var(--text)" }}>{challenge.creator}</span></span>
            <span className="dim">·</span>
            <span className="chip">{challenge.creatorAddress.slice(0, 6)}...{challenge.creatorAddress.slice(-4)}</span>
            <span className="dim">·</span>
            <span className="muted">{timeLeft(challenge.challengeDeadline)}</span>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn sm">⌥ share</button>
          <button className="btn sm">↗ Etherscan</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        <div className="col gap-4">
          {challengeType === "INDIVIDUAL" ? (
            <div className="card" style={{ padding: 28 }}>
              <div className="row gap-6" style={{ alignItems: "center", marginBottom: 24 }}>
                <Donut pct={forP} color="var(--win)" size={120} stroke={12} />
                <div className="col gap-2 flex-1">
                  <div className="eyebrow">Implied probability of success</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span className="serif" style={{ fontSize: 80, lineHeight: 1, color: "var(--win)" }}>{forP}%</span>
                    <span className="muted">FOR</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {challenge.bettorsFor ?? 0} bettors backing · {challenge.bettorsAgainst ?? 0} fading
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden", minWidth: 280 }}>
                  <div style={{ padding: 14, background: "var(--bg)" }}>
                    <div className="eyebrow" style={{ color: "var(--win)" }}>FOR</div>
                    <div className="num-lg" style={{ marginTop: 4 }}>{formatEth(forPool)}</div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{againstPool === 0 ? "—" : multiplier(forPool, forPool + againstPool)} payout</div>
                  </div>
                  <div style={{ padding: 14, background: "var(--bg)" }}>
                    <div className="eyebrow" style={{ color: "var(--loss)" }}>AGAINST</div>
                    <div className="num-lg" style={{ marginTop: 4 }}>{formatEth(againstPool)}</div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{multiplier(againstPool, total)} payout</div>
                  </div>
                </div>
              </div>
              <div className="bar split">
                <div className="for" style={{ width: `${forP}%` }} />
                <div className="against" style={{ width: `${agP}%` }} />
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 28 }}>
              <div className="row gap-6" style={{ alignItems: "center" }}>
                <div className="col gap-2 flex-1">
                  <div className="eyebrow">Participants</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span className="serif" style={{ fontSize: 80, lineHeight: 1, color: "var(--acc)" }}>
                      {chainData.participantCount ?? 0}
                    </span>
                    <span className="muted">joined</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    min buy-in · {chainData.isLoading ? "…" : formatEth(challenge.buyIn)} ETH each
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden", minWidth: 280 }}>
                  <div style={{ padding: 14, background: "var(--bg)" }}>
                    <div className="eyebrow">Total staked</div>
                    <div className="num-lg" style={{ marginTop: 4 }}>
                      {formatEth((chainData.participantCount ?? 0) * challenge.buyIn)}
                    </div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>min estimate</div>
                  </div>
                  <div style={{ padding: 14, background: "var(--bg)" }}>
                    <div className="eyebrow">Payout if all pass</div>
                    <div className="num-lg" style={{ marginTop: 4 }}>stake back</div>
                    <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>losers' pool → winners</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="row gap-6" style={{ borderBottom: "1px solid var(--line-soft)" }}>
            {TABS.map(t => (
              <button
                key={t}
                style={{
                  padding: "12px 0", fontSize: 13, fontWeight: 500, marginBottom: -1,
                  borderBottom: tab === t ? "1px solid var(--text)" : "1px solid transparent",
                  color: tab === t ? "var(--text)" : "var(--text-3)",
                }}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Market" && (
            <div className="col gap-4">
              <div className="card" style={{ padding: 24 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <div className="eyebrow">FOR probability · 24h</div>
                </div>
                <div style={{ height: 220 }}>
                  <Sparkline points={[]} color="var(--win)" />
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
                  <div className="eyebrow">Activity</div>
                </div>
                {feedLoading && (
                  <div style={{ padding: "24px 20px", color: "var(--text-4)", fontSize: 13, fontFamily: "var(--f-mono)" }}>Loading…</div>
                )}
                {!feedLoading && challengeActivities.length === 0 && (
                  <div style={{ padding: "24px 20px", color: "var(--text-4)", fontSize: 13, fontFamily: "var(--f-mono)" }}>No activity yet.</div>
                )}
                {!feedLoading && challengeActivities.length > 0 && (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>event</th><th>address</th>
                        <th style={{ textAlign: "right" }}>value</th>
                        <th style={{ textAlign: "right" }}>time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {challengeActivities.map(a => {
                        const typeColor = a.activityType === "Won" || a.activityType === "BetFor" ? "var(--win)"
                          : a.activityType === "Lost" || a.activityType === "BetAgainst" ? "var(--loss)"
                          : a.activityType === "Created" ? "var(--acc)"
                          : undefined;
                        return (
                          <tr key={a.id}>
                            <td><span className="tag" style={typeColor ? { color: typeColor } : undefined}>{a.activityType}</span></td>
                            <td><span className="mono dim" style={{ fontSize: 11 }}>{a.user.slice(0, 6)}…{a.user.slice(-4)}</span></td>
                            <td style={{ textAlign: "right" }} className="num">
                              {a.amount > 0 ? `Ξ ${a.amount.toFixed(4)}`
                                : a.repDelta !== 0 ? <span style={{ color: a.repDelta > 0 ? "var(--win)" : "var(--loss)" }}>{a.repDelta > 0 ? "+" : ""}{a.repDelta} rep</span>
                                : "—"}
                            </td>
                            <td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--f-mono)", color: "var(--text-3)" }}>
                              {a.timestamp.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === "Details" && (
            <div className="card" style={{ padding: 28 }}>
              <div className="col gap-4">
                <div className="field">
                  <label>Description</label>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-2)", marginTop: 4 }}>{criteriaDisplay || challenge.criteria || "—"}</p>
                </div>
                <div className="divider" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="col gap-2"><div className="eyebrow">Buy-in</div><div className="num-lg">{chainData.isLoading ? "…" : formatEth(challenge.buyIn)}</div></div>
                  <div className="col gap-2"><div className="eyebrow">Join deadline</div><div className="num" style={{ fontSize: 14 }}>{challenge.joinDeadline.toLocaleString()}</div></div>
                  <div className="col gap-2"><div className="eyebrow">Challenge deadline</div><div className="num" style={{ fontSize: 14 }}>{challenge.challengeDeadline.toLocaleString()}</div></div>
                  <div className="col gap-2"><div className="eyebrow">Type</div><span className="tag">{TYPE_LABEL[challenge.type]}</span></div>
                  <div className="col gap-2"><div className="eyebrow">Creator</div><div className="mono" style={{ fontSize: 12 }}>{challenge.creator}</div></div>
                </div>
              </div>
            </div>
          )}

          {tab === "Verifier" && (
            <div className="card" style={{ padding: 28 }}>
              <div className="row gap-3" style={{ marginBottom: 20 }}>
                <span style={{ color: "var(--acc)", fontSize: 28, fontFamily: "var(--f-mono)" }}>{VERIFIER_ICON[challenge.verifier]}</span>
                <div className="h-2 serif" style={{ fontSize: 24 }}>{VERIFIER_LABEL[challenge.verifier]}</div>
              </div>

              {/* Criteria description */}
              {criteriaDisplay && (
                <div className="card" style={{ padding: 16, marginBottom: 20, background: "var(--acc-bg)", borderColor: "var(--acc)" }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Success condition</div>
                  <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, fontFamily: "var(--f-mono)", wordBreak: "break-all" }}>
                    {criteriaDisplay}
                  </p>
                </div>
              )}

              {/* How verification works */}
              <div className="col gap-3" style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-3)", lineHeight: 1.8 }}>
                {challenge.verifier === "ON_CHAIN" && <>
                  <div><span className="dim">→</span> reads on-chain state at challenge deadline (synchronous)</div>
                  {rawCriteriaStr.startsWith("eth:") && <div><span className="dim">→</span> checks native ETH balance of participant</div>}
                  {rawCriteriaStr.startsWith("erc20:") && <div><span className="dim">→</span> calls balanceOf(participant) on ERC-20 contract</div>}
                  {rawCriteriaStr.startsWith("nft:") && <div><span className="dim">→</span> calls balanceOf(participant) on ERC-721 contract</div>}
                  {rawCriteriaStr.startsWith("call:") && <div><span className="dim">→</span> staticcall to contract — any view function</div>}
                  {rawCriteriaStr.startsWith("and:") && <div><span className="dim">→</span> all sub-conditions must pass</div>}
                  {rawCriteriaStr.startsWith("or:") && <div><span className="dim">→</span> any sub-condition must pass</div>}
                  <div><span style={{ color: "var(--acc)" }}>↳</span> verdict delivered in same transaction</div>
                </>}
                {challenge.verifier === "API_ORACLE" && <>
                  <div><span className="dim">→</span> at deadline, Chainlink Functions calls external API</div>
                  {verifierHint === "github" && <div><span className="dim">→</span> queries GitHub API with participant's username</div>}
                  {verifierHint === "strava" && <div><span className="dim">→</span> queries Strava API with participant's access token</div>}
                  {rawCriteriaStr.startsWith("ipfs:") && <div><span className="dim">→</span> loads expression engine config from IPFS</div>}
                  <div><span className="dim">→</span> evaluates condition against API response</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> verdict delivered async via Chainlink DON callback</div>
                </>}
                {challenge.verifier === "AI_ORACLE" && <>
                  <div><span className="dim">→</span> participant submits a photo with daily nonce each day</div>
                  <div><span className="dim">→</span> photos stored on IPFS</div>
                  <div><span className="dim">→</span> at deadline, Chainlink Functions sends each photo to Gemini Vision</div>
                  <div><span className="dim">→</span> Gemini checks: {criteriaDisplay ? `"${criteriaDisplay.slice(0, 80)}${criteriaDisplay.length > 80 ? "…" : ""}"` : "criteria + nonce visible"}</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> verdict delivered async via Chainlink DON callback</div>
                </>}
              </div>
            </div>
          )}

          {tab === "On-chain" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="eyebrow">All events</div>
                <a href={`https://sepolia.etherscan.io/address/${challengeAddress}`} target="_blank" rel="noopener noreferrer" className="chip" style={{ color: "var(--acc)", fontSize: 11 }}>
                  Etherscan ↗
                </a>
              </div>
              {feedLoading && (
                <div style={{ padding: "24px 20px", color: "var(--text-4)", fontSize: 13, fontFamily: "var(--f-mono)" }}>Loading…</div>
              )}
              {!feedLoading && challengeActivities.length === 0 && (
                <div style={{ padding: "24px 20px", color: "var(--text-4)", fontSize: 13, fontFamily: "var(--f-mono)" }}>No indexed events yet.</div>
              )}
              {!feedLoading && challengeActivities.length > 0 && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>event</th><th>address</th>
                      <th style={{ textAlign: "right" }}>value</th>
                      <th style={{ textAlign: "right" }}>tx</th>
                      <th style={{ textAlign: "right" }}>time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challengeActivities.map(a => {
                      const typeColor = a.activityType === "Won" || a.activityType === "BetFor" ? "var(--win)"
                        : a.activityType === "Lost" || a.activityType === "BetAgainst" ? "var(--loss)"
                        : a.activityType === "Created" ? "var(--acc)"
                        : undefined;
                      return (
                        <tr key={a.id}>
                          <td><span className="tag" style={typeColor ? { color: typeColor } : undefined}>{a.activityType}</span></td>
                          <td><span className="mono dim" style={{ fontSize: 11 }}>{a.user.slice(0, 6)}…{a.user.slice(-4)}</span></td>
                          <td style={{ textAlign: "right" }} className="num">
                            {a.amount > 0 ? `Ξ ${a.amount.toFixed(4)}`
                              : a.repDelta !== 0 ? <span style={{ color: a.repDelta > 0 ? "var(--win)" : "var(--loss)" }}>{a.repDelta > 0 ? "+" : ""}{a.repDelta} rep</span>
                              : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {a.txHash ? (
                              <a href={`https://sepolia.etherscan.io/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" className="chip" style={{ fontSize: 10, color: "var(--acc)" }}>
                                {a.txHash.slice(0, 6)}… ↗
                              </a>
                            ) : <span className="dim" style={{ fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ textAlign: "right", fontSize: 11, fontFamily: "var(--f-mono)", color: "var(--text-3)" }}>
                            {a.timestamp.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="col gap-4" style={{ position: "sticky", top: 80, alignSelf: "flex-start" }}>
          {showWithdraw && (
            <WithdrawCard
              challengeAddress={challengeAddress}
              challengeType={challengeType}
              pendingWei={chainData.userPending!}
            />
          )}
          {showBindAccount && (
            <BindAccountCard
              challengeAddress={challengeAddress}
              challengeType={challengeType}
              verifierHint={verifierHint}
              isRegistered={chainData.isRegistered}
              criteria={rawCriteriaStr}
              alreadyBound={chainData.boundAccount || undefined}
            />
          )}
          <BetPanel challenge={challenge} />
        </div>
      </div>
    </div>
  );
}
