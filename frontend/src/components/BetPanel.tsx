"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import type { Challenge, BetSide } from "@/lib/types";
import { pct, multiplier, formatEth } from "@/lib/utils";
import { TxButton } from "./TxButton";
import { usePlaceBet } from "@/lib/hooks/usePlaceBet";
import { useJoinGroup } from "@/lib/hooks/useJoinGroup";

function detectServiceLabel(criteria: string): string {
  if (criteria.startsWith("chess:"))      return "Chess.com username";
  if (criteria.startsWith("lichess:"))    return "Lichess username";
  if (criteria.startsWith("github:"))     return "GitHub username";
  if (criteria.startsWith("strava:"))     return "Strava access token";
  if (criteria.startsWith("leetcode:"))   return "LeetCode username";
  if (criteria.startsWith("duolingo:"))   return "Duolingo username";
  if (criteria.startsWith("codeforces:")) return "Codeforces handle";
  return "Off-chain account ID";
}

const PRESETS = [0.05, 0.10, 0.25];

export function BetPanel({ challenge }: { challenge: Challenge }) {
  const [side, setSide] = useState<BetSide>("FOR");
  const [amount, setAmount] = useState("0.10");

  const forPool     = challenge.forPool    ?? 0;
  const againstPool = challenge.againstPool ?? 0;
  const total    = forPool + againstPool + challenge.buyIn;
  // FOR bettors win from againstPool only; AGAINST bettors win forPool + buyIn
  const forMult  = againstPool === 0 ? "—" : multiplier(forPool, forPool + againstPool);
  const agMult   = multiplier(againstPool, total);
  const forPct   = pct(forPool, againstPool);
  const agPct    = 100 - forPct;

  const mult = side === "FOR" ? parseFloat(forMult) : parseFloat(agMult);
  const stake = parseFloat(amount) || 0;
  const payout = isNaN(mult) ? 0 : stake * mult;
  const agCap = challenge.buyIn * 5;
  const agUsed = againstPool / agCap;

  const challengeAddress = challenge.address as `0x${string}` | undefined;
  const { address: userAddress } = useAccount();
  const isCreator = !!userAddress && !!challenge.creatorAddress &&
    userAddress.toLowerCase() === challenge.creatorAddress.toLowerCase();
  const { placeBet, isPending, isConfirming, isSuccess, error } = usePlaceBet(challengeAddress);
  const { join, isPending: joinPending, isConfirming: joinConfirming, isSuccess: joinSuccess, error: joinError } =
    useJoinGroup(challengeAddress, challenge.type);

  const handleBet = () => {
    if (!challengeAddress) return;
    const amountWei = parseEther(amount || "0");
    placeBet(side === "FOR", amountWei);
  };

  const isGroupType = challenge.type === "GROUP" || challenge.type === "PUBLIC";
  const canAct = challenge.state === "JOIN_OPEN" && !!challengeAddress;

  const isApiOracle = challenge.verifier === "API_ORACLE";
  const [username, setUsername] = useState("");
  const serviceLabel = detectServiceLabel(challenge.criteria ?? "");

  const handleJoin = () => {
    if (!challengeAddress) return;
    const amountWei = parseEther(amount || "0");
    join(amountWei, isApiOracle ? username.trim() : undefined);
  };

  if (isGroupType) {
    return (
      <>
        <div className="card" style={{ padding: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Join challenge</div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Stake (ETH) — min {formatEth(challenge.buyIn)}</label>
            <input className="input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="row gap-2" style={{ marginBottom: isApiOracle ? 14 : 18 }}>
            {PRESETS.map(p => (
              <button key={p} className="btn sm" onClick={() => setAmount(String(p))}>{p}</button>
            ))}
          </div>
          {isApiOracle && (
            <div className="field" style={{ marginBottom: 18 }}>
              <label>{serviceLabel}</label>
              <input
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={serviceLabel}
                disabled={joinSuccess}
              />
              <div className="dim mono" style={{ fontSize: 10, marginTop: 4 }}>Required — used by the oracle to verify your result</div>
            </div>
          )}
          <div className="dots" style={{ marginBottom: 14 }} />
          <div className="col gap-2" style={{ fontSize: 12.5, marginBottom: 18 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Your stake</span>
              <span className="num">{formatEth(stake)}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Protocol fee</span>
              <span className="dim">2% of losing pool</span>
            </div>
            {challenge.type === "PUBLIC" && (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Treasury bonus</span>
                <span style={{ color: "var(--win)" }}>flat prize / winners</span>
              </div>
            )}
          </div>
          {joinError && (
            <div className="muted" style={{ fontSize: 11, color: "var(--loss)", marginBottom: 10, fontFamily: "var(--f-mono)" }}>
              {(joinError as Error).message?.slice(0, 80)}
            </div>
          )}
          <TxButton
            label={
              !canAct ? (challenge.state === "SETTLED" ? "Settled" : "Joining closed")
              : isApiOracle && !username.trim() ? `Enter your ${serviceLabel} first`
              : `Join — stake ${formatEth(stake)}`
            }
            successLabel={isApiOracle ? "Joined & account bound!" : "Joined!"}
            className="btn primary lg"
            style={{ width: "100%", justifyContent: "center" }}
            onSubmit={canAct && (!isApiOracle || username.trim()) ? handleJoin : undefined}
            isPending={joinPending || joinConfirming}
            isSuccess={joinSuccess}
            disabled={!canAct || (isApiOracle && !username.trim())}
          />
        </div>
        <div className="card" style={{ padding: 20, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Contracts</div>
          <div className="col gap-2">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="dim">challenge</span>
              <span>{challengeAddress ? `${challengeAddress.slice(0, 6)}...${challengeAddress.slice(-4)}` : "—"}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="dim">type</span>
              <span>{challenge.type}</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  const canBet = canAct && !isCreator;
  const betLabel = isCreator ? "Creator cannot bet" : `Bet ${formatEth(stake)} ${side}`;

  return (
    <>
      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Place a bet</div>
        {isCreator && (
          <div className="muted" style={{ fontSize: 12, marginBottom: 12, color: "var(--text-2)", fontFamily: "var(--f-mono)" }}>
            You created this challenge — you cannot bet on it.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18, opacity: isCreator ? 0.4 : 1, pointerEvents: isCreator ? "none" : undefined }}>
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
          <button className="btn sm" onClick={() => setAmount(String(agCap))}>max</button>
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

        {error && (
          <div className="muted" style={{ fontSize: 11, color: "var(--loss)", marginTop: 10, fontFamily: "var(--f-mono)" }}>
            {(error as Error).message?.slice(0, 80)}
          </div>
        )}

        <TxButton
          label={canBet ? betLabel : challenge.state === "SETTLED" ? "Challenge settled" : "Betting closed"}
          successLabel="Bet placed!"
          className="btn primary lg"
          style={{ width: "100%", marginTop: 18, justifyContent: "center" }}
          onSubmit={canBet ? handleBet : undefined}
          isPending={isPending || isConfirming}
          isSuccess={isSuccess}
          disabled={!canBet}
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
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="dim">challenge</span>
            <span>{challengeAddress ? `${challengeAddress.slice(0, 6)}...${challengeAddress.slice(-4)}` : "—"}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}><span className="dim">verifier</span><span>{challenge.verifier}</span></div>
        </div>
      </div>
    </>
  );
}
