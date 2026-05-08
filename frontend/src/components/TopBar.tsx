import Link from "next/link";

export function TopBar() {
  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <div className="brand-mark"></div>
        <span>PACT</span>
        <span className="brand-tag">v0.1 · sepolia</span>
      </Link>

      <nav className="nav">
        <Link href="/" className="nav-item">Home</Link>
        <Link href="/dashboard" className="nav-item">Challenges</Link>
        <Link href="/create" className="nav-item">Create</Link>
        <Link href="/public" className="nav-item">Governance</Link>
        <Link href="/profile/alex.eth" className="nav-item">Profile</Link>
      </nav>

      <div className="topbar-right">
        <div className="row gap-2 muted" style={{ fontSize: 12, fontFamily: "var(--f-mono)" }}>
          <span className="status-dot"></span> 0.32 gwei
        </div>
        <div className="wallet-pill">
          <span className="dot"></span>
          <span>alex.eth</span>
          <span style={{ color: "var(--text-4)" }}>·</span>
          <span style={{ color: "var(--text-3)" }}>0x7A4f...3eD2</span>
        </div>
      </div>
    </div>
  );
}
