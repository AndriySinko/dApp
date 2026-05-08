"use client";

import Link from "next/link";
import { ConnectWallet } from "./ConnectWallet";

export function TopBar() {
  return (
    <header>
      <Link href="/">PACT</Link>
      <nav>
        <Link href="/create">Create</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/public">Governance</Link>
      </nav>
      <ConnectWallet />
    </header>
  );
}
