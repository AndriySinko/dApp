"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { GROUP_CHALLENGE_ABI, PUBLIC_CHALLENGE_ABI } from "@/lib/contracts";
import type { ChallengeType } from "@/lib/types";

export function useJoinGroup(
  challengeAddress: `0x${string}` | undefined,
  type: ChallengeType = "GROUP",
) {
  const abi = type === "PUBLIC" ? PUBLIC_CHALLENGE_ABI : GROUP_CHALLENGE_ABI;
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const join = (amountWei: bigint) => {
    if (!challengeAddress) return;
    writeContract({
      address: challengeAddress,
      abi,
      functionName: "join",
      args: [],
      value: amountWei,
    });
  };

  return { join, txHash, isPending, isConfirming, isSuccess, error, reset };
}
