"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { INDIVIDUAL_CHALLENGE_ABI, GROUP_CHALLENGE_ABI } from "@/lib/contracts";
import type { ChallengeType } from "@/lib/types";

function abiFor(type: ChallengeType) {
  return type === "INDIVIDUAL" ? INDIVIDUAL_CHALLENGE_ABI : GROUP_CHALLENGE_ABI;
}

export function useCurrentDayNonce(
  challengeAddress: `0x${string}` | undefined,
  type: ChallengeType = "GROUP",
) {
  const { data, isLoading } = useReadContract({
    address: challengeAddress,
    abi: abiFor(type),
    functionName: "getCurrentDayNonce",
    query: { enabled: !!challengeAddress, refetchInterval: 60_000 },
  });
  return { nonce: data as `0x${string}` | undefined, isLoading };
}

export function useSubmitEvidence(
  challengeAddress: `0x${string}` | undefined,
  type: ChallengeType = "GROUP",
) {
  const abi = abiFor(type);
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const submitEvidence = (ipfsCid: string, nonce: `0x${string}`) => {
    if (!challengeAddress) return;
    writeContract({
      address: challengeAddress,
      abi,
      functionName: "submitEvidence",
      args: [ipfsCid, nonce],
    });
  };

  return { submitEvidence, txHash, isPending, isConfirming, isSuccess, error, reset };
}

export function useDaysComplete(
  challengeAddress: `0x${string}` | undefined,
  participantAddress: `0x${string}` | undefined,
  type: ChallengeType = "GROUP",
) {
  const { data, isLoading, refetch } = useReadContract({
    address: challengeAddress,
    abi: abiFor(type),
    functionName: "getDaysComplete",
    args: participantAddress ? [participantAddress] : undefined,
    query: { enabled: !!challengeAddress && !!participantAddress },
  });
  return { daysComplete: data as bigint | undefined, isLoading, refetch };
}
