"use client";

import { useState, useCallback } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { parseEther } from "viem";
import { ADDRESSES, FACTORY_ABI, ERC20_ABI, LINK_UPKEEP_AMOUNT } from "@/lib/contracts";
import { CHALLENGE_TYPE_NUM, VERIFIER_TYPE_NUM, type ChallengeType, type VerifierType } from "@/lib/types";

export interface CreateChallengeParams {
  challengeType: ChallengeType;
  verifier: VerifierType;
  title: string;
  criteria: string;
  joinDeadline: bigint;     // unix timestamp
  challengeDeadline: bigint; // unix timestamp
  buyIn: string;             // ETH string, e.g. "0.10"
}

type Step = "idle" | "approving" | "approved" | "creating" | "success" | "error";

export function useCreateChallenge() {
  const { address: userAddress } = useAccount();
  const [step, setStep] = useState<Step>("idle");
  const [pendingParams, setPendingParams] = useState<CreateChallengeParams | null>(null);

  // Read current LINK allowance
  const { data: linkAllowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.linkToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: userAddress ? [userAddress, ADDRESSES.factory] : undefined,
    query: { enabled: !!userAddress && !!ADDRESSES.linkToken && !!ADDRESSES.factory },
  });

  // Step 1: Approve LINK
  const {
    writeContract: writeLinkApprove,
    data: approveTxHash,
    isPending: isApprovePending,
  } = useWriteContract();

  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash },
  });

  // Step 2: Create challenge
  const {
    writeContract: writeCreate,
    data: createTxHash,
    isPending: isCreatePending,
  } = useWriteContract();

  const { isSuccess: isCreateConfirmed } = useWaitForTransactionReceipt({
    hash: createTxHash,
    query: { enabled: !!createTxHash },
  });

  // Main action — handles both steps
  const deploy = useCallback(async (params: CreateChallengeParams) => {
    if (!ADDRESSES.factory || !ADDRESSES.linkToken) return;

    const buyInWei = parseEther(params.buyIn || "0");
    const needsApproval = !linkAllowance || (linkAllowance as bigint) < LINK_UPKEEP_AMOUNT;

    if (needsApproval) {
      setStep("approving");
      setPendingParams(params);
      writeLinkApprove({
        address: ADDRESSES.linkToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ADDRESSES.factory, LINK_UPKEEP_AMOUNT],
      });
    } else {
      _create(params, buyInWei);
    }
  }, [linkAllowance, writeLinkApprove]);

  const _create = useCallback((params: CreateChallengeParams, buyInWei: bigint) => {
    setStep("creating");
    writeCreate({
      address: ADDRESSES.factory,
      abi: FACTORY_ABI,
      functionName: "createChallenge",
      args: [
        CHALLENGE_TYPE_NUM[params.challengeType],
        VERIFIER_TYPE_NUM[params.verifier],
        params.title,
        params.criteria,
        params.joinDeadline,
        params.challengeDeadline,
        buyInWei,
      ],
      value: params.challengeType === "INDIVIDUAL" ? buyInWei : BigInt(0),
    });
  }, [writeCreate]);

  // When approve tx confirms, proceed to create
  if (isApproveConfirmed && step === "approving" && pendingParams) {
    const params = pendingParams;
    setPendingParams(null);
    setStep("approved");
    refetchAllowance().then(() => {
      _create(params, parseEther(params.buyIn || "0"));
    });
  }

  if (isCreateConfirmed && step === "creating") {
    setStep("success");
  }

  const hasLinkApproval = !!linkAllowance && (linkAllowance as bigint) >= LINK_UPKEEP_AMOUNT;

  return {
    deploy,
    step,
    hasLinkApproval,
    approveTxHash,
    createTxHash,
    isApprovePending,
    isCreatePending,
    isPending: isApprovePending || isCreatePending,
    isSuccess: isCreateConfirmed,
    reset: () => setStep("idle"),
  };
}
