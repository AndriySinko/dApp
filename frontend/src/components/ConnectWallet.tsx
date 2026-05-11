"use client";

import { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { WalletModal } from "./WalletModal";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !isConnected || !address) {
    return (
      <>
        <button className="btn primary sm" onClick={() => setShowModal(true)}>
          Connect wallet
        </button>
        {showModal && <WalletModal onClose={() => setShowModal(false)} />}
      </>
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
