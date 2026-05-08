// Contract addresses — fill in after deployment
export const ADDRESSES = {
  factory:     process.env.NEXT_PUBLIC_FACTORY_ADDRESS     as `0x${string}`,
  governance:  process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS  as `0x${string}`,
  treasury:    process.env.NEXT_PUBLIC_TREASURY_ADDRESS    as `0x${string}`,
  reputation:  process.env.NEXT_PUBLIC_REPUTATION_ADDRESS  as `0x${string}`,
  onChainVerifier: process.env.NEXT_PUBLIC_ONCHAIN_VERIFIER as `0x${string}`,
  apiVerifier:    process.env.NEXT_PUBLIC_API_VERIFIER     as `0x${string}`,
  aiVerifier:     process.env.NEXT_PUBLIC_AI_VERIFIER      as `0x${string}`,
};

// ABIs — paste generated ABI JSON here after `npx hardhat compile`
export const FACTORY_ABI = [] as const;
export const GROUP_CHALLENGE_ABI = [] as const;
export const INDIVIDUAL_CHALLENGE_ABI = [] as const;
export const PUBLIC_CHALLENGE_ABI = [] as const;
export const GOVERNANCE_ABI = [] as const;
export const REPUTATION_ABI = [] as const;
export const TREASURY_ABI = [] as const;
