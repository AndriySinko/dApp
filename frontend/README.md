# PACT — Frontend

Commitment protocol on Ethereum Sepolia. Users stake ETH on personal goals verified by on-chain data, Chainlink API oracle, or Gemini AI.

## Deployed Contracts (Sepolia)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| ChallengeFactory | `0x72a9E77C2B95b6BB096e66bA08e6A2B826d48191` | [view](https://sepolia.etherscan.io/address/0x72a9E77C2B95b6BB096e66bA08e6A2B826d48191) |
| PublicGovernance | `0x3217180ddbFc06B6f331dd986159f4E6ABE77c60` | [view](https://sepolia.etherscan.io/address/0x3217180ddbFc06B6f331dd986159f4E6ABE77c60) |
| Treasury | `0x42B6f9fd70D3d5721742eE448C0070ABcCAef2Dc` | [view](https://sepolia.etherscan.io/address/0x42B6f9fd70D3d5721742eE448C0070ABcCAef2Dc) |
| Reputation | `0x30A4dEA4Aa89c6005b7FBFbCBcc3329756C7D3cd` | [view](https://sepolia.etherscan.io/address/0x30A4dEA4Aa89c6005b7FBFbCBcc3329756C7D3cd) |
| OnChainVerifier | `0x545c735810Da55B73d80E0E1de9aEec066d2388c` | [view](https://sepolia.etherscan.io/address/0x545c735810Da55B73d80E0E1de9aEec066d2388c) |
| ApiOracleVerifier | `0xdEDd000D43F867baF6045C20a98dFf3b98CD1E80` | [view](https://sepolia.etherscan.io/address/0xdEDd000D43F867baF6045C20a98dFf3b98CD1E80) |
| AiOracleVerifier | `0x0f9C3898F81ab5B675D071A1916Ce6Ee0dc4BA69` | [view](https://sepolia.etherscan.io/address/0x0f9C3898F81ab5B675D071A1916Ce6Ee0dc4BA69) |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 14, TypeScript, wagmi v2
- Solidity 0.8.24, Hardhat
- Chainlink Automation + Functions
- Subsquid indexer
- IPFS via Pinata
