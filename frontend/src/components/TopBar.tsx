"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectWallet } from "./ConnectWallet";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  const path = usePathname();
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isActive = (href: string, exact: boolean) =>
    exact ? path === href : path.startsWith(href);

  const profileHref = mounted && address ? `/profile/${address}` : "/profile";

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <div className="brand-mark" />
        <span>PACT</span>
      </Link>

      <nav className="nav">
        {[
          { href: "/",          label: "Home",       exact: true  },
          { href: "/dashboard", label: "Challenges", exact: false },
          { href: "/create",    label: "Create",     exact: false },
          { href: "/public",    label: "Governance", exact: false },
          { href: "/profile",   label: "Profile",    exact: false },
        ].map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href === "/profile" ? profileHref : href}
            className={"nav-item" + (isActive(href, exact) ? " active" : "")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="topbar-right">
        <div className="row gap-2" style={{ fontSize: 11, fontFamily: "var(--f-mono)", padding: "4px 10px", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", color: "var(--text-3)" }}>
          <span className="status-dot" />
          Sepolia
        </div>
        <ThemeToggle />
        <ConnectWallet />
      </div>
    </div>
  );
}
