"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return (
      <button className="btn primary sm" onClick={() => connect({ connector: injected() })}>
        Connect wallet
      </button>
    );
  }

  return (
    <div className="row gap-3">
      <div className="wallet-pill" onClick={() => disconnect()} title="Click to disconnect">
        <span className="dot" />
        <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
      </div>
    </div>
  );
}
