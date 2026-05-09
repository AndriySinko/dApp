"use client";

import { useState } from "react";

type TxState = "idle" | "loading" | "success" | "error";

interface TxButtonProps {
  label: string;
  successLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  onSuccess?: () => void;
}

export function TxButton({ label, successLabel = "Done!", className = "btn primary", style, onSuccess }: TxButtonProps) {
  const [state, setState] = useState<TxState>("idle");

  const handleClick = () => {
    setState("loading");
    setTimeout(() => {
      setState("success");
      onSuccess?.();
      setTimeout(() => setState("idle"), 2500);
    }, 1500);
  };

  const disabled = state === "loading" || state === "success";

  const display =
    state === "loading" ? "⏳ Waiting for wallet…" :
    state === "success"  ? `✓ ${successLabel}`      :
    state === "error"    ? "✗ Failed — retry"        :
    label;

  return (
    <button className={className} style={style} onClick={handleClick} disabled={disabled}>
      {display}
    </button>
  );
}
