/**
 * Fork tests — runs against a forked Sepolia state.
 *
 * Uses the REAL Chainlink LINK token (no mock), impersonates a Sepolia
 * account that holds LINK so test signers can get funded, and deploys
 * the entire protocol fresh into the fork.
 *
 * Run with:
 *   $env:FORK_SEPOLIA="true"; npx hardhat test test/fork/SepoliaFork.test.ts
 *
 * These tests are SKIPPED unless FORK_SEPOLIA=true because they require
 * a live Sepolia RPC (SEPOLIA_RPC_URL in .env).
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    IndividualChallenge__factory,
    GroupChallenge__factory,
    ChallengeFactory__factory,
    Reputation__factory,
    Treasury__factory,
    OnChainVerifier__factory,
    IndividualChallengeDeployer__factory,
    GroupChallengeDeployer__factory,
    PublicChallengeDeployer__factory,
} from "../../typechain-types";
import { IERC20__factory } from "../../typechain-types";

// ── Sepolia live addresses ─────────────────────────────────────────────────────

const LINK_TOKEN          = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const AUTOMATION_REGISTRAR = "0xb0E49c5D0d05cbc241d68c05BC5BA1d1B7B72976";

// A Sepolia address known to hold LINK — we impersonate it to fund our test accounts.
// (Sepolia Chainlink Functions Router — holds a lot of LINK)
const LINK_WHALE          = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";

const SKIP = !process.env.FORK_SEPOLIA;

// ─────────────────────────────────────────────────────────────────────────────

async function deployProtocolOnFork() {
    const [owner, alice, bob, carol] = await ethers.getSigners();

    // Impersonate LINK whale and send 10 LINK to each test account
    await ethers.provider.send("hardhat_impersonateAccount", [LINK_WHALE]);
    await ethers.provider.send("hardhat_setBalance", [LINK_WHALE, "0x56BC75E2D63100000"]); // 100 ETH
    const whale = await ethers.getSigner(LINK_WHALE);

    const link = IERC20__factory.connect(LINK_TOKEN, whale);
    const linkAmount = ethers.parseEther("10");

    for (const signer of [alice, bob, carol]) {
        await link.transfer(signer.address, linkAmount);
    }
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [LINK_WHALE]);

    // Deploy protocol
    const reputation = await new Reputation__factory(owner).deploy(owner.address);
    const treasury   = await new Treasury__factory(owner).deploy(owner.address);
    const verifier   = await new OnChainVerifier__factory(owner).deploy();

    const iDep = await new IndividualChallengeDeployer__factory(owner).deploy();
    const gDep = await new GroupChallengeDeployer__factory(owner).deploy();
    const pDep = await new PublicChallengeDeployer__factory(owner).deploy();

    const factory = await new ChallengeFactory__factory(owner).deploy(
        await reputation.getAddress(), await treasury.getAddress(),
        await verifier.getAddress(), await verifier.getAddress(), await verifier.getAddress(),
        AUTOMATION_REGISTRAR, LINK_TOKEN,
        await iDep.getAddress(), await gDep.getAddress(), await pDep.getAddress(),
    );

    await iDep.initFactory(await factory.getAddress());
    await gDep.initFactory(await factory.getAddress());
    await pDep.initFactory(await factory.getAddress());
    await reputation.setFactory(await factory.getAddress());
    await treasury.authorize(owner.address);
    await treasury.setFactory(await factory.getAddress());

    return { owner, alice, bob, carol, reputation, treasury, factory, link: IERC20__factory.connect(LINK_TOKEN, alice) };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Fork: Real LINK token + Automation Registrar", function () {
    this.timeout(120_000);

    before(function () {
        if (SKIP) this.skip();
    });

    it("F1. LINK approval and transfer from creator uses real ERC20 (not mock)", async () => {
        const { factory, alice, link, reputation } = await deployProtocolOnFork();

        const buyIn = ethers.parseEther("0.05");
        const now   = await time.latest();

        // Snapshot alice's LINK balance before (may be > 10 if her address has on-chain LINK)
        const aliceLinkBefore = await link.balanceOf(alice.address);
        expect(aliceLinkBefore).to.be.greaterThanOrEqual(ethers.parseEther("10")); // at least our transfer

        // Approve real LINK
        await link.connect(alice).approve(await factory.getAddress(), ethers.parseEther("2"));

        // Create challenge — factory pulls 2 real LINK
        await factory.connect(alice).createChallenge(
            0, 0, "Fork Test Challenge", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );

        // Alice lost exactly 2 LINK (factory pulled them for upkeep funding)
        const aliceLinkAfter = await link.balanceOf(alice.address);
        expect(aliceLinkBefore - aliceLinkAfter).to.equal(ethers.parseEther("2"));

        // Challenge was created
        const all = await factory.getAllChallenges();
        expect(all.length).to.equal(1);
        expect(await ethers.provider.getBalance(all[0])).to.equal(buyIn);
    });

    it("F2. Automation Registrar called — challenge created regardless of registration outcome", async () => {
        const { factory, alice, link } = await deployProtocolOnFork();

        const buyIn = ethers.parseEther("0.05");
        const now   = await time.latest();

        await link.connect(alice).approve(await factory.getAddress(), ethers.parseEther("2"));

        // The real Automation Registrar may or may not register the upkeep
        // (it requires LINK pre-funding + valid params), but the challenge must
        // always be created regardless of whether registration succeeds.
        await expect(factory.connect(alice).createChallenge(
            0, 0, "Automation Test", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        )).to.not.be.reverted;

        const all = await factory.getAllChallenges();
        expect(all.length).to.equal(1);

        const c = IndividualChallenge__factory.connect(all[0], alice);

        // Even if upkeep registration failed, performUpkeep should work
        // (we removed require(upkeepRegistered) from performUpkeep)
        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        expect(await c.state()).to.equal(1); // Active
    });

    it("F3. OnChain verifier checks REAL ETH balance on forked state", async () => {
        const { factory, alice, bob, link, treasury } = await deployProtocolOnFork();

        const buyIn = ethers.parseEther("0.05");
        const now   = await time.latest();

        // alice holds real ETH — she will pass "eth::gte:1"
        expect(await ethers.provider.getBalance(alice.address)).to.be.greaterThan(ethers.parseEther("1"));

        await link.connect(alice).approve(await factory.getAddress(), ethers.parseEther("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Real ETH check", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );

        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );
        await c.connect(bob).placeBet(false, { value: buyIn });

        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        await time.increaseTo(now + 901);
        await c.performUpkeep("0x"); // → verifies alice holds ≥ 1 ETH → FOR wins

        expect(await c.state()).to.equal(3); // Settled
        expect(await c.pendingWithdrawals(alice.address)).to.be.greaterThan(buyIn); // won
        expect(await c.pendingWithdrawals(bob.address)).to.equal(0n); // lost
        expect(await treasury.prizePool()).to.be.greaterThan(0n); // fee charged
    });

    it("F4. Real ERC20 criteria: check real Sepolia token balance", async () => {
        const { factory, alice, bob, link } = await deployProtocolOnFork();

        const buyIn = ethers.parseEther("0.05");
        const now   = await time.latest();

        // Use the LINK token itself as criteria: alice holds 8 LINK (10 - 2 transferred)
        // Criteria: hold >= 1 LINK
        const criteria = `erc20:${LINK_TOKEN}:${ethers.parseEther("1")}`;

        await link.connect(alice).approve(await factory.getAddress(), ethers.parseEther("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "LINK balance check", criteria,
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );

        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );
        await c.connect(bob).placeBet(false, { value: buyIn });

        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        await time.increaseTo(now + 901);
        await c.performUpkeep("0x");

        // Alice holds 8 LINK (≥ 1) → passes → FOR wins
        expect(await c.state()).to.equal(3);
        expect(await c.pendingWithdrawals(alice.address)).to.be.greaterThan(buyIn);
        expect(await c.pendingWithdrawals(bob.address)).to.equal(0n);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Fork: Security probes on real chain state", function () {
    this.timeout(120_000);

    before(function () {
        if (SKIP) this.skip();
    });

    it("F5. Cannot bet after joinDeadline even on forked chain", async () => {
        const { factory, alice, bob, carol, link } = await deployProtocolOnFork();

        const buyIn = ethers.parseEther("0.05");
        const now   = await time.latest();

        await link.connect(alice).approve(await factory.getAddress(), ethers.parseEther("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Late bet security", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );

        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        await time.increaseTo(now + 301); // past joinDeadline, state still JoinOpen

        await expect(c.connect(carol).placeBet(true, { value: buyIn }))
            .to.be.revertedWith("Join deadline has passed");
    });

    it("F6. Anyone can advance state on forked chain (no upkeepRegistered check)", async () => {
        const { factory, alice, bob, carol, link } = await deployProtocolOnFork();

        const buyIn = ethers.parseEther("0.05");
        const now   = await time.latest();

        await link.connect(alice).approve(await factory.getAddress(), ethers.parseEther("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Anyone advance", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );

        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        await time.increaseTo(now + 301);

        // bob (random, not Chainlink) advances the state
        await c.connect(bob).performUpkeep("0x");
        expect(await c.state()).to.equal(1);

        // carol (random) advances the state
        await time.increaseTo(now + 901);
        await c.connect(carol).performUpkeep("0x");
        expect(await c.state()).to.equal(3); // Settled
    });
});
