# PACT — Trustless Challenge Protocol

> Stake ETH on personal goals. Let the world bet on whether you'll do it. Let the chain settle.

**Live dApp:** https://pact-dapp.vercel.app/  
**Network:** Ethereum Sepolia Testnet

---

## What is PACT?

PACT is a decentralized commitment protocol where users stake ETH on personal goals and let external verifiers decide the outcome. It combines prediction market mechanics with personal accountability — removing the need for any trusted referee.

**The core loop:**
1. A challenger stakes ETH on a goal ("30 GitHub commits in 30 days")
2. External bettors wager FOR or AGAINST success while the join window is open
3. Chainlink Automation transitions the challenge through its state machine automatically
4. An on-chain, API, or AI oracle delivers a per-participant verdict
5. Winners are paid proportionally from the losers' pool; a 2% fee goes to the protocol treasury

**Three challenge types:**

- **Individual** — one person commits, the world bets FOR or AGAINST. AGAINST pool is capped at 5× the buy-in; AGAINST payouts are capped at 2× stake. Overflow goes to treasury.
- **Group** — multiple participants commit to the same goal. Winners split the stakes of whoever failed, proportional to their buy-in.
- **Community** — governance-elected challenges funded by a treasury prize pool. Admin proposes, community votes by reputation weight, and the winning proposal deploys a public challenge.

**Three verification modes:**

- **On-chain** — reads ETH/ERC-20/NFT balance or calls any view function on any contract. Fully trustless and synchronous; no Chainlink nodes involved.
- **API Oracle** — Chainlink Functions calls external APIs (GitHub, Strava, Chess.com, LeetCode, Duolingo, and more). An expression engine supports 500+ challenge scenarios via IPFS-stored JSON criteria.
- **AI Oracle** — photo evidence uploaded to IPFS daily with an anti-replay nonce. Gemini Vision classifies each photo and delivers a verdict via Chainlink Functions.

---

## Architecture

```
contracts/
├── challenges/
│   ├── BaseChallenge.sol          State machine + Chainlink Automation (checkUpkeep/performUpkeep)
│   ├── IndividualChallenge.sol    FOR/AGAINST betting market with capped AGAINST pool
│   ├── GroupChallenge.sol         Multi-participant stake-split settlement
│   └── PublicChallenge.sol        Treasury-augmented group challenge
├── verifiers/
│   ├── OnChainVerifier.sol        Generic staticcall parser — any contract, any view function
│   ├── ApiOracleVerifier.sol      Chainlink Functions + expression engine (500+ scenarios)
│   └── AiOracleVerifier.sol       Chainlink Functions + Gemini Vision
├── core/
│   ├── ChallengeFactory.sol       Deploys challenge contracts, registers Chainlink Automation upkeeps
│   ├── PublicGovernance.sol       Epoch-based proposal voting, automatic epoch tick via Automation
│   ├── Treasury.sol               Protocol fee collector and public challenge prize pool
│   └── Reputation.sol             On-chain reputation score, used as governance vote weight
├── functions/
│   ├── apiVerifier.js             Expression engine — IPFS criteria, JSON path, legacy DSL
│   └── aiVerifier.js              Gemini Vision verifier with flexible JSON prompt config
└── interfaces/

frontend/                          Next.js 14 (App Router) + wagmi v3 + viem + Tailwind CSS
├── src/app/                       Pages: / (landing), /create, /dashboard, /challenge/[id], /profile, /public
├── src/components/
│   ├── CriteriaBuilder.tsx        Visual criteria builder — no technical knowledge needed
│   ├── ActionCards.tsx            Withdraw, BindAccount, SettleFallback, TickEpochBanner
│   └── ...
└── src/lib/                       wagmi config, contract ABIs, Subsquid hooks, IPFS upload utility

squid/                             Subsquid indexer — on-chain events → PostgreSQL → GraphQL API
```

### Data flow

```
User → Frontend (wagmi/viem)
     → Sepolia contracts
     → Chainlink Automation (JoinOpen → Active → VerifyPending transitions)
     → Chainlink Functions (ApiOracle / AiOracle verdicts)
     → settle()
     → Subsquid indexes events → GraphQL → Frontend (challenge list, leaderboard, activity feed)
```

**Challenge state machine:** `JoinOpen → Active → VerifyPending → Settled`

Both state transitions are driven automatically by Chainlink Automation — no manual calls required. The `OnChainVerifier` delivers verdicts synchronously in the same transaction; oracle verifiers deliver results asynchronously via Chainlink DON callbacks.

**Settlement math (IndividualChallenge):**
- Fee = losing pool × 2% → Treasury
- Creator passed (FOR wins): each FOR bettor gets stake back + (their stake / forPool) × againstPool × 98%
- Creator failed (AGAINST wins): AGAINST payout capped at 2× stake; overflow of FOR pool → Treasury
- AGAINST pool capped at `buyIn × 5` — `placeBet` reverts if exceeded

**Settlement math (Group / Public):**
- Fee = loser pot × 2% → Treasury
- Each winner: stake back + (their stake / totalWinnerStake) × loserPot × 98%
- All lose → entire pot → Treasury; All win → everyone gets stake back
- PublicChallenge adds: `prizePool / winnersCount` flat ETH bonus per winner from Treasury

**Reputation deltas:** Participant win +100 / Participant lose −50 / Bettor on winning side +25 / Bettor on losing side 0

---

## Live Deployment

**Network:** Ethereum Sepolia Testnet (Chain ID 11155111)

| Contract | Address | Verified |
|---|---|---|
| ChallengeFactory | `0xEe4BD2DF1A4bEeE95B2f2a4294aC5505D2c4E63A` | [Etherscan ↗](https://sepolia.etherscan.io/address/0xEe4BD2DF1A4bEeE95B2f2a4294aC5505D2c4E63A#code) |
| PublicGovernance | `0x357b38fb575Efb7C87B5ae3624ae1BA364612C1b` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x357b38fb575Efb7C87B5ae3624ae1BA364612C1b#code) |
| Treasury | `0x7Bed6b0c62E9C377d94D5bE96f478ea5Aa879CA5` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x7Bed6b0c62E9C377d94D5bE96f478ea5Aa879CA5#code) |
| Reputation | `0x91Eb85782fe19056f4EC8837e2B66fb5650CB782` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x91Eb85782fe19056f4EC8837e2B66fb5650CB782#code) |
| OnChainVerifier | `0x2e914A5ac4fCddA017e2010aBe361837Bd4D1A10` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x2e914A5ac4fCddA017e2010aBe361837Bd4D1A10#code) |
| ApiOracleVerifier | `0x2300EC5dEAf26161FC5443C289E7623eC6B8F7D2` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x2300EC5dEAf26161FC5443C289E7623eC6B8F7D2#code) |
| AiOracleVerifier | `0xCFd57B1c577cCf2023575000ea7E5F8aF6Cd5D79` | [Etherscan ↗](https://sepolia.etherscan.io/address/0xCFd57B1c577cCf2023575000ea7E5F8aF6Cd5D79#code) |
| IndividualChallengeDeployer | `0xDBd6BEc16451BB680e0ef6E920E8B054B71bB10e` | [Etherscan ↗](https://sepolia.etherscan.io/address/0xDBd6BEc16451BB680e0ef6E920E8B054B71bB10e#code) |
| GroupChallengeDeployer | `0x0cb81bB988e079366FA34C96f02f29749F2dE7A3` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x0cb81bB988e079366FA34C96f02f29749F2dE7A3#code) |
| PublicChallengeDeployer | `0x7776366a53e4f808D310A116F40438c890e99143` | [Etherscan ↗](https://sepolia.etherscan.io/address/0x7776366a53e4f808D310A116F40438c890e99143#code) |

All contracts are verified on Sepolia Etherscan with full source code visible.

### Hosted Frontend

The frontend is deployed to Vercel and connected to the live Sepolia contracts and Subsquid indexer:

**https://pact-dapp.vercel.app/**

No wallet is required to browse. Connect a Sepolia wallet (MetaMask or any WalletConnect-compatible wallet) to create challenges, place bets, or vote on governance proposals. Testnet ETH can be obtained from a Sepolia faucet.

---

## Running Locally

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
# fill in PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY, CHAINLINK_SUBSCRIPTION_ID
npx hardhat compile
npx hardhat test
# to deploy a fresh set to Sepolia:
npx hardhat run scripts/deploy.ts --network sepolia
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_ALCHEMY_RPC, contract addresses, NEXT_PUBLIC_PINATA_JWT
npm run dev
# opens at http://localhost:3000
```

### Subsquid indexer (optional — needed for challenge list, leaderboard, activity feed)

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

## Tests

```bash
cd contracts
npx hardhat test
npm run coverage
```

Current coverage: **91% statements**, **76% branches**, **88% functions**, **94% lines**. 235 tests passing.

The test suite uses mock contracts (`MockVerifier`, `MockFunctionsRouter`, `MockAutomationRegistrar`) to isolate Chainlink infrastructure from unit logic, and integrates direct contract-to-contract calls to verify settlement math, access control, and state machine transitions end-to-end.

---

## Challenge Scenarios (500+)

**On-chain (~85 scenarios)** — hold ETH above a threshold, hold ERC-20 tokens, own an NFT, maintain a DeFi position, or call any view function on any deployed contract. Supports compound AND/OR conditions.

**API Oracle (~255 scenarios)** — GitHub commit streaks, Strava running distance, Chess.com rating, Lichess puzzle score, LeetCode problems solved, Duolingo streak, Codeforces rank, WakaTime coding hours, Codewars kyu level, StackOverflow reputation, YouTube subscribers, Reddit karma, Last.fm scrobbles, Goodreads books read, and more. The expression engine reads IPFS-stored JSON criteria, so new scenarios require no contract redeployment.

**AI Oracle (~160 scenarios)** — any goal demonstrable in a daily photo. Gemini Vision evaluates each submission against a configurable prompt stored in IPFS. The verifier derives a daily nonce from `keccak256(challengeAddress, block.timestamp / 1 days)` that the participant must display visibly in the photo, preventing replay attacks.

---

## Known Limitations

Given more time, these are the areas I would improve:

- **Win/loss stats on profile** — the leaderboard shows reputation scores, but individual win/loss counts require Subsquid event aggregation that is not yet wired up on the frontend profile page.
- **AGAINST pool cap UX** — when the AGAINST pool is nearly full, the bet panel does not show how much capacity remains. A real-time cap indicator would prevent failed transactions.
- **Gemini API rate limit** — the free Gemini tier supports 1,500 requests/day, which is fine for testnet but would require a paid plan at scale. The AI verifier could be made more resilient by batching or queuing submissions.
- **Chainlink Functions HTTP limit** — each Functions execution is limited to 5 outbound HTTP requests. Compound oracle challenges (e.g., "GitHub AND Strava") cannot use more than 5 data sources in a single verification call.
- **No mainnet deployment** — the protocol is Sepolia-only. A mainnet deployment would require a full audit, a funded Chainlink subscription, and a more carefully tuned fee schedule.
- **Subsquid archive API keys** — the v2 archive requires API keys after May 2026. The squid deployment will need updating before that deadline (register at portal.sqd.dev).
- **Governance quorum** — there is currently no minimum quorum on governance proposals. A low-turnout vote can elect a public challenge. A quorum mechanism and proposal expiry timer would make governance more robust.
- **Mobile layout** — the UI is optimized for desktop. The betting panel and challenge creation wizard need responsive polish for smaller screens.

---

## Use of AI Tools

Claude was used throughout this project in two main ways:

**Code assistance** — for drafting Solidity patterns (especially the checks-effects-interactions layout across multiple settlement paths), for writing Hardhat test fixtures, and for structuring the Chainlink Functions JavaScript source files (`apiVerifier.js`, `aiVerifier.js`). In each case the output was reviewed, corrected, and adapted — the architecture and design decisions were made independently.

**Expression engine design** — the JSON criteria schema for the API oracle (the structure that encodes "GitHub commits > 30 AND Strava distance > 50km") was sketched out with AI assistance to enumerate edge cases and catch ambiguous operator precedence before the parser was written.

AI-generated code was never committed without review. All security-critical paths (settlement math, access control modifiers, reentrancy guards) were written manually and verified with three static analysis tools (Slither, Wake, Pashov x-ray).

---

## What We Learned

- **Chainlink is three separate systems.** Automation, Functions, and DON-hosted secrets each have their own dashboard, subscription type, funding requirement, and deployment model. Wiring all three together in a single protocol required careful coordination and a lot of reading the docs before a single line of code was written.
- **Designing for automation rather than manual calls changes everything.** Driving state transitions through `checkUpkeep` / `performUpkeep` instead of owner functions made the protocol feel genuinely trustless — no party can block settlement. The tradeoff is that the state machine has to be airtight, because there is no emergency override.
- **The checks-effects-interactions pattern is harder with multiple settlement paths.** IndividualChallenge, GroupChallenge, and PublicChallenge each have different payout formulas, and ensuring no path allowed reentrancy required mapping every ETH transfer to a pull-withdrawal or a post-state-update push. Three static analysis tools found real issues.
- **IPFS + an expression engine is a better extensibility model than adding new contracts.** The ability to deploy a new challenge scenario (e.g., "Goodreads books > 12") by uploading a JSON file to IPFS, without touching any deployed contract, was one of the best architectural decisions in the project.
- **Subsquid dramatically simplifies frontend data.** Reading the challenge list, bet history, leaderboard, and activity feed directly from contract events via `eth_getLogs` would have been slow and expensive. Subsquid's GraphQL layer made the frontend feel like a normal web app backed by a database.
- **Security tooling finds things you miss.** Running Slither, Wake, and Pashov x-ray sequentially on the same codebase surfaced overlapping and complementary issues. None of them would have caught everything on their own.

---

## Conclusion

PACT combines prediction markets with personal accountability in a way that requires no trusted intermediary. The three-verifier architecture (trustless on-chain reads, API-based oracles, AI vision verification) covers a wide range of real-world goals within a single unified protocol. The expression engine and generic call parser make the system extensible to hundreds of new challenge scenarios without contract redeployment.

The project was built as a full-stack dApp from scratch: Solidity contracts, Chainlink integrations, a Next.js frontend, and a Subsquid indexer. The most challenging parts were correctly applying settlement math across three challenge types and coordinating Chainlink Automation + Functions in a way that made the protocol behave trustlessly end-to-end. The result is a working protocol on Sepolia testnet with 235 passing tests and 91% statement coverage.
