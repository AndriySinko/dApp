"use client";

import { useReadContract } from "wagmi";
import { ADDRESSES, REPUTATION_ABI } from "@/lib/contracts";

export function useReputation(userAddress: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: ADDRESSES.reputation,
    abi: REPUTATION_ABI,
    functionName: "getScore",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress && !!ADDRESSES.reputation },
  });

  const score = data as bigint | undefined;
  const scoreNum = score !== undefined ? Number(score) : undefined;

  return { score, scoreNum, isLoading, refetch };
}
