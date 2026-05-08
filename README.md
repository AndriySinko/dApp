# PACT — Trustless Challenge Protocol

Stake ETH on personal goals. Get verified on-chain, by API, or by AI.

## Requirements

- Node.js 18+
- npm
- MetaMask browser extension

## Setup

**Clone and install:**

```bash
git clone https://github.com/AndriySinko/dApp.git
cd dApp
```

**Contracts:**

```bash
cd contracts
npm install
cp .env.example .env
# fill in .env with your keys
```

**Frontend:**

```bash
cd frontend
npm install
cp .env.local.example .env.local
# fill in .env.local with your keys
```

## Running locally

**Frontend:**

```bash
cd frontend
npm run dev
# opens at http://localhost:3000
```

**Contracts (compile):**

```bash
cd contracts
npx hardhat compile
```

**Contracts (local blockchain):**

```bash
cd contracts
npx hardhat node
```

## Environment variables

**`contracts/.env`**

| Variable | Where to get it |
|---|---|
| `SEPOLIA_RPC_URL` | [alchemy.com](https://alchemy.com) |
| `PRIVATE_KEY` | MetaMask → Account Details → Export private key |
| `ETHERSCAN_API_KEY` | [etherscan.io/apis](https://etherscan.io/apis) |
| `CHAINLINK_SUBSCRIPTION_ID` | [functions.chain.link](https://functions.chain.link) |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |

**`frontend/.env.local`**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_ALCHEMY_RPC` | Sepolia RPC URL from Alchemy |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Deployed ChallengeFactory address |
| `NEXT_PUBLIC_GOVERNANCE_ADDRESS` | Deployed PublicGovernance address |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | Deployed Treasury address |
| `NEXT_PUBLIC_REPUTATION_ADDRESS` | Deployed Reputation address |
| `NEXT_PUBLIC_ONCHAIN_VERIFIER` | Deployed OnChainVerifier address |
| `NEXT_PUBLIC_API_VERIFIER` | Deployed ApiOracleVerifier address |
| `NEXT_PUBLIC_AI_VERIFIER` | Deployed AiOracleVerifier address |
| `NEXT_PUBLIC_PINATA_JWT` | [pinata.cloud](https://pinata.cloud) API JWT |

## Project structure

```
contracts/         Solidity contracts (Hardhat)
├── contracts/
│   ├── challenges/    BaseChallenge, GroupChallenge, IndividualChallenge, PublicChallenge
│   ├── verifiers/     OnChainVerifier, ApiOracleVerifier, AiOracleVerifier
│   ├── core/          ChallengeFactory, PublicGovernance, Treasury, Reputation
│   └── interfaces/    IVerifier, IChallenge, IReputation, ITreasury

frontend/          Next.js 14 app (wagmi v2 + Tailwind)
└── src/
    ├── app/           Pages — /, /create, /challenge/[id], /dashboard, /profile/[address], /public
    ├── components/    UI components
    └── lib/           wagmi config, contract ABIs, IPFS upload
```
