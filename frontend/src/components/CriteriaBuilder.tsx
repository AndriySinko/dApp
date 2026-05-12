"use client";

import { useState } from "react";
import type { VerifierType } from "@/lib/types";

// ── IPFS upload helper (inline JSON) ─────────────────────────────────────────

async function uploadJsonToIPFS(obj: object): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) throw new Error("NEXT_PUBLIC_PINATA_JWT not set");
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const form = new FormData();
  form.append("file", blob, "criteria.json");
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error("IPFS upload failed");
  const { IpfsHash } = await res.json();
  return IpfsHash as string;
}

// ── Config data ───────────────────────────────────────────────────────────────

const OPERATORS = [
  { value: "gte", label: "≥ at least" },
  { value: "lte", label: "≤ at most" },
  { value: "gt",  label: "> more than" },
  { value: "lt",  label: "< less than" },
  { value: "eq",  label: "= exactly" },
];

const API_SERVICES: { value: string; label: string; icon: string; metrics: { value: string; label: string; unit: string; hint: string }[]; accountHint: string }[] = [
  {
    value: "github", label: "GitHub", icon: "⬡", accountHint: "GitHub username (e.g. torvalds)",
    metrics: [
      { value: "commits",     label: "Commits made",      unit: "commits",      hint: "Total commits authored during challenge period" },
      { value: "push_events", label: "Push events",       unit: "pushes",       hint: "Push events (groups of commits)" },
      { value: "prs_merged",  label: "Pull requests merged", unit: "PRs",       hint: "Merged PRs authored during challenge" },
      { value: "issues_closed", label: "Issues closed",  unit: "issues",        hint: "Issues you closed during challenge" },
      { value: "stars",       label: "Stars received",    unit: "stars",        hint: "Total stars on all your repos" },
    ],
  },
  {
    value: "strava", label: "Strava", icon: "⚡", accountHint: "Strava access token (from bindAccount)",
    metrics: [
      { value: "distance", label: "Distance run (km)", unit: "km",    hint: "Total km running during challenge (1km = 1000m threshold)" },
      { value: "runs",     label: "Number of runs",    unit: "runs",  hint: "Count of running activities" },
      { value: "activities", label: "Any activities",  unit: "activities", hint: "Total workouts of any type" },
    ],
  },
  {
    value: "chess", label: "Chess.com", icon: "♟", accountHint: "Chess.com username",
    metrics: [
      { value: "rapid_rating",  label: "Rapid rating",  unit: "rating", hint: "Current rapid chess rating" },
      { value: "blitz_rating",  label: "Blitz rating",  unit: "rating", hint: "Current blitz chess rating" },
      { value: "bullet_rating", label: "Bullet rating", unit: "rating", hint: "Current bullet chess rating" },
      { value: "puzzle_rating", label: "Puzzle rating", unit: "rating", hint: "Current puzzle rating" },
    ],
  },
  {
    value: "lichess", label: "Lichess", icon: "♜", accountHint: "Lichess username",
    metrics: [
      { value: "rapid_rating",  label: "Rapid rating",       unit: "rating", hint: "Current Lichess rapid rating" },
      { value: "blitz_rating",  label: "Blitz rating",       unit: "rating", hint: "Current Lichess blitz rating" },
      { value: "games_played",  label: "Total games played", unit: "games",  hint: "All-time games played" },
      { value: "puzzle_rating", label: "Puzzle rating",      unit: "rating", hint: "Puzzle trainer rating" },
    ],
  },
  {
    value: "leetcode", label: "LeetCode", icon: "⌨", accountHint: "LeetCode username",
    metrics: [
      { value: "problems_solved", label: "Problems solved",  unit: "problems", hint: "Total problems solved (all time)" },
      { value: "hard_solved",     label: "Hard problems",    unit: "problems", hint: "Hard difficulty problems solved" },
      { value: "medium_solved",   label: "Medium problems",  unit: "problems", hint: "Medium difficulty problems solved" },
    ],
  },
  {
    value: "duolingo", label: "Duolingo", icon: "🦜", accountHint: "Duolingo username",
    metrics: [
      { value: "streak",   label: "Day streak",    unit: "days", hint: "Current consecutive day streak" },
      { value: "xp_total", label: "Total XP",      unit: "XP",   hint: "All-time total XP earned" },
      { value: "xp_month", label: "Monthly XP",    unit: "XP",   hint: "XP earned this month" },
    ],
  },
  {
    value: "codeforces", label: "Codeforces", icon: "∑", accountHint: "Codeforces handle",
    metrics: [
      { value: "rating",     label: "Rating",    unit: "rating", hint: "Current Codeforces rating" },
      { value: "max_rating", label: "Max rating", unit: "rating", hint: "All-time max rating achieved" },
    ],
  },
  {
    value: "coingecko", label: "Token price", icon: "₿", accountHint: "Not required",
    metrics: [
      { value: "price:bitcoin",  label: "Bitcoin price ($)",  unit: "$", hint: "BTC price in USD at deadline" },
      { value: "price:ethereum", label: "Ethereum price ($)", unit: "$", hint: "ETH price in USD at deadline" },
    ],
  },
];

const ONCHAIN_TYPES = [
  { value: "eth",     label: "ETH balance",        icon: "Ξ",  hint: "Check native ETH balance" },
  { value: "erc20",   label: "ERC-20 token",        icon: "◈",  hint: "Check any ERC-20 token balance" },
  { value: "nft",     label: "NFT (ERC-721)",       icon: "◆",  hint: "Check NFT ownership" },
  { value: "erc1155", label: "ERC-1155 token",      icon: "◇",  hint: "Check specific token ID balance" },
  { value: "call",    label: "Any contract call",   icon: "⬡",  hint: "Call any view function on any contract" },
  { value: "and",     label: "Multiple (AND)",      icon: "⊕",  hint: "All conditions must pass" },
  { value: "or",      label: "Either (OR)",         icon: "⊗",  hint: "Any condition must pass" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface CriteriaBuilderProps {
  verifier: VerifierType;
  value: string;
  onChange: (criteria: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function CriteriaBuilder({ verifier, value, onChange }: CriteriaBuilderProps) {
  if (verifier === "ON_CHAIN")   return <OnChainBuilder value={value} onChange={onChange} />;
  if (verifier === "API_ORACLE") return <ApiBuilder value={value} onChange={onChange} />;
  if (verifier === "AI_ORACLE")  return <AiBuilder value={value} onChange={onChange} />;
  return null;
}

// ── On-Chain Builder ─────────────────────────────────────────────────────────

function OnChainBuilder({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [ocType,    setOcType]    = useState("erc20");
  const [addr,      setAddr]      = useState("");
  const [tokenId,   setTokenId]   = useState("0");
  const [fnSig,     setFnSig]     = useState("balanceOf(address)");
  const [op,        setOp]        = useState("gte");
  const [threshold, setThreshold] = useState("");
  const [unit,      setUnit]      = useState("ETH");
  const [minNft,    setMinNft]    = useState("1");
  const [subA,      setSubA]      = useState("");
  const [subB,      setSubB]      = useState("");

  const toWei = (v: string) => unit === "ETH" ? String(Math.round(parseFloat(v || "0") * 1e18)) : v;

  const generate = () => {
    let c = "";
    if (ocType === "eth")     c = `eth::${op}:${toWei(threshold)}`;
    if (ocType === "erc20")   c = `erc20:${addr}:${toWei(threshold)}`;
    if (ocType === "nft")     c = `nft:${addr}:${minNft}`;
    if (ocType === "erc1155") c = `erc1155:${addr}:${tokenId}:${threshold}`;
    if (ocType === "call")    c = `call:${addr}:${fnSig}:${op}:${threshold}`;
    if (ocType === "and")     c = `and:${subA}|${subB}`;
    if (ocType === "or")      c = `or:${subA}|${subB}`;
    onChange(c);
  };

  return (
    <div className="col gap-4">
      <div className="field">
        <label>Condition type</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {ONCHAIN_TYPES.map(t => (
            <div key={t.value} className="card" style={{ padding: "12px 14px", cursor: "pointer", textAlign: "center", borderColor: ocType === t.value ? "var(--acc)" : undefined, background: ocType === t.value ? "var(--acc-bg)" : undefined }}
              onClick={() => setOcType(t.value)}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{t.label}</div>
              <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{t.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {(ocType === "erc20" || ocType === "nft" || ocType === "erc1155" || ocType === "call") && (
        <div className="field">
          <label>Contract address</label>
          <input className="input" value={addr} onChange={e => setAddr(e.target.value)} placeholder="0x..." />
        </div>
      )}

      {ocType === "erc1155" && (
        <div className="field">
          <label>Token ID</label>
          <input className="input" type="number" value={tokenId} onChange={e => setTokenId(e.target.value)} placeholder="0" />
        </div>
      )}

      {ocType === "call" && (
        <div className="field">
          <label>Function signature</label>
          <input className="input" value={fnSig} onChange={e => setFnSig(e.target.value)} placeholder="balanceOf(address)" />
          <span className="field-hint">e.g. balanceOf(address) · getScore(address) · stakedBalance(address)</span>
        </div>
      )}

      {ocType === "nft" && (
        <div className="field">
          <label>Minimum NFTs to hold</label>
          <input className="input" type="number" value={minNft} onChange={e => setMinNft(e.target.value)} min="1" />
        </div>
      )}

      {(ocType === "eth" || ocType === "erc20" || ocType === "call") && (
        <>
          <div className="row gap-3">
            <div className="field flex-1">
              <label>Operator</label>
              <select className="input" value={op} onChange={e => setOp(e.target.value)}>
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field flex-1">
              <label>Threshold</label>
              <input className="input" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="0.5" />
            </div>
            {(ocType === "eth" || ocType === "erc20") && (
              <div className="field" style={{ minWidth: 100 }}>
                <label>Unit</label>
                <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="ETH">ETH</option>
                  <option value="wei">wei (raw)</option>
                </select>
              </div>
            )}
          </div>
        </>
      )}

      {(ocType === "and" || ocType === "or") && (
        <div className="col gap-3">
          <div className="field">
            <label>Condition A</label>
            <input className="input" value={subA} onChange={e => setSubA(e.target.value)} placeholder="e.g. eth::gte:100000000000000000" />
          </div>
          <div className="field">
            <label>Condition B</label>
            <input className="input" value={subB} onChange={e => setSubB(e.target.value)} placeholder="e.g. call:0x...:balanceOf(address):gte:1000000000000000000" />
          </div>
          <span className="field-hint">Paste generated criteria strings from above into each field.</span>
        </div>
      )}

      <button className="btn primary sm" style={{ alignSelf: "flex-start" }} onClick={generate}>
        Generate criteria →
      </button>

      {value && (
        <div className="card" style={{ padding: 14, background: "var(--bg-1)" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Generated criteria</div>
          <code style={{ fontSize: 12, fontFamily: "var(--f-mono)", wordBreak: "break-all", color: "var(--acc)" }}>{value}</code>
        </div>
      )}
    </div>
  );
}

// ── API Oracle Builder ────────────────────────────────────────────────────────

function ApiBuilder({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [service,   setService]   = useState("github");
  const [metric,    setMetric]    = useState("commits");
  const [op,        setOp]        = useState("gte");
  const [threshold, setThreshold] = useState("30");
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");

  const svc     = API_SERVICES.find(s => s.value === service)!;
  const met     = svc.metrics.find(m => m.value === metric) || svc.metrics[0];
  const isPrice = service === "coingecko";

  const handleGenerate = async () => {
    setError("");
    setUploading(true);
    try {
      // For simple cases use legacy format (cheaper, no IPFS)
      // For coingecko use inline JSON
      if (!isPrice && !service.includes(",")) {
        // Legacy DSL — works for single service/metric
        const thresh = service === "strava" && metric === "distance"
          ? String(Math.round(parseFloat(threshold) * 1000)) // km to meters
          : threshold;
        const legacy = `${service}:${metric}:${op}:${thresh}:{startEpoch}:{endEpoch}`;
        onChange(legacy);
        setUploading(false);
        return;
      }

      // Upload JSON to IPFS for complex cases
      const criteria = {
        version: 2,
        sources: [{
          id: "value",
          type: "http",
          url: buildApiUrl(service, metric),
          headers: buildApiHeaders(service),
          auth: buildApiAuth(service),
          extract: buildExtractPath(service, metric),
        }],
        evaluate: { op, left: "value", right: parseFloat(threshold) },
      };
      const cid = await uploadJsonToIPFS(criteria);
      onChange(`ipfs:${cid}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setUploading(false);
  };

  return (
    <div className="col gap-4">
      <div className="field">
        <label>Service</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {API_SERVICES.map(s => (
            <div key={s.value} className="card" style={{ padding: "10px 12px", cursor: "pointer", textAlign: "center", borderColor: service === s.value ? "var(--acc)" : undefined, background: service === s.value ? "var(--acc-bg)" : undefined }}
              onClick={() => { setService(s.value); setMetric(s.metrics[0].value); }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>What to measure</label>
        <div className="col gap-2">
          {svc.metrics.map(m => (
            <div key={m.value} className="card" style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, borderColor: metric === m.value ? "var(--acc)" : undefined, background: metric === m.value ? "var(--acc-bg)" : undefined }}
              onClick={() => setMetric(m.value)}>
              <div className="col flex-1">
                <span style={{ fontWeight: 500, fontSize: 14 }}>{m.label}</span>
                <span className="muted" style={{ fontSize: 12 }}>{m.hint}</span>
              </div>
              <span className="mono dim" style={{ fontSize: 11 }}>{m.unit}</span>
              {metric === m.value && <span style={{ color: "var(--acc)" }}>●</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="row gap-3">
        <div className="field flex-1">
          <label>Condition</label>
          <select className="input" value={op} onChange={e => setOp(e.target.value)}>
            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field flex-1">
          <label>Target ({met.unit})</label>
          <input className="input" type="number" value={threshold} onChange={e => setThreshold(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 14, background: "var(--bg-1)" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Participant must</div>
        <p style={{ fontSize: 14, color: "var(--text-2)" }}>
          {OPERATORS.find(o => o.value === op)?.label.replace(/[≥≤<>=]/, "").trim()} {threshold} {met.unit} on {svc.label} during the challenge period.
        </p>
        {service !== "coingecko" && (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Each participant will be asked to enter their <strong>{svc.label} {accountFieldLabel(service)}</strong> when joining.
          </p>
        )}
      </div>

      {error && <div style={{ fontSize: 12, color: "var(--loss)" }}>{error}</div>}

      <button className="btn primary sm" style={{ alignSelf: "flex-start" }} disabled={uploading} onClick={handleGenerate}>
        {uploading ? <><span className="spinner-dot" />Generating…</> : "Generate criteria →"}
      </button>

      {value && (
        <div className="card" style={{ padding: 14, background: "var(--bg-1)" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Generated criteria</div>
          <code style={{ fontSize: 11, fontFamily: "var(--f-mono)", wordBreak: "break-all", color: "var(--acc)" }}>{value}</code>
        </div>
      )}
    </div>
  );
}

// ── AI Oracle Builder ─────────────────────────────────────────────────────────

function AiBuilder({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [description,  setDescription]  = useState("");
  const [requiredDays, setRequiredDays] = useState("30");
  const [graceDays,    setGraceDays]    = useState("2");
  const [strictNonce,  setStrictNonce]  = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [error,        setError]        = useState("");

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setError("");

    // Simple case: just description + days → store as plain string
    // Complex case (grace days, loose nonce) → upload to IPFS
    const isSimple = strictNonce && parseInt(graceDays) === 0;
    if (isSimple) {
      // Use plain criteria — aiVerifier.js uses it directly as Gemini prompt
      onChange(description.trim());
      return;
    }

    setUploading(true);
    try {
      const config: Record<string, unknown> = {
        criteria:     description.trim(),
        requiredDays: parseInt(requiredDays),
        graceDays:    parseInt(graceDays),
        strictNonce,
      };
      const cid = await uploadJsonToIPFS(config);
      onChange(`ipfs:${cid}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
  };

  return (
    <div className="col gap-4">
      <div className="field">
        <label>What must the participant show in their daily photo?</label>
        <textarea
          className="input"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. the person at a gym with workout equipment clearly visible"
          rows={3}
        />
        <span className="field-hint">Gemini Vision will check each photo against this description.</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label>Required days</label>
          <input className="input" type="number" value={requiredDays} onChange={e => setRequiredDays(e.target.value)} min="1" />
          <span className="field-hint">Min days with passing photos.</span>
        </div>
        <div className="field">
          <label>Grace days (allowed misses)</label>
          <input className="input" type="number" value={graceDays} onChange={e => setGraceDays(e.target.value)} min="0" />
          <span className="field-hint">0 = must submit every day.</span>
        </div>
      </div>

      <div className="card" style={{ padding: 14, cursor: "pointer", borderColor: strictNonce ? "var(--acc)" : undefined, background: strictNonce ? "var(--acc-bg)" : undefined }}
        onClick={() => setStrictNonce(!strictNonce)}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="col gap-1">
            <span style={{ fontWeight: 500, fontSize: 14 }}>Require daily nonce in photo</span>
            <span className="muted" style={{ fontSize: 12 }}>Participant must display a unique code each day — prevents reusing old photos</span>
          </div>
          <span style={{ fontSize: 20, color: "var(--acc)" }}>{strictNonce ? "●" : "○"}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 14, background: "var(--bg-1)" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>How it works</div>
        <div className="col gap-2" style={{ fontSize: 13, color: "var(--text-2)" }}>
          <div className="row gap-2"><span style={{ color: "var(--acc)" }}>1.</span><span>Each day the participant opens the challenge and gets a unique code</span></div>
          <div className="row gap-2"><span style={{ color: "var(--acc)" }}>2.</span><span>They take a photo showing: <em>{description || "your criteria"}</em>{strictNonce && " + the daily code visibly"}</span></div>
          <div className="row gap-2"><span style={{ color: "var(--acc)" }}>3.</span><span>Upload the photo — stored on IPFS</span></div>
          <div className="row gap-2"><span style={{ color: "var(--acc)" }}>4.</span><span>At deadline, Gemini Vision reviews all photos and delivers a verdict</span></div>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: "var(--loss)" }}>{error}</div>}

      <button className="btn primary sm" style={{ alignSelf: "flex-start" }} disabled={uploading || !description.trim()} onClick={handleGenerate}>
        {uploading ? <><span className="spinner-dot" />Uploading to IPFS…</> : "Generate criteria →"}
      </button>

      {value && (
        <div className="card" style={{ padding: 14, background: "var(--bg-1)" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Generated criteria</div>
          <code style={{ fontSize: 11, fontFamily: "var(--f-mono)", wordBreak: "break-all", color: "var(--acc)" }}>{value}</code>
        </div>
      )}
    </div>
  );
}

// ── Account field labels ──────────────────────────────────────────────────────

function accountFieldLabel(service: string): string {
  switch (service) {
    case "github":     return "username (e.g. torvalds)";
    case "strava":     return "access token";
    case "chess":      return "username (e.g. magnuscarlsen)";
    case "lichess":    return "username (e.g. DrNykterstein)";
    case "leetcode":   return "username";
    case "duolingo":   return "username";
    case "codeforces": return "handle (e.g. tourist)";
    default:           return "account ID";
  }
}

// ── URL/header builders for API services ─────────────────────────────────────

function buildApiUrl(service: string, metric: string): string {
  switch (service) {
    case "github":
      if (metric === "commits")
        return "https://api.github.com/search/commits?q=author:{accountId}+author-date:{startISO}..{endISO}&per_page=1";
      if (metric === "prs_merged")
        return "https://api.github.com/search/issues?q=is:pr+is:merged+author:{accountId}+merged:{startISO}..{endISO}&per_page=1";
      return "https://api.github.com/users/{accountId}/events?per_page=100";
    case "strava":
      return "https://www.strava.com/api/v3/athlete/activities?after={startEpoch}&before={endEpoch}&per_page=100";
    case "chess":
      return "https://api.chess.com/pub/player/{accountId}/stats";
    case "lichess":
      return "https://lichess.org/api/user/{accountId}";
    case "leetcode":
      return "https://leetcode-stats-api.herokuapp.com/{accountId}";
    case "duolingo":
      return "https://duolingo.com/2017-06-30/users?username={accountId}";
    case "codeforces":
      return "https://codeforces.com/api/user.info?handles={accountId}";
    default:
      return "";
  }
}

function buildApiHeaders(service: string): Record<string, string> {
  if (service === "github") return { "Accept": "application/vnd.github+json" };
  return {};
}

function buildApiAuth(service: string): string | undefined {
  if (service === "strava") return "bearer:{accountId}";
  return undefined;
}

function buildExtractPath(service: string, metric: string): string {
  switch (service) {
    case "github":
      return "data.total_count";
    case "strava":
      return metric === "distance" ? "data.*.distance|sum" : "data.*|count";
    case "chess":
      if (metric === "rapid_rating")  return "data.chess_rapid.last.rating";
      if (metric === "blitz_rating")  return "data.chess_blitz.last.rating";
      if (metric === "bullet_rating") return "data.chess_bullet.last.rating";
      return "data.tactics.highest.rating";
    case "lichess":
      if (metric === "rapid_rating")  return "data.perfs.rapid.rating";
      if (metric === "blitz_rating")  return "data.perfs.blitz.rating";
      if (metric === "games_played")  return "data.count.all";
      return "data.perfs.puzzle.rating";
    case "leetcode":
      if (metric === "hard_solved")   return "data.hardSolved";
      if (metric === "medium_solved") return "data.mediumSolved";
      return "data.totalSolved";
    case "duolingo":
      if (metric === "streak")    return "data.users.0.streak";
      if (metric === "xp_month")  return "data.users.0.monthlyXp";
      return "data.users.0.totalXp";
    case "codeforces":
      return metric === "max_rating" ? "data.result.0.maxRating" : "data.result.0.rating";
    default:
      return "data";
  }
}
