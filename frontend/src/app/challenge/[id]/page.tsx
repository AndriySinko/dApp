"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Donut, Sparkline } from "@/components/ui";
import { BetPanel } from "@/components/BetPanel";
import { StateIndicator } from "@/components/StateIndicator";
import { CHALLENGES, BETS, FOR_PROBABILITY_SPARKLINE } from "@/lib/data";
import { VERIFIER_ICON, VERIFIER_LABEL, TYPE_LABEL, pct, formatEth, timeLeft, multiplier } from "@/lib/utils";

type Tab = "Market" | "Details" | "Verifier" | "On-chain";
const TABS: Tab[] = ["Market", "Details", "Verifier", "On-chain"];

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Market");

  const challenge = CHALLENGES.find(c => c.id === id) ?? CHALLENGES[0];
  const bets = BETS.filter(b => b.challengeId === challenge.id);
  const total = challenge.forPool + challenge.againstPool + challenge.buyIn;
  const forP  = pct(challenge.forPool, challenge.againstPool);
  const agP   = 100 - forP;

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
          <div className="row gap-3" style={{ fontSize: 13 }}>
            <span className="avatar sm" />
            <span>by <span style={{ color: "var(--text)" }}>{challenge.creator}</span></span>
            <span className="dim">·</span>
            <span className="chip">{challenge.creatorAddress.slice(0, 6)}...{challenge.creatorAddress.slice(-4)}</span>
            <span className="dim">·</span>
            <span className="muted">{timeLeft(challenge.deadline)}</span>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn sm">⌥ share</button>
          <button className="btn sm">↗ Etherscan</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        <div className="col gap-4">
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
                  {challenge.bettorsFor} bettors backing · {challenge.bettorsAgainst} fading
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line-soft)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden", minWidth: 280 }}>
                <div style={{ padding: 14, background: "var(--bg)" }}>
                  <div className="eyebrow" style={{ color: "var(--win)" }}>FOR</div>
                  <div className="num-lg" style={{ marginTop: 4 }}>{formatEth(challenge.forPool)}</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{multiplier(challenge.forPool, total)} payout</div>
                </div>
                <div style={{ padding: 14, background: "var(--bg)" }}>
                  <div className="eyebrow" style={{ color: "var(--loss)" }}>AGAINST</div>
                  <div className="num-lg" style={{ marginTop: 4 }}>{formatEth(challenge.againstPool)}</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{multiplier(challenge.againstPool, total)} payout</div>
                </div>
              </div>
            </div>
            <div className="bar split">
              <div className="for" style={{ width: `${forP}%` }} />
              <div className="against" style={{ width: `${agP}%` }} />
            </div>
          </div>

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
                  <Sparkline points={FOR_PROBABILITY_SPARKLINE} color="var(--win)" />
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
                  <div className="eyebrow">Recent bets</div>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>when</th><th>side</th><th>bettor</th>
                      <th style={{ textAlign: "right" }}>amount</th>
                      <th style={{ textAlign: "right" }}>tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.map(b => (
                      <tr key={b.id}>
                        <td><span className="mono dim">−{timeLeft(b.timestamp).replace("in ", "")}</span></td>
                        <td><span className={b.side === "FOR" ? "tag win" : "tag loss"}>{b.side}</span></td>
                        <td><div className="row gap-2"><span className="avatar sm" /><span className="mono">{b.bettor}</span></div></td>
                        <td style={{ textAlign: "right" }}><span className="num">{formatEth(b.amount)}</span></td>
                        <td style={{ textAlign: "right" }}><span className="dim">↗</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "Details" && (
            <div className="card" style={{ padding: 28 }}>
              <div className="col gap-4">
                <div className="field">
                  <label>Description</label>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-2)", marginTop: 4 }}>{challenge.description}</p>
                </div>
                <div className="divider" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="col gap-2"><div className="eyebrow">Buy-in</div><div className="num-lg">{formatEth(challenge.buyIn)}</div></div>
                  <div className="col gap-2"><div className="eyebrow">Deadline</div><div className="num" style={{ fontSize: 14 }}>{challenge.deadline.toUTCString().slice(0, 22)}</div></div>
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
              <div className="col gap-3" style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-3)", lineHeight: 1.8 }}>
                {challenge.verifier === "ON_CHAIN" && <>
                  <div><span className="dim">→</span> read participant.balance at deadline</div>
                  <div><span className="dim">→</span> require balance ≥ {formatEth(challenge.buyIn)}</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> sync receiveVerdict(pass/fail)</div>
                </>}
                {challenge.verifier === "API_ORACLE" && <>
                  <div><span className="dim">→</span> Chainlink Functions _sendRequest(jsSrc, args)</div>
                  <div><span className="dim">→</span> Functions.makeHttpRequest(apiEndpoint)</div>
                  <div><span className="dim">→</span> fulfillRequest(reqId, response)</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> async receiveVerdict(pass/fail)</div>
                </>}
                {challenge.verifier === "AI_ORACLE" && <>
                  <div><span className="dim">→</span> participant.submitEvidence(ipfsCid, dailyNonce)</div>
                  <div><span className="dim">→</span> Gemini Vision: criteria + nonce check per photo</div>
                  <div><span className="dim">→</span> all_days_passed ? 1 : 0</div>
                  <div><span style={{ color: "var(--acc)" }}>↳</span> async receiveVerdict(pass/fail)</div>
                </>}
              </div>
            </div>
          )}

          {tab === "On-chain" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {[
                { event: "ChallengeCreated",   by: challenge.creator,    age: "7d",  tx: "0xabc1...ef23" },
                { event: "BetPlaced(FOR)",      by: "0xb2...4f",          age: "12m", tx: "0x5678...ef90" },
                { event: "BetPlaced(AGAINST)",  by: "0x9e...0c",          age: "47m", tx: "0x1234...cd78" },
                { event: "BetPlaced(FOR)",      by: "0xa1...22",          age: "2h",  tx: "0xdef4...ab56" },
              ].map((e, i, arr) => (
                <div key={i} className="row" style={{ padding: "14px 20px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-soft)" : "none", justifyContent: "space-between", fontSize: 12.5 }}>
                  <div className="row gap-3">
                    <span className="mono dim" style={{ width: 40 }}>−{e.age}</span>
                    <span className="tag acc">{e.event}</span>
                    <span className="muted">by</span>
                    <span className="mono">{e.by}</span>
                  </div>
                  <span className="chip">{e.tx}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col gap-4" style={{ position: "sticky", top: 80, alignSelf: "flex-start" }}>
          <BetPanel challenge={challenge} />
        </div>
      </div>
    </div>
  );
}
