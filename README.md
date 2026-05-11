# PACT — Trustless Challenge Protocol

> Stake ETH on personal goals. Let the world bet on whether you'll do it. Let the chain settle.

**Live dApp:** https://pact-dapp.vercel.app/  
**Network:** Ethereum Sepolia Testnet

---

## What is PACT?

PACT is a decentralized commitment protocol where users stake ETH on personal goals and let external verifiers decide the outcome. It combines prediction market mechanics with personal accountability.

Three challenge types:

- **Individual** — one person commits, the world bets FOR or AGAINST. Winners split the losing pool proportionally.
- **Group** — multiple participants commit to the same goal. Winners split the stakes of whoever failed.
- **Community** — governance-voted challenges funded by a treasury prize pool.

Three verification modes:

- **On-chain** — reads ETH/ERC-20/NFT balance or calls any view function on any contract. Fully trustless and synchronous.
- **API Oracle** — Chainlink Functions calls external APIs (GitHub, Strava, Chess.com, LeetCode, Duolingo, and more). Expression engine supports 500+ challenge scenarios.
- **AI Oracle** — photo evidence uploaded to IPFS daily with an anti-replay nonce. Gemini Vision classifies each photo and delivers a verdict.

---

## Architecture

```
contracts/
├── challenges/
│   ├── BaseChallenge.sol          State machine + Chainlink Automation
│   ├── IndividualChallenge.sol    FOR/AGAINST betting market
│   ├── GroupChallenge.sol         Stake-split settlement
│   └── PublicChallenge.sol        Treasury-funded public challenges
├── verifiers/
│   ├── OnChainVerifier.sol        Generic staticcall parser — any contract, any view function
│   ├── ApiOracleVerifier.sol      Chainlink Functions + expression engine (500+ scenarios)
│   └── AiOracleVerifier.sol       Chainlink Functions + Gemini Vision
├── core/
│   ├── ChallengeFactory.sol       Deploys challenges, registers Chainlink upkeeps
│   ├── PublicGovernance.sol       Proposal voting + automatic epoch tick via Automation
│   ├── Treasury.sol               Protocol fee collector and prize pool
│   └── Reputation.sol             On-chain reputation score used as governance vote weight
├── functions/
│   ├── apiVerifier.js             Expression engine — supports IPFS criteria, JSON, legacy DSL
│   └── aiVerifier.js              Gemini Vision verifier with flexible JSON prompt config
└── interfaces/

frontend/                          Next.js 14 app (wagmi v3 + viem)
├── src/app/                       Pages: /, /create, /dashboard, /challenge/[id], /profile, /public
├── src/components/
│   ├── CriteriaBuilder.tsx        Visual criteria builder — no technical knowledge needed
│   ├── ActionCards.tsx            Withdraw, BindAccount, SettleFallback, TickEpochBanner
│   └── ...
└── src/lib/                       wagmi config, contract ABIs, Subsquid hooks, IPFS upload

squid/                             Subsquid indexer — on-chain events → GraphQL API
```

**Data flow:**  
User → Frontend (wagmi) → Sepolia contracts → Chainlink Automation (state transitions) → Chainlink Functions (oracle verdicts) → settlement. Subsquid indexes all events and serves them as GraphQL to the frontend.

---

## Deployed Contracts (Ethereum Sepolia)

| Contract | Address | Etherscan |
|---|---|---|
| ChallengeFactory | `0xEe4BD2DF1A4bEeE95B2f2a4294aC5505D2c4E63A` | [↗](https://sepolia.etherscan.io/address/0xEe4BD2DF1A4bEeE95B2f2a4294aC5505D2c4E63A#code) |
| PublicGovernance | `0x357b38fb575Efb7C87B5ae3624ae1BA364612C1b` | [↗](https://sepolia.etherscan.io/address/0x357b38fb575Efb7C87B5ae3624ae1BA364612C1b#code) |
| Treasury | `0x7Bed6b0c62E9C377d94D5bE96f478ea5Aa879CA5` | [↗](https://sepolia.etherscan.io/address/0x7Bed6b0c62E9C377d94D5bE96f478ea5Aa879CA5#code) |
| Reputation | `0x91Eb85782fe19056f4EC8837e2B66fb5650CB782` | [↗](https://sepolia.etherscan.io/address/0x91Eb85782fe19056f4EC8837e2B66fb5650CB782#code) |
| OnChainVerifier | `0x2e914A5ac4fCddA017e2010aBe361837Bd4D1A10` | [↗](https://sepolia.etherscan.io/address/0x2e914A5ac4fCddA017e2010aBe361837Bd4D1A10#code) |
| ApiOracleVerifier | `0x2300EC5dEAf26161FC5443C289E7623eC6B8F7D2` | [↗](https://sepolia.etherscan.io/address/0x2300EC5dEAf26161FC5443C289E7623eC6B8F7D2#code) |
| AiOracleVerifier | `0xCFd57B1c577cCf2023575000ea7E5F8aF6Cd5D79` | [↗](https://sepolia.etherscan.io/address/0xCFd57B1c577cCf2023575000ea7E5F8aF6Cd5D79#code) |
| IndividualChallengeDeployer | `0xDBd6BEc16451BB680e0ef6E920E8B054B71bB10e` | [↗](https://sepolia.etherscan.io/address/0xDBd6BEc16451BB680e0ef6E920E8B054B71bB10e#code) |
| GroupChallengeDeployer | `0x0cb81bB988e079366FA34C96f02f29749F2dE7A3` | [↗](https://sepolia.etherscan.io/address/0x0cb81bB988e079366FA34C96f02f29749F2dE7A3#code) |
| PublicChallengeDeployer | `0x7776366a53e4f808D310A116F40438c890e99143` | [↗](https://sepolia.etherscan.io/address/0x7776366a53e4f808D310A116F40438c890e99143#code) |

All contracts verified on Sepolia Etherscan.

---

## Setup

### Requirements

- Node.js v20+
- npm

### Clone

```bash
git clone https://github.com/AndriySinko/dApp.git
cd dApp
```

### Contracts

```bash
cd contracts
npm install
cp .env.example .env
# fill in .env
npx hardhat compile
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# fill in .env.local
npm run dev
# opens at http://localhost:3000
```

### Squid indexer (optional — needed for challenge list, leaderboard, activity feed)

```bash
npm install -g @subsquid/cli
cd squid
npm install
sqd auth -k <your-subsquid-api-key>
sqd secrets set SEPOLIA_RPC_URL <your-alchemy-url>
sqd deploy .
```

---

## Environment Variables

### `contracts/.env`

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_deployer_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
CHAINLINK_SUBSCRIPTION_ID=your_chainlink_functions_subscription_id
GEMINI_API_KEY=your_gemini_api_key
AI_ORACLE_VERIFIER=0xCFd57B1c577cCf2023575000ea7E5F8aF6Cd5D79
API_VERIFIER=0x2300EC5dEAf26161FC5443C289E7623eC6B8F7D2
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_ALCHEMY_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_FACTORY_ADDRESS=0xEe4BD2DF1A4bEeE95B2f2a4294aC5505D2c4E63A
NEXT_PUBLIC_GOVERNANCE_ADDRESS=0x357b38fb575Efb7C87B5ae3624ae1BA364612C1b
NEXT_PUBLIC_TREASURY_ADDRESS=0x7Bed6b0c62E9C377d94D5bE96f478ea5Aa879CA5
NEXT_PUBLIC_REPUTATION_ADDRESS=0x91Eb85782fe19056f4EC8837e2B66fb5650CB782
NEXT_PUBLIC_ONCHAIN_VERIFIER=0x2e914A5ac4fCddA017e2010aBe361837Bd4D1A10
NEXT_PUBLIC_API_VERIFIER=0x2300EC5dEAf26161FC5443C289E7623eC6B8F7D2
NEXT_PUBLIC_AI_VERIFIER=0xCFd57B1c577cCf2023575000ea7E5F8aF6Cd5D79
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
NEXT_PUBLIC_SQUID_URL=https://656385f6-777f-4b75-ab45-d97a4dcf588a.squids.live/pact-squid@v1/api/graphql
NEXT_PUBLIC_CHAIN_ID=11155111
```

---

## Running Tests

```bash
cd contracts
npx hardhat test
npm run coverage
```

Current coverage: **91% statements**, **76% branches**, **88% functions**, **94% lines**. 235 tests passing.

---

## Challenge Scenarios

PACT supports 500+ distinct challenge scenarios across three verifier types:

**On-chain (~85 scenarios)** — hold ETH, ERC-20 tokens, NFTs, DeFi positions, or call any view function on any deployed contract. Supports compound AND/OR conditions.

**API Oracle (~255 scenarios)** — GitHub, Strava, Chess.com, Lichess, LeetCode, Duolingo, Codeforces, WakaTime, Codewars, StackOverflow, YouTube, Reddit, Last.fm, Goodreads, and more. Expression engine supports IPFS-stored JSON criteria for unlimited combinations.

**AI Oracle (~160 scenarios)** — any goal demonstrable in a daily photo. Gemini Vision evaluates each submission. Supports custom prompts, grace days, and time windows via IPFS criteria config.

---

## Known Limitations

- **Win/loss stats on profile** — leaderboard shows reputation scores but individual win/loss counts require additional Subsquid aggregation not yet implemented.
- **Gemini API rate limit** — free tier is 1,500 requests/day. Sufficient for testnet; paid plan needed at scale.
- **Chainlink Functions HTTP limit** — max 5 API calls per verification execution. Compound challenges are limited to 5 data sources.
- **Subsquid archive API key** — v2 archive requires API keys after May 19, 2026. Register at portal.sqd.dev.
- **No mainnet deployment** — Sepolia testnet only.

---

## What We Learned

- Integrating Chainlink Automation, Functions, and DON-hosted secrets in a single protocol requires careful coordination across three separate dashboards and subscription types.
- Designing the state machine to be driven by Chainlink Automation rather than manual calls made the protocol feel genuinely trustless.
- The checks-effects-interactions pattern had to be carefully applied across multiple settlement paths. Three independent security tools (Slither, Wake, Pashov x-ray) found and helped fix real vulnerabilities.
- Subsquid as a data layer dramatically simplified frontend data fetching compared to reading everything directly from contracts.
- The IPFS + expression engine architecture makes the verification layer effectively unlimited without redeploying contracts — new challenge types are just new JSON criteria files.

---

## Conclusion

PACT combines prediction markets with personal accountability in a way that requires no trusted intermediary. The three-verifier architecture (trustless on-chain, API-based, AI-based) covers a wide range of real-world goals. The expression engine and generic call parser make the protocol extensible to hundreds of new scenarios without contract redeployment.

---

## Use of AI Tools
