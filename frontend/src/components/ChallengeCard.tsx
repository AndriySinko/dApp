import Link from "next/link";
import type { Challenge } from "@/lib/types";
import { VERIFIER_ICON, VERIFIER_LABEL, TYPE_LABEL, pct, formatEth } from "@/lib/utils";
import { StateIndicator } from "./StateIndicator";

export function ChallengeCard({ c }: { c: Challenge }) {
  const effectiveForPool = c.type === "INDIVIDUAL" ? (c.forPool || c.buyIn) : (c.forPool ?? 0);
  const forP = pct(effectiveForPool, c.againstPool ?? 0);
  const agP  = 100 - forP;
  const hasMarket = c.type === "INDIVIDUAL" && (c.forPool !== undefined || c.againstPool !== undefined);
  const tvl = c.type === "INDIVIDUAL"
    ? (c.forPool ?? 0) + (c.againstPool ?? 0)
    : (c.participants ?? 0) * c.buyIn;

  return (
    <tr>
      <td><span className="mono dim" style={{ fontSize: 11 }}>{c.id}</span></td>
      <td>
        <div className="col gap-2">
          <Link href={`/challenge/${c.id}`} style={{ fontWeight: 500 }}>{c.title}</Link>
          <div className="row gap-3 muted" style={{ fontSize: 12 }}>
            <span>by <span style={{ color: "var(--text-2)" }}>{c.creator}</span></span>
            <span>·</span>
            <span>{c.state === "SETTLED" ? "settled" : c.state === "ACTIVE" && c.daysComplete != null ? `${c.daysComplete} / ${c.totalDays} days` : ""}</span>
          </div>
        </div>
      </td>
      <td><span className="tag">{TYPE_LABEL[c.type]}</span></td>
      <td>
        <span className="tag" style={{ color: "var(--text-2)" }}>
          <span style={{ color: "var(--acc)" }}>{VERIFIER_ICON[c.verifier]}</span>{" "}
          {VERIFIER_LABEL[c.verifier]}
        </span>
      </td>
      <td><StateIndicator state={c.state} /></td>
      <td style={{ textAlign: "right" }}>
        {hasMarket ? (
          <div className="col gap-2" style={{ alignItems: "flex-end" }}>
            <div className="num" style={{ fontSize: 13 }}>
              <span style={{ color: "var(--win)" }}>{forP}%</span>
              <span className="dim"> / </span>
              <span style={{ color: "var(--loss)" }}>{agP}%</span>
            </div>
            <div className="bar split" style={{ width: 80 }}>
              <div className="for" style={{ width: `${forP}%` }} />
              <div className="against" style={{ width: `${agP}%` }} />
            </div>
          </div>
        ) : (
          <div className="num" style={{ fontSize: 13 }}>
            {c.participants ?? 0} <span className="dim">/ stakers</span>
          </div>
        )}
      </td>
      <td style={{ width: 110, textAlign: "right" }}>
        <div className="num" style={{ fontSize: 14 }}>{formatEth(tvl)}</div>
      </td>
    </tr>
  );
}
