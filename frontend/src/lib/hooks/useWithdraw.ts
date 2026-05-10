"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  INDIVIDUAL_CHALLENGE_ABI,
  GROUP_CHALLENGE_ABI,
  PUBLIC_CHALLENGE_ABI,
} from "@/lib/contracts";
import type { ChallengeType } from "@/lib/types";

function abiFor(type: ChallengeType) {
  if (type === "INDIVIDUAL") return INDIVIDUAL_CHALLENGE_ABI;
  if (type === "GROUP")      return GROUP_CHALLENGE_ABI;
  return PUBLIC_CHALLENGE_ABI;
}

export function useWithdraw(
  challengeAddress: `0x${string}` | undefined,
  type: ChallengeType = "INDIVIDUAL",
) {
  const abi = abiFor(type);
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const withdraw = () => {
    if (!challengeAddress) return;
    writeContract({ address: challengeAddress, abi, functionName: "withdraw", args: [] });
  };

  return { withdraw, txHash, isPending, isConfirming, isSuccess, error, reset };
}
