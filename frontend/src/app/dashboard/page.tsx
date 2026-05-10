"use client";

import { useState } from "react";
import Link from "next/link";
import { useSquidChallenges } from "@/lib/hooks/useSquidChallenges";
import { ChallengeCard } from "@/components/ChallengeCard";
import type { ChallengeState, ChallengeType } from "@/lib/types";

type StateFilter = "All" | "Live" | "Settled";
type TypeFilter  = "Any type" | ChallengeType;

const LIVE_STATES: ChallengeState[] = ["JOIN_OPEN", "ACTIVE", "VERIFY_PENDING"];

export default function DashboardPage() {
  const [stateFilter, setStateFilter] = useState<StateFilter>("All");
  const [typeFilter,  setTypeFilter]  = useState<TypeFilter>("Any type");

  const { challenges, isLoading } = useSquidChallenges();

  const filtered = challenges.filter(c => {
    if (stateFilter === "Live"    && !LIVE_STATES.includes(c.state)) return false;
    if (stateFilter === "Settled" && c.state !== "SETTLED")          return false;
    if (typeFilter  !== "Any type" && c.type !== typeFilter)          return false;
    return true;
  });

  return (
    <div className="container fade-in" style={{ paddingTop: 56, paddingBottom: 80 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{`{ all challenges }`}</div>
          <h1 className="h-1 serif" style={{ fontSize: 56, fontWeight: 400 }}>Markets &amp; commitments</h1>
        </div>
        <div className="row gap-3">
          <Link href="/create" className="btn primary">+ New challenge</Link>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <div className="row gap-4">
          <div className="segmented">
            {(["All", "Live", "Settled"] as StateFilter[]).map(f => (
              <button key={f} className={stateFilter === f ? "active" : ""} onClick={() => setStateFilter(f)}>{f}</button>
            ))}
          </div>
          <div className="segmented">
            {(["Any type", "INDIVIDUAL", "GROUP", "PUBLIC"] as TypeFilter[]).map(f => (
              <button key={f} className={typeFilter === f ? "active" : ""} onClick={() => setTypeFilter(f)}>
                {f === "Any type" ? "Any type" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="row gap-3 muted" style={{ fontSize: 12, fontFamily: "var(--f-mono)" }}>
          {filtered.length} results · sorted by activity
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>id</th>
              <th>title</th>
              <th>type</th>
              <th>verifier</th>
              <th>state</th>
              <th style={{ textAlign: "right" }}>pool split / size</th>
              <th style={{ textAlign: "right" }}>tvl</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-4)" }}>
                  Loading challenges…
                </td>
              </tr>
            )}
            {!isLoading && filtered.map(c => <ChallengeCard key={c.id} c={c} />)}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-4)" }}>
                  No challenges match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
