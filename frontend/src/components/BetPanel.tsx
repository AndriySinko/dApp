"use client";

import { useState } from "react";
import type { Challenge, BetSide } from "@/lib/types";
import { pct, multiplier, formatEth } from "@/lib/utils";
import { TxButton } from "./TxButton";

const PRESETS = [0.05, 0.10, 0.25];

export function BetPanel({ challenge }: { challenge: Challenge }) {
  const [side, setSide] = useState<BetSide>("FOR");
  const [amount, setAmount] = useState("0.10");

  const total = challenge.forPool + challenge.againstPool + challenge.buyIn;
  const forMult  = multiplier(challenge.forPool,     total);
  const agMult   = multiplier(challenge.againstPool, total);
  const forPct   = pct(challenge.forPool, challenge.againstPool);
  const agPct    = 100 - forPct;

  const mult = side === "FOR" ? parseFloat(forMult) : parseFloat(agMult);
  const stake = parseFloat(amount) || 0;
  const payout = isNaN(mult) ? 0 : stake * mult;
  const agCap = challenge.buyIn * 5;
  const agUsed = challenge.againstPool / agCap;

  return (
    <>
      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Place a bet</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          <button
            className="btn"
            style={{
              flexDirection: "column", padding: 16, gap: 4,
              background: side === "FOR" ? "var(--win-bg)" : undefined,
              borderColor: side === "FOR" ? "var(--win)" : undefined,
              color: side === "FOR" ? "var(--win)" : "var(--text-2)",
            }}
            onClick={() => setSide("FOR")}
          >
            <span className="eyebrow" style={{ color: "inherit" }}>FOR</span>
            <span className="num-lg" style={{ color: "inherit" }}>{forMult}</span>
            <span style={{ fontSize: 11, color: "inherit", opacity: 0.7 }}>{forPct}%</span>
          </button>
          <button
            className="btn"
            style={{
              flexDirection: "column", padding: 16, gap: 4,
              background: side === "AGAINST" ? "var(--loss-bg)" : undefined,
              borderColor: side === "AGAINST" ? "var(--loss)" : undefined,
              color: side === "AGAINST" ? "var(--loss)" : "var(--text-2)",
            }}
            onClick={() => setSide("AGAINST")}
          >
            <span className="eyebrow" style={{ color: "inherit" }}>AGAINST</span>
            <span className="num-lg" style={{ color: "inherit" }}>{agMult}</span>
            <span style={{ fontSize: 11, color: "inherit", opacity: 0.7 }}>{agPct}%</span>
          </button>
        </div>

        <div className="field" style={{ marginBottom: 10 }}>
          <label>Amount (ETH)</label>
          <input
            className="input"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="row gap-2" style={{ marginBottom: 18 }}>
          {PRESETS.map(p => (
            <button key={p} className="btn sm" onClick={() => setAmount(String(p))}>
              {p}
            </button>
          ))}
          <button className="btn sm" onClick={() => setAmount("0.50")}>max</button>
        </div>

        <div className="dots" style={{ marginBottom: 14 }} />
        <div className="col gap-2" style={{ fontSize: 12.5 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Side</span>
            <span style={{ color: side === "FOR" ? "var(--win)" : "var(--loss)" }}>{side}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Stake</span>
            <span className="num">{formatEth(stake)}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Payout if you win</span>
            <span className="num" style={{ color: "var(--acc)" }}>{formatEth(payout)}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Protocol fee</span>
            <span className="dim">2% of losing pool</span>
          </div>
        </div>
        <TxButton
          label={`Bet ${formatEth(stake)} ${side}`}
          successLabel="Bet placed!"
          className="btn primary lg"
          style={{ width: "100%", marginTop: 18, justifyContent: "center" }}
        />
        {side === "AGAINST" && (
          <div className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 10, fontFamily: "var(--f-mono)" }}>
            AGAINST cap: {formatEth(agCap)} ({Math.round(agUsed * 100)}% used)
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Contracts</div>
        <div className="col gap-2">
          <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">challenge</span><span>0xC...0142</span></div>
          <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">verifier</span><span>0xV...API_</span></div>
          <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">treasury</span><span>0xT...0002</span></div>
          <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">factory</span><span>0xF...0001</span></div>
        </div>
      </div>
    </>
  );
}
