"use client";

import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ADDRESSES, GOVERNANCE_ABI } from "@/lib/contracts";
import { VERIFIER_TYPE_FROM_NUM, type Proposal, type VerifierType } from "@/lib/types";

export function useGovernance(userAddress?: `0x${string}`) {
  const addr = ADDRESSES.governance;

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: addr, abi: GOVERNANCE_ABI, functionName: "getProposals"    } as const,
      { address: addr, abi: GOVERNANCE_ABI, functionName: "currentEpoch"    } as const,
      { address: addr, abi: GOVERNANCE_ABI, functionName: "currentEpochEnd" } as const,
      { address: addr, abi: GOVERNANCE_ABI, functionName: "prizePerEpoch"   } as const,
      ...(userAddress ? [
        { address: addr, abi: GOVERNANCE_ABI, functionName: "hasVotedThisEpoch", args: [userAddress] } as const,
        { address: addr, abi: GOVERNANCE_ABI, functionName: "getVoteWeight",     args: [userAddress] } as const,
      ] : []),
    ],
    query: { enabled: !!addr },
  });

  type RawProposal = {
    title: string; description: string; verifier: number;
    durationDays: bigint; joinDays: bigint; minStake: bigint;
    votes: bigint; voters: bigint;
  };

  const rawProposals = data?.[0]?.result as readonly RawProposal[] | undefined;
  const proposals: Proposal[] = rawProposals?.map((p, i) => ({
    index:       i,
    title:       p.title,
    description: p.description,
    verifier:    VERIFIER_TYPE_FROM_NUM[p.verifier] as VerifierType,
    durationDays: Number(p.durationDays),
    joinDays:    Number(p.joinDays),
    minStake:    Number(p.minStake) / 1e18,
    votes:       Number(p.votes),
    voters:      Number(p.voters),
  })) ?? [];

  const totalVotes = proposals.reduce((s, p) => s + p.votes, 0);
  const currentEpoch    = data?.[1]?.result as bigint | undefined;
  const epochEnd        = data?.[2]?.result as bigint | undefined;
  const prizePerEpoch   = data?.[3]?.result as bigint | undefined;
  const hasVoted        = userAddress ? data?.[4]?.result as boolean | undefined : undefined;
  const voteWeight      = userAddress ? data?.[5]?.result as bigint | undefined : undefined;

  return {
    proposals,
    totalVotes,
    currentEpoch:  currentEpoch  !== undefined ? Number(currentEpoch)  : undefined,
    epochEnd:      epochEnd      !== undefined ? new Date(Number(epochEnd) * 1000) : undefined,
    prizePerEpoch: prizePerEpoch !== undefined ? Number(prizePerEpoch) / 1e18 : undefined,
    hasVoted,
    voteWeight: voteWeight !== undefined ? Number(voteWeight) : undefined,
    isLoading,
    refetch,
  };
}

export function useVote() {
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const vote = (proposalIndex: number) => {
    if (!ADDRESSES.governance) return;
    writeContract({
      address: ADDRESSES.governance,
      abi: GOVERNANCE_ABI,
      functionName: "vote",
      args: [BigInt(proposalIndex)],
    });
  };

  return { vote, txHash, isPending, isConfirming, isSuccess, error, reset };
}

export function useTickEpoch() {
  const { writeContract, data: txHash, isPending, error } = useWriteContract();

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const tickEpoch = () => {
    if (!ADDRESSES.governance) return;
    writeContract({ address: ADDRESSES.governance, abi: GOVERNANCE_ABI, functionName: "tickEpoch", args: [] });
  };

  return { tickEpoch, txHash, isPending, isConfirming, isSuccess, error };
}
