"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";

export default function ProfileIndexPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && isConnected && address) {
      router.replace(`/profile/${address}`);
    }
  }, [mounted, isConnected, address, router]);

  const go = () => {
    const val = search.trim();
    if (val.startsWith("0x") && val.length === 42) {
      router.push(`/profile/${val}`);
    }
  };

  return (
    <div className="container fade-in" style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 560 }}>
      <div className="col gap-6">
        <div className="col gap-2">
          <h1 className="serif" style={{ fontSize: 48, fontWeight: 400 }}>Profile</h1>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
            Connect your wallet to see your challenges, reputation, and leaderboard position.
            Or look up any address below.
          </p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Look up any address</div>
          <div className="row gap-2">
            <input
              className="input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="0x…"
              onKeyDown={e => e.key === "Enter" && go()}
              style={{ flex: 1 }}
            />
            <button
              className="btn primary sm"
              disabled={!search.trim().startsWith("0x") || search.trim().length !== 42}
              onClick={go}
            >
              View →
            </button>
          </div>
          <div className="dim mono" style={{ fontSize: 11, marginTop: 8 }}>Enter a full 0x… wallet address</div>
        </div>
      </div>
    </div>
  );
}
