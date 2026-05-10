"use client";

import { useState } from "react";

interface TxButtonProps {
  label: string;
  successLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  // If provided, real wagmi state is used instead of mock simulation
  onSubmit?: () => void;
  isPending?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  disabled?: boolean;
  onSuccess?: () => void;
}

export function TxButton({
  label,
  successLabel = "Done!",
  className = "btn primary",
  style,
  onSubmit,
  isPending,
  isSuccess,
  isError,
  disabled,
  onSuccess,
}: TxButtonProps) {
  const [mockState, setMockState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const isReal = onSubmit !== undefined && (isPending !== undefined || isSuccess !== undefined);

  const handleClick = () => {
    if (isReal) {
      onSubmit?.();
      return;
    }
    // Mock simulation for dev / unconnected state
    setMockState("loading");
    setTimeout(() => {
      setMockState("success");
      onSuccess?.();
      setTimeout(() => setMockState("idle"), 2500);
    }, 1500);
  };

  const effectivePending = isReal ? isPending  : mockState === "loading";
  const effectiveSuccess = isReal ? isSuccess  : mockState === "success";
  const effectiveError   = isReal ? isError    : mockState === "error";

  const isDisabled = disabled || effectivePending || effectiveSuccess;

  const display =
    effectivePending ? "⏳ Waiting for wallet…" :
    effectiveSuccess  ? `✓ ${successLabel}`       :
    effectiveError    ? "✗ Failed — retry"         :
    label;

  return (
    <button className={className} style={style} onClick={handleClick} disabled={isDisabled}>
      {display}
    </button>
  );
}
