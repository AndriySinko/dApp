"use client";

import { useReadContracts } from "wagmi";
import {
  INDIVIDUAL_CHALLENGE_ABI,
  GROUP_CHALLENGE_ABI,
  PUBLIC_CHALLENGE_ABI,
} from "@/lib/contracts";
import {
  CHALLENGE_STATE_FROM_NUM,
  CHALLENGE_TYPE_FROM_NUM,
  type ChallengeState,
  type ChallengeType,
} from "@/lib/types";

type ChallengeAbi =
  | typeof INDIVIDUAL_CHALLENGE_ABI
  | typeof GROUP_CHALLENGE_ABI
  | typeof PUBLIC_CHALLENGE_ABI;

function abiForType(type: ChallengeType): ChallengeAbi {
  if (type === "INDIVIDUAL") return INDIVIDUAL_CHALLENGE_ABI;
  if (type === "GROUP")      return GROUP_CHALLENGE_ABI;
  return PUBLIC_CHALLENGE_ABI;
}

export function useChallenge(
  address: `0x${string}` | undefined,
  type: ChallengeType = "INDIVIDUAL",
  userAddress?: `0x${string}`,
) {
  const abi = abiForType(type);

  const baseCalls = address ? [
    { address, abi, functionName: "state"             } as const,
    { address, abi, functionName: "creator"           } as const,
    { address, abi, functionName: "joinDeadline"      } as const,
    { address, abi, functionName: "challengeDeadline" } as const,
    { address, abi, functionName: "buyIn"             } as const,
    { address, abi, functionName: "participants"      } as const,
  ] : [];

  const individualCalls = address && type === "INDIVIDUAL" ? [
    { address, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "forPool"        } as const,
    { address, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "againstPool"    } as const,
    { address, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "bettorsFor"     } as const,
    { address, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "bettorsAgainst" } as const,
  ] : [];

  const userCalls = address && userAddress ? [
    { address, abi, functionName: "isRegistered",       args: [userAddress] } as const,
    { address, abi, functionName: "stakes",             args: [userAddress] } as const,
    { address, abi, functionName: "verdictReceived",    args: [userAddress] } as const,
  ] : [];

  const userIndividualCalls = address && userAddress && type === "INDIVIDUAL" ? [
    { address, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "getBet",              args: [userAddress] } as const,
    { address, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "pendingWithdrawals",  args: [userAddress] } as const,
  ] : [];

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [...baseCalls, ...individualCalls, ...userCalls, ...userIndividualCalls],
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  if (!data || !address) {
    return { isLoading, refetch };
  }

  const [stateRaw, creator, joinDl, challengeDl, buyIn, participants] = data;
  const state: ChallengeState | undefined =
    stateRaw?.result !== undefined
      ? CHALLENGE_STATE_FROM_NUM[stateRaw.result as number]
      : undefined;

  const base = {
    state,
    creator:           creator?.result          as `0x${string}` | undefined,
    joinDeadline:      joinDl?.result           as bigint | undefined,
    challengeDeadline: challengeDl?.result      as bigint | undefined,
    buyIn:             buyIn?.result            as bigint | undefined,
    participantCount:  (participants?.result as readonly `0x${string}`[] | undefined)?.length,
    participants:      participants?.result      as readonly `0x${string}`[] | undefined,
  };

  if (type !== "INDIVIDUAL") {
    const isRegistered   = userCalls.length > 0 ? data[6]?.result  as boolean | undefined : undefined;
    const userStake      = userCalls.length > 0 ? data[7]?.result  as bigint  | undefined : undefined;
    const verdictDone    = userCalls.length > 0 ? data[8]?.result  as boolean | undefined : undefined;
    return { ...base, isRegistered, userStake, verdictDone, isLoading, refetch };
  }

  const [forPoolRaw, againstPoolRaw, bettorsForRaw, bettorsAgainstRaw] = data.slice(6);
  const baseOffset = 6 + individualCalls.length;
  const isRegistered  = userCalls.length > 0 ? data[baseOffset]?.result    as boolean | undefined : undefined;
  const userStake     = userCalls.length > 0 ? data[baseOffset+1]?.result  as bigint  | undefined : undefined;
  const verdictDone   = userCalls.length > 0 ? data[baseOffset+2]?.result  as boolean | undefined : undefined;
  const userBetOffset = baseOffset + userCalls.length;
  const betRaw        = userIndividualCalls.length > 0 ? data[userBetOffset]?.result   as readonly [bigint, boolean] | undefined : undefined;
  const pending       = userIndividualCalls.length > 0 ? data[userBetOffset+1]?.result as bigint | undefined : undefined;

  return {
    ...base,
    forPool:        forPoolRaw?.result        as bigint | undefined,
    againstPool:    againstPoolRaw?.result    as bigint | undefined,
    bettorsFor:     bettorsForRaw?.result     as bigint | undefined,
    bettorsAgainst: bettorsAgainstRaw?.result as bigint | undefined,
    isRegistered,
    userStake,
    verdictDone,
    userBet:    betRaw ? { amount: betRaw[0], side: betRaw[1] } : undefined,
    userPending: pending,
    isLoading,
    refetch,
  };
}

export function useChallengeInfo(challengeAddress: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContracts({
    contracts: challengeAddress ? [
      { address: challengeAddress, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "state"    } as const,
      { address: challengeAddress, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "creator"  } as const,
      { address: challengeAddress, abi: INDIVIDUAL_CHALLENGE_ABI, functionName: "buyIn"    } as const,
    ] : [],
    query: { enabled: !!challengeAddress },
  });

  return {
    state: data?.[0]?.result !== undefined
      ? CHALLENGE_STATE_FROM_NUM[data[0].result as number]
      : undefined,
    creator: data?.[1]?.result as `0x${string}` | undefined,
    buyIn:   data?.[2]?.result as bigint | undefined,
    type:    CHALLENGE_TYPE_FROM_NUM[0] as ChallengeType, // default; use factory to get type
    isLoading,
  };
}
