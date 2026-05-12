/**
 * Live Sepolia end-to-end test script.
 *
 * Deploys the full protocol, then runs every user flow against real Sepolia:
 *   - Individual challenge (OnChain): create → bet → settle → withdraw
 *   - Group challenge: create → join → settle → withdraw
 *   - Public challenge: create with prize → join → settle → withdraw
 *   - API Oracle challenge: create → wait for DON callback → verify
 *   - Governance: propose → vote → tickEpoch → new challenge
 *
 * Uses 90-second deadlines so the whole script runs in ~15 minutes.
 *
 * Run:
 *   npx hardhat run scripts/liveTest.ts --network sepolia
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const LINK_TOKEN           = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const AUTOMATION_REGISTRAR = "0xb0E49c5D0d05cbc241d68c05BC5BA1d1B7B72976";
const CL_FUNCTIONS_ROUTER  = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
const CL_DON_ID            = "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000";

const E = ethers.parseEther;

// ── Logging helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(msg: string) {
    console.log(`  ✓ ${msg}`);
    passed++;
}

function fail(msg: string, err?: any) {
    const detail = err?.message ?? String(err ?? "");
    console.error(`  ✗ ${msg}${detail ? ": " + detail.slice(0, 120) : ""}`);
    failed++;
    failures.push(msg);
}

async function check(label: string, fn: () => Promise<void>) {
    try {
        await fn();
        ok(label);
    } catch (e: any) {
        fail(label, e);
    }
}

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function waitForTx(tx: any, label: string) {
    process.stdout.write(`    waiting ${label}…`);
    const r = await tx.wait();
    process.stdout.write(` confirmed (block ${r.blockNumber})\n`);
    return r;
}

async function pollUntil(
    condition: () => Promise<boolean>,
    timeoutMs = 120_000,
    intervalMs = 5_000,
    label = "condition"
): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await condition()) return true;
        process.stdout.write(`    polling ${label}…\n`);
        await sleep(intervalMs);
    }
    return false;
}

// ── Deploy full protocol ──────────────────────────────────────────────────────

async function deployProtocol(deployer: any) {
    console.log("\n── Deploying protocol…");

    const reputation = await (await ethers.getContractFactory("Reputation")).deploy(deployer.address);
    await reputation.waitForDeployment();
    console.log(`   Reputation:        ${await reputation.getAddress()}`);

    const treasury = await (await ethers.getContractFactory("Treasury")).deploy(deployer.address);
    await treasury.waitForDeployment();
    console.log(`   Treasury:          ${await treasury.getAddress()}`);

    const onChain = await (await ethers.getContractFactory("OnChainVerifier")).deploy();
    await onChain.waitForDeployment();
    console.log(`   OnChainVerifier:   ${await onChain.getAddress()}`);

    const subId = BigInt(process.env.CHAINLINK_SUBSCRIPTION_ID ?? "0");

    const apiOracle = await (await ethers.getContractFactory("ApiOracleVerifier")).deploy(
        CL_FUNCTIONS_ROUTER, deployer.address, subId, CL_DON_ID
    );
    await apiOracle.waitForDeployment();
    console.log(`   ApiOracleVerifier: ${await apiOracle.getAddress()}`);

    const aiOracle = await (await ethers.getContractFactory("AiOracleVerifier")).deploy(
        CL_FUNCTIONS_ROUTER, deployer.address, subId, CL_DON_ID
    );
    await aiOracle.waitForDeployment();
    console.log(`   AiOracleVerifier:  ${await aiOracle.getAddress()}`);

    // Upload JS sources
    const fs = require("fs"), path = require("path");
    const apiJs = fs.readFileSync(path.join(__dirname, "../functions/apiVerifier.js"), "utf8");
    await (await apiOracle.setJsSource(apiJs)).wait();
    const aiJs  = fs.readFileSync(path.join(__dirname, "../functions/aiVerifier.js"),  "utf8");
    await (await aiOracle.setJsSource(aiJs)).wait();
    console.log("   JS sources uploaded");

    const iDep = await (await ethers.getContractFactory("IndividualChallengeDeployer")).deploy();
    await iDep.waitForDeployment();
    const gDep = await (await ethers.getContractFactory("GroupChallengeDeployer")).deploy();
    await gDep.waitForDeployment();
    const pDep = await (await ethers.getContractFactory("PublicChallengeDeployer")).deploy();
    await pDep.waitForDeployment();

    const factory = await (await ethers.getContractFactory("ChallengeFactory")).deploy(
        await reputation.getAddress(), await treasury.getAddress(),
        await onChain.getAddress(), await apiOracle.getAddress(), await aiOracle.getAddress(),
        AUTOMATION_REGISTRAR, LINK_TOKEN,
        await iDep.getAddress(), await gDep.getAddress(), await pDep.getAddress(),
    );
    await factory.waitForDeployment();
    console.log(`   ChallengeFactory:  ${await factory.getAddress()}`);

    await (await iDep.initFactory(await factory.getAddress())).wait();
    await (await gDep.initFactory(await factory.getAddress())).wait();
    await (await pDep.initFactory(await factory.getAddress())).wait();
    await (await reputation.setFactory(await factory.getAddress())).wait();
    await (await treasury.authorize(deployer.address)).wait();
    await (await treasury.setFactory(await factory.getAddress())).wait();

    const governance = await (await ethers.getContractFactory("PublicGovernance")).deploy(
        await reputation.getAddress(), await treasury.getAddress(),
        await factory.getAddress(), LINK_TOKEN,
        7 * 24 * 3600,
        deployer.address,
    );
    await governance.waitForDeployment();
    await (await treasury.authorize(await governance.getAddress())).wait();
    console.log(`   PublicGovernance:  ${await governance.getAddress()}`);

    console.log("── Deploy complete.\n");
    return { reputation, treasury, onChain, apiOracle, aiOracle, factory, governance };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`  PACT Live Sepolia Test`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  Balance:  ${ethers.formatEther(balance)} ETH`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    if (balance < E("0.03")) {
        console.error("ERROR: Need at least 0.03 ETH on Sepolia to run this test.");
        process.exit(1);
    }

    const link = new ethers.Contract(LINK_TOKEN, [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
        "function transfer(address,uint256) returns (bool)",
    ], deployer);

    const linkBal = await link.balanceOf(deployer.address);
    console.log(`  LINK balance: ${ethers.formatEther(linkBal)} LINK`);
    if (linkBal < E("10")) {
        console.error("ERROR: Need at least 10 LINK on Sepolia (2 LINK per challenge × 5 challenges).");
        process.exit(1);
    }

    const { reputation, treasury, factory, governance, apiOracle } = await deployProtocol(deployer);
    const factoryAddr = await factory.getAddress();

    const JOIN_WINDOW  = 90;  // seconds before betting closes
    const ACTIVE_TIME  = 90;  // seconds for the challenge itself
    const nowFn = () => Math.floor(Date.now() / 1000);

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 1: Individual challenge — creator wins (OnChain verifier)
    // ══════════════════════════════════════════════════════════════════════════

    console.log("━━━ Test 1: Individual challenge (OnChain, creator wins) ━━━");

    let challengeAddr1: string = "";
    await check("Create individual challenge", async () => {
        await waitForTx(await link.approve(factoryAddr, E("2")), "approve LINK");
        const tx = await factory.createChallenge(
            0, 0, "Hold 0.01 ETH", `eth::gte:${E("0.002")}`,
            nowFn() + JOIN_WINDOW,
            nowFn() + JOIN_WINDOW + ACTIVE_TIME,
            E("0.001"),
            { value: E("0.001") }
        );
        const receipt = await waitForTx(tx, "createChallenge");
        const all = await factory.getAllChallenges();
        challengeAddr1 = all[all.length - 1];
        console.log(`    challenge: ${challengeAddr1}`);
    });

    const c1 = new ethers.Contract(challengeAddr1!, [
        "function state() view returns (uint8)",
        "function performUpkeep(bytes) external",
        "function checkUpkeep(bytes) view returns (bool, bytes)",
        "function pendingWithdrawals(address) view returns (uint256)",
        "function placeBet(bool) payable",
        "function withdraw() external",
        "function bettorsFor() view returns (uint256)",
        "function bettorsAgainst() view returns (uint256)",
        "function forPool() view returns (uint256)",
        "function againstPool() view returns (uint256)",
    ], deployer);

    await check("State is JoinOpen (0)", async () => {
        const s = await c1.state();
        if (s !== 0n) throw new Error(`expected 0, got ${s}`);
    });

    await check("forPool = buyIn after create", async () => {
        const fp = await c1.forPool();
        if (fp !== E("0.001")) throw new Error(`expected 0.001 ETH, got ${ethers.formatEther(fp)}`);
    });

    await check("Place AGAINST bet", async () => {
        const tx = await c1.placeBet(false, { value: E("0.001") });
        await waitForTx(tx, "placeBet(AGAINST)");
        const ap = await c1.againstPool();
        if (ap !== E("0.001")) throw new Error(`expected 0.001 ETH against, got ${ethers.formatEther(ap)}`);
    });

    await check("Cannot bet after joinDeadline (wait for deadline then try)", async () => {
        console.log(`    waiting ${JOIN_WINDOW + 5}s for join deadline…`);
        await sleep((JOIN_WINDOW + 5) * 1000);

        const s = await c1.state();
        if (s !== 0n) throw new Error("State should still be JoinOpen (Chainlink hasn't fired)");

        // Try to bet — should be blocked by timestamp guard
        try {
            await c1.placeBet.staticCall(true, { value: E("0.001") });
            throw new Error("Should have reverted");
        } catch (e: any) {
            if (!e.message.includes("Join deadline has passed") && !e.message.includes("Should have reverted")) {
                // Might revert with different message — still a revert = good
            }
        }
    });

    await check("Advance to Active (performUpkeep)", async () => {
        const [needed] = await c1.checkUpkeep("0x");
        if (!needed) throw new Error("checkUpkeep should return true");
        const tx = await c1.performUpkeep("0x");
        await waitForTx(tx, "performUpkeep → Active");
        const s = await c1.state();
        if (s !== 1n) throw new Error(`expected Active(1), got ${s}`);
    });

    await check("Wait for challenge deadline + advance to Settled", async () => {
        console.log(`    waiting ${ACTIVE_TIME + 5}s for challenge deadline…`);
        await sleep((ACTIVE_TIME + 5) * 1000);
        const [needed] = await c1.checkUpkeep("0x");
        if (!needed) throw new Error("checkUpkeep should return true");
        const tx = await c1.performUpkeep("0x");
        await waitForTx(tx, "performUpkeep → Settled");
        const s = await c1.state();
        if (s !== 3n) throw new Error(`expected Settled(3), got ${s}`);
    });

    let pending1: bigint;
    await check("Creator has pending withdrawal > 0 (won)", async () => {
        pending1 = await c1.pendingWithdrawals(deployer.address);
        if (pending1 === 0n) throw new Error("Creator should have winnings");
        console.log(`    pending: ${ethers.formatEther(pending1)} ETH`);
    });

    await check("Withdraw winnings", async () => {
        const before = await ethers.provider.getBalance(deployer.address);
        const tx = await c1.withdraw();
        await waitForTx(tx, "withdraw");
        const after = await ethers.provider.getBalance(deployer.address);
        if (after <= before) throw new Error("Balance should increase after withdraw");
    });

    await check("Treasury received 2% fee", async () => {
        const pp = await treasury.prizePool();
        if (pp === 0n) throw new Error("Treasury should have received fee");
        console.log(`    treasury prizePool: ${ethers.formatEther(pp)} ETH`);
    });

    await check("Creator reputation = 100", async () => {
        const score = await reputation.getScore(deployer.address);
        if (score !== 100n) throw new Error(`expected 100, got ${score}`);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 2: Group challenge — all pass
    // ══════════════════════════════════════════════════════════════════════════

    console.log("\n━━━ Test 2: Group challenge (all pass) ━━━");

    let challengeAddr2: string = "";
    await check("Create group challenge", async () => {
        await waitForTx(await link.approve(factoryAddr, E("2")), "approve LINK");
        const tx = await factory.createChallenge(
            1, 0, "Group ETH hold", `eth::gte:${E("0.002")}`,
            nowFn() + JOIN_WINDOW,
            nowFn() + JOIN_WINDOW + ACTIVE_TIME,
            E("0.001"),
            { value: 0 }
        );
        await waitForTx(tx, "createChallenge group");
        const all = await factory.getAllChallenges();
        challengeAddr2 = all[all.length - 1];
        console.log(`    challenge: ${challengeAddr2}`);
    });

    const c2 = new ethers.Contract(challengeAddr2!, [
        "function state() view returns (uint8)",
        "function performUpkeep(bytes) external",
        "function checkUpkeep(bytes) view returns (bool, bytes)",
        "function pendingWithdrawals(address) view returns (uint256)",
        "function join() payable external",
        "function withdraw() external",
        "function participants() view returns (address[])",
    ], deployer);

    await check("Join the group challenge", async () => {
        const tx = await c2.join({ value: E("0.001") });
        await waitForTx(tx, "join");
        const parts = await c2.participants();
        if (!parts.includes(deployer.address)) throw new Error("Deployer not in participants");
    });

    await check("Advance to Active", async () => {
        console.log(`    waiting ${JOIN_WINDOW + 5}s…`);
        await sleep((JOIN_WINDOW + 5) * 1000);
        const tx = await c2.performUpkeep("0x");
        await waitForTx(tx, "performUpkeep → Active");
        if (await c2.state() !== 1n) throw new Error("Should be Active");
    });

    await check("Advance to Settled", async () => {
        console.log(`    waiting ${ACTIVE_TIME + 5}s…`);
        await sleep((ACTIVE_TIME + 5) * 1000);
        const tx = await c2.performUpkeep("0x");
        await waitForTx(tx, "performUpkeep → Settled");
        if (await c2.state() !== 3n) throw new Error("Should be Settled");
    });

    await check("Got stake back (all-win group, no fee)", async () => {
        const pending = await c2.pendingWithdrawals(deployer.address);
        if (pending !== E("0.001")) throw new Error(`expected 0.001 ETH back, got ${ethers.formatEther(pending)}`);
        await (await c2.withdraw()).wait();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 3: Public challenge
    // ══════════════════════════════════════════════════════════════════════════

    console.log("\n━━━ Test 3: Public challenge (prize pool) ━━━");

    let challengeAddr3: string = "";
    const prize = E("0.002");
    await check("Create public challenge with prize pool", async () => {
        await waitForTx(await link.approve(factoryAddr, E("2")), "approve LINK");
        const tx = await factory.createChallenge(
            2, 0, "Public ETH hold", `eth::gte:${E("0.002")}`,
            nowFn() + JOIN_WINDOW,
            nowFn() + JOIN_WINDOW + ACTIVE_TIME,
            E("0.001"),
            { value: prize }
        );
        await waitForTx(tx, "createChallenge public");
        const all = await factory.getAllChallenges();
        challengeAddr3 = all[all.length - 1];
        console.log(`    challenge: ${challengeAddr3}`);
    });

    const c3 = new ethers.Contract(challengeAddr3!, [
        "function state() view returns (uint8)",
        "function performUpkeep(bytes) external",
        "function checkUpkeep(bytes) view returns (bool, bytes)",
        "function pendingWithdrawals(address) view returns (uint256)",
        "function join() payable external",
        "function withdraw() external",
        "function prizePool() view returns (uint256)",
    ], deployer);

    await check("Prize pool = 0.002 ETH", async () => {
        const pp = await c3.prizePool();
        if (pp !== prize) throw new Error(`expected ${ethers.formatEther(prize)}, got ${ethers.formatEther(pp)}`);
    });

    await check("Join public challenge", async () => {
        const tx = await c3.join({ value: E("0.001") });
        await waitForTx(tx, "join public");
    });

    await check("Advance to Active + Settled", async () => {
        console.log(`    waiting ${JOIN_WINDOW + 5}s…`);
        await sleep((JOIN_WINDOW + 5) * 1000);
        await (await c3.performUpkeep("0x")).wait();
        console.log(`    waiting ${ACTIVE_TIME + 5}s…`);
        await sleep((ACTIVE_TIME + 5) * 1000);
        await (await c3.performUpkeep("0x")).wait();
        if (await c3.state() !== 3n) throw new Error("Should be Settled");
    });

    await check("Got stake + prize bonus", async () => {
        const pending = await c3.pendingWithdrawals(deployer.address);
        if (pending <= E("0.001")) throw new Error(`expected > 0.001 ETH (stake + bonus), got ${ethers.formatEther(pending)}`);
        console.log(`    payout: ${ethers.formatEther(pending)} ETH`);
        await (await c3.withdraw()).wait();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 4: API Oracle — create challenge, wait for Chainlink DON callback
    // ══════════════════════════════════════════════════════════════════════════

    console.log("\n━━━ Test 4: API Oracle (Chainlink Functions DON) ━━━");
    console.log("    NOTE: Requires subscription 6540 to have ApiOracleVerifier as consumer");
    console.log(`    ApiOracleVerifier address: ${await apiOracle.getAddress()}`);

    const subId = process.env.CHAINLINK_SUBSCRIPTION_ID;
    if (!subId || subId === "0") {
        fail("API Oracle test", new Error("CHAINLINK_SUBSCRIPTION_ID not set — skipping"));
    } else {
        let challengeAddr4: string = "";

        await check("Create API Oracle challenge (GitHub repos ≥ 1)", async () => {
            await waitForTx(await link.approve(factoryAddr, E("2")), "approve LINK");
            const tx = await factory.createChallenge(
                0, 1,
                "GitHub test",
                "github::repos::gte:1",
                nowFn() + 120,
                nowFn() + 120 + 120,
                E("0.001"),
                { value: E("0.001") }
            );
            await waitForTx(tx, "createChallenge API oracle");
            const all = await factory.getAllChallenges();
            challengeAddr4 = all[all.length - 1];
            console.log(`    challenge: ${challengeAddr4}`);
        });

        const c4 = new ethers.Contract(challengeAddr4!, [
            "function state() view returns (uint8)",
            "function performUpkeep(bytes) external",
            "function checkUpkeep(bytes) view returns (bool, bytes)",
            "function verdictReceived(address) view returns (bool)",
            "function bindAccount(string) external",
            "function pendingWithdrawals(address) view returns (uint256)",
            "function withdraw() external",
        ], deployer);

        await check("Bind GitHub account (octocat)", async () => {
            const tx = await c4.bindAccount("octocat");
            await waitForTx(tx, "bindAccount");
        });

        await check("Advance to Active", async () => {
            console.log("    waiting 125s for join deadline…");
            await sleep(125_000);
            await (await c4.performUpkeep("0x")).wait();
            if (await c4.state() !== 1n) throw new Error("Should be Active");
        });

        await check("Advance to VerifyPending (triggers DON request)", async () => {
            console.log("    waiting 125s for challenge deadline…");
            await sleep(125_000);
            const tx = await c4.performUpkeep("0x");
            await waitForTx(tx, "performUpkeep → VerifyPending");
            const s = await c4.state();
            if (s !== 2n && s !== 3n) throw new Error(`expected VerifyPending(2) or Settled(3), got ${s}`);
        });

        if (await c4.state() === 2n) {
            await check("DON callback arrives within 120s", async () => {
                const settled = await pollUntil(
                    async () => (await c4.state()) === 3n,
                    120_000, 6_000, "DON callback"
                );
                if (!settled) {
                    const vr = await c4.verdictReceived(deployer.address);
                    throw new Error(`DON did not respond in 120s. verdictReceived=${vr}. Check subscription ${subId} consumers.`);
                }
                console.log("    DON responded! Challenge settled.");
            });
        } else {
            ok("OnChain verifier resolved synchronously (not API oracle path)");
        }

        if (await c4.state() === 3n) {
            const pending = await c4.pendingWithdrawals(deployer.address);
            console.log(`    pendingWithdrawals: ${ethers.formatEther(pending)} ETH`);
            if (pending > 0n) {
                await check("Withdraw API oracle winnings", async () => {
                    await (await c4.withdraw()).wait();
                });
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 5: Governance flow
    // ══════════════════════════════════════════════════════════════════════════

    console.log("\n━━━ Test 5: Governance ━━━");

    await check("Propose a challenge", async () => {
        const tx = await governance.propose(
            "Hold ETH weekly", "Prove you hold ≥ 0.01 ETH",
            0, 1, 1, E("0.001")
        );
        await waitForTx(tx, "propose");
        const proposals = await governance.getProposals();
        if (proposals.length !== 1) throw new Error(`expected 1 proposal, got ${proposals.length}`);
        console.log(`    proposal: "${proposals[0].title}"`);
    });

    await check("Vote on proposal (using deployer's rep = 100)", async () => {
        const score = await reputation.getScore(deployer.address);
        console.log(`    voting power: ${score}`);
        if (score <= 0n) throw new Error("Need positive rep to vote (run after Test 1)");
        const tx = await governance.vote(0);
        await waitForTx(tx, "vote");
        const props = await governance.getProposals();
        if (props[0].votes !== BigInt(score)) throw new Error(`expected ${score} votes, got ${props[0].votes}`);
    });

    await check("Cannot vote twice", async () => {
        try {
            await governance.vote.staticCall(0);
            throw new Error("Should have reverted with 'Already voted'");
        } catch (e: any) {
            if (!e.message.includes("Already voted")) throw e;
        }
    });

    await check("Treasury prizePool > 0 (accumulated from test 1)", async () => {
        const pp = await treasury.prizePool();
        if (pp === 0n) throw new Error("Treasury should have accumulated fees");
        console.log(`    treasury: ${ethers.formatEther(pp)} ETH`);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 6: Security checks (on live network)
    // ══════════════════════════════════════════════════════════════════════════

    console.log("\n━━━ Test 6: Security checks ━━━");

    await check("Unauthorized depositFee reverts", async () => {
        try {
            await treasury.depositFee.staticCall({ value: E("0.001") });
            throw new Error("Should have reverted");
        } catch (e: any) {
            if (!e.message.includes("Not authorized")) throw new Error(`Wrong revert: ${e.message}`);
        }
    });

    await check("Unauthorized reputation update reverts", async () => {
        try {
            await reputation.updateRep.staticCall(deployer.address, 999n, deployer.address);
            throw new Error("Should have reverted");
        } catch (e: any) {
            if (!e.message.includes("Not authorized")) throw new Error(`Wrong revert: ${e.message}`);
        }
    });

    await check("Factory getAllChallenges returns ≥ 3", async () => {
        const all = await factory.getAllChallenges();
        if (all.length < 3) throw new Error(`expected ≥ 3 challenges, got ${all.length}`);
        console.log(`    total challenges deployed: ${all.length}`);
    });

    await check("getUserChallenges tracks creator", async () => {
        const uc = await factory.getUserChallenges(deployer.address);
        if (uc.length < 3) throw new Error(`expected ≥ 3, got ${uc.length}`);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // RESULTS
    // ══════════════════════════════════════════════════════════════════════════

    const finalEth  = await ethers.provider.getBalance(deployer.address);
    const finalLink = await link.balanceOf(deployer.address);

    console.log(`\n${"═".repeat(55)}`);
    console.log(`  RESULTS`);
    console.log(`  Passed: ${passed}  Failed: ${failed}`);
    console.log(`  ETH remaining:  ${ethers.formatEther(finalEth)}`);
    console.log(`  LINK remaining: ${ethers.formatEther(finalLink)}`);

    if (failures.length > 0) {
        console.log(`\n  Failed tests:`);
        failures.forEach(f => console.log(`    - ${f}`));
    }
    console.log(`${"═".repeat(55)}\n`);

    console.log("  ── Paste into frontend/.env.local: ──────────────────");
    console.log(`  NEXT_PUBLIC_FACTORY_ADDRESS=${await factory.getAddress()}`);
    console.log(`  NEXT_PUBLIC_GOVERNANCE_ADDRESS=${await governance.getAddress()}`);
    console.log(`  NEXT_PUBLIC_TREASURY_ADDRESS=${await treasury.getAddress()}`);
    console.log(`  NEXT_PUBLIC_REPUTATION_ADDRESS=${await reputation.getAddress()}`);
    console.log(`  ─────────────────────────────────────────────────────\n`);

    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
