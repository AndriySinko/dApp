"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { INDIVIDUAL_CHALLENGE_ABI } from "@/lib/contracts";

export function usePlaceBet(challengeAddress: `0x${string}` | undefined) {
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const placeBet = (side: boolean, amountWei: bigint) => {
    if (!challengeAddress) return;
    writeContract({
      address: challengeAddress,
      abi: INDIVIDUAL_CHALLENGE_ABI,
      functionName: "placeBet",
      args: [side],
      value: amountWei,
    });
  };

  return { placeBet, txHash, isPending, isConfirming, isSuccess, error, reset };
}
