"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "./ConnectWallet";

const NAV = [
  { href: "/",          label: "Home",       exact: true },
  { href: "/dashboard", label: "Challenges", exact: false },
  { href: "/create",    label: "Create",     exact: false },
  { href: "/public",    label: "Governance", exact: false },
  { href: "/profile",   label: "Profile",    exact: false },
];

export function TopBar() {
  const path = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? path === href : path.startsWith(href);

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <div className="brand-mark" />
        <span>PACT</span>
        <span className="brand-tag">v0.1 · sepolia</span>
      </Link>

      <nav className="nav">
        {NAV.map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href === "/profile" ? "/profile/alex.eth" : href}
            className={"nav-item" + (isActive(href, exact) ? " active" : "")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="topbar-right">
        <div className="row gap-2 muted" style={{ fontSize: 12, fontFamily: "var(--f-mono)" }}>
          <span className="status-dot" /> 0.32 gwei
        </div>
        <ConnectWallet />
      </div>
    </div>
  );
}
