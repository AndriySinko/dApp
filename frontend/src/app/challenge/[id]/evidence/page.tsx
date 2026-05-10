"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { ADDRESSES, FACTORY_ABI, INDIVIDUAL_CHALLENGE_ABI } from "@/lib/contracts";
import { CHALLENGE_TYPE_FROM_NUM, type ChallengeType } from "@/lib/types";
import { useCurrentDayNonce, useDaysComplete } from "@/lib/hooks/useEvidence";

type RawChallengeInfo = {
  id: bigint; challengeType: number; verifier: number; creator: `0x${string}`; title: string;
};

export default function EvidencePage() {
  const { id } = useParams<{ id: string }>();
  const { address: userAddress } = useAccount();
  const challengeAddress = id as `0x${string}`;

  const { data: infoRaw } = useReadContract({
    address: ADDRESSES.factory,
    abi: FACTORY_ABI,
    functionName: "getChallengeInfo",
    args: [challengeAddress],
    query: { enabled: !!challengeAddress },
  });
  const info = infoRaw as RawChallengeInfo | undefined;
  const challengeType: ChallengeType = info ? CHALLENGE_TYPE_FROM_NUM[info.challengeType] : "GROUP";
  const title = info?.title ?? "Loading…";

  const { data: joinDlRaw } = useReadContract({
    address: challengeAddress,
    abi: INDIVIDUAL_CHALLENGE_ABI,
    functionName: "joinDeadline",
    query: { enabled: !!challengeAddress },
  });
  const { data: challengeDlRaw } = useReadContract({
    address: challengeAddress,
    abi: INDIVIDUAL_CHALLENGE_ABI,
    functionName: "challengeDeadline",
    query: { enabled: !!challengeAddress },
  });
  const total = joinDlRaw && challengeDlRaw
    ? Math.max(1, Math.ceil((Number(challengeDlRaw) - Number(joinDlRaw)) / 86400))
    : 30;

  const { nonce } = useCurrentDayNonce(challengeAddress, challengeType);
  const { daysComplete: doneRaw } = useDaysComplete(challengeAddress, userAddress as `0x${string}` | undefined, challengeType);
  const done    = doneRaw ? Number(doneRaw) : 0;
  const today   = done + 1;
  const pctDone = Math.round((done / total) * 100);

  const nonceDisplay = nonce ?? "0x00000000";

  return (
    <div className="container fade-in" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 1100 }}>
      <div className="row gap-2 muted" style={{ fontSize: 12, marginBottom: 20, fontFamily: "var(--f-mono)" }}>
        <Link href={`/challenge/${challengeAddress}`} className="dim">← {`${challengeAddress.slice(0, 6)}…${challengeAddress.slice(-4)}`}</Link>
        <span className="dim">/</span>
        <span>evidence · day {today}</span>
      </div>

      <div className="page-head" style={{ paddingTop: 8 }}>
        <div>
          <div className="row gap-2" style={{ marginBottom: 14 }}>
            <span className="tag acc">◈ AI ORACLE</span>
            <span className="tag">{`${challengeAddress.slice(0, 6)}…${challengeAddress.slice(-4)}`}</span>
            <span className="status-dot warn" />
            <span className="muted" style={{ fontSize: 12 }}>Today&apos;s nonce expires at 00:00 UTC</span>
          </div>
          <h1 className="serif" style={{ fontSize: 44, fontWeight: 400 }}>{title}</h1>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
        <div className="col gap-4">
          <div className="card" style={{ padding: 28 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <div className="eyebrow">Day {today} · today&apos;s nonce</div>
              <span className="muted" style={{ fontSize: 12 }}>refreshes daily at 00:00 UTC</span>
            </div>
            <div style={{
              padding: "28px 32px", background: "var(--bg)",
              border: "1px solid var(--acc)", borderRadius: "var(--r-lg)",
              fontFamily: "var(--f-mono)", fontSize: 32, letterSpacing: "0.04em",
              color: "var(--acc)", textAlign: "center",
              boxShadow: "inset 0 0 32px rgba(212,255,61,0.06)",
            }}>
              {nonceDisplay.slice(0, 18)}…
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.55 }}>
              Write this code on paper or display it on a phone in today&apos;s photo.
              The Gemini Vision oracle will reject any photo where the nonce isn&apos;t clearly visible.
            </div>
          </div>

          <EvidenceUploader
            challengeId={`${challengeAddress.slice(0, 6)}…${challengeAddress.slice(-4)}`}
            nonce={nonceDisplay}
            challengeAddress={challengeAddress}
            challengeType={challengeType}
          />
        </div>

        <div className="col gap-4">
          <div className="card" style={{ padding: 24 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <div className="eyebrow">Streak · day {today} of {total}</div>
              <span className="num" style={{ color: "var(--acc)" }}>{pctDone}%</span>
            </div>
            <div className="bar" style={{ marginBottom: 20 }}>
              <div className="bar-fill" style={{ width: `${pctDone}%` }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {Array.from({ length: total }).map((_, i) => {
                const dayN     = i + 1;
                const verified = dayN <= done;
                const isToday  = dayN === today;
                return (
                  <div key={i} title={`Day ${dayN}`} style={{
                    aspectRatio: "1", borderRadius: 4,
                    background: verified ? "var(--acc)" : isToday ? "var(--bg-3)" : "var(--bg-2)",
                    border: isToday ? "1px solid var(--acc)" : "1px solid var(--line-soft)",
                    display: "grid", placeItems: "center",
                    fontFamily: "var(--f-mono)", fontSize: 9,
                    color: verified ? "#0b0b0c" : isToday ? "var(--acc)" : "var(--text-4)",
                    fontWeight: 500,
                  }}>
                    {dayN}
                  </div>
                );
              })}
            </div>
            <div className="row gap-4" style={{ marginTop: 16, fontSize: 11 }}>
              <span className="row gap-2"><span style={{ width: 8, height: 8, background: "var(--acc)", display: "inline-block" }} /> verified</span>
              <span className="row gap-2"><span style={{ width: 8, height: 8, background: "var(--bg-3)", border: "1px solid var(--acc)", display: "inline-block" }} /> today</span>
              <span className="row gap-2"><span style={{ width: 8, height: 8, background: "var(--bg-2)", border: "1px solid var(--line-soft)", display: "inline-block" }} /> pending</span>
            </div>
          </div>

          <div className="card" style={{ padding: 24, fontSize: 13 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Verdict pipeline</div>
            <div className="col gap-3">
              {[
                ["1.", "Photo uploaded to IPFS via Pinata",         done >= 1  ? "✓" : "—"],
                ["2.", "submitEvidence(cid) tx confirmed",          done >= 1  ? "✓" : "—"],
                ["3.", `Active period ends (${Math.max(0, total - done)} days left)`, "—"],
                ["4.", "Chainlink Functions fetches all photos",    "—"],
                ["5.", "Gemini Vision: criteria + nonce per photo", "—"],
                ["6.", "Verifier callback → receiveVerdict()",      "—"],
                ["7.", "Settlement: stake back + share of pool",    "—"],
              ].map(([n, l, s], i) => (
                <div key={i} className="row gap-3">
                  <span className="dim mono" style={{ width: 18 }}>{n}</span>
                  <span className="flex-1 muted">{l}</span>
                  <span style={{ color: s === "✓" ? "var(--win)" : "var(--text-4)" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="row gap-3">
              <span style={{ color: "var(--warn)" }}>⚠</span>
              <div className="col gap-2 flex-1">
                <div style={{ fontWeight: 500, fontSize: 13 }}>Adversarial images disclosed</div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  Generative models can fake photos. AI-verified challenges have a stake cap; treat the AI Oracle as a heuristic, not a proof.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
