"use client";

import { useAccount, useDisconnect } from "wagmi";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button onClick={() => disconnect()}>
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </button>
    );
  }

  return <button>Connect Wallet</button>;
}
