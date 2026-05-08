"use client";

export function Sparkline({ points = [3, 5, 4, 7, 6, 9, 8, 11, 10, 13, 12, 15], color = "var(--acc)" }: { points?: number[]; color?: string }) {
  const max = Math.max(...points), min = Math.min(...points);
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 100 - ((p - min) / (max - min || 1)) * 100;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const fill = path + " L 100 100 L 0 100 Z";
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      <path d={fill} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Donut({ pct, color = "var(--acc)", size = 80, stroke = 8 }: { pct: number; color?: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${c * pct / 100} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}
