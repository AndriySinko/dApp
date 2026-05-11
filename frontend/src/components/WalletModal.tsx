"use client";

import { useConnect } from "wagmi";
import { useEffect } from "react";
import { createPortal } from "react-dom";

const WALLET_ICONS: Record<string, string> = {
  MetaMask:       "🦊",
  "Coinbase Wallet": "🔵",
  "Injected":     "🌐",
  Safe:           "🛡",
};

interface WalletModalProps {
  onClose: () => void;
}

export function WalletModal({ onClose }: WalletModalProps) {
  const { connect, connectors, isPending } = useConnect();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const unique = connectors.filter((c, i, arr) =>
    arr.findIndex(x => x.name === c.name) === i
  );

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 360, padding: 28, position: "relative" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
          <div className="h-2">Connect wallet</div>
          <button className="btn sm" onClick={onClose} style={{ fontSize: 18, padding: "4px 10px" }}>✕</button>
        </div>
        <div className="col gap-2">
          {unique.map(c => (
            <button
              key={c.id}
              className="card"
              style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left", width: "100%", opacity: isPending ? 0.6 : 1 }}
              disabled={isPending}
              onClick={() => { connect({ connector: c }); onClose(); }}
            >
              <span style={{ fontSize: 24, width: 32, textAlign: "center" }}>
                {WALLET_ICONS[c.name] ?? "👛"}
              </span>
              <div className="col gap-1">
                <span style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {c.name === "MetaMask" ? "Browser extension" :
                   c.name === "Coinbase Wallet" ? "Browser extension or mobile" :
                   c.name === "Safe" ? "Multi-sig smart wallet" :
                   "Browser extension"}
                </span>
              </div>
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
          By connecting you agree to the terms of use.
          Only Sepolia testnet is supported.
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
