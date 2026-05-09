"use client";

import { useState } from "react";
import { MOCK_CONNECTED_ENS } from "@/lib/data";

export function ConnectWallet() {
  const [connected, setConnected] = useState(true);

  if (!connected) {
    return (
      <button className="btn primary sm" onClick={() => setConnected(true)}>
        Connect wallet
      </button>
    );
  }

  return (
    <div className="row gap-3">
      <div className="wallet-pill" onClick={() => setConnected(false)} title="Click to disconnect">
        <span className="dot" />
        <span>{MOCK_CONNECTED_ENS}</span>
      </div>
    </div>
  );
}
