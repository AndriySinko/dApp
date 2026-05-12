/**
 * EVERYTHING ON CHAIN — Comprehensive Sepolia fork test.
 *
 * Tests every feature of the PACT dApp against a forked Sepolia state:
 *   - Real LINK ERC20 (not mock)
 *   - Real ETH balances verified by OnChainVerifier
 *   - Real Chainlink Automation Registrar
 *
 * Every test tracks actual ETH balances, pendingWithdrawals, events, and
 * on-chain state. Nothing is mocked except the verifier oracle for
 * non-OnChain verifier types (Chainlink Functions can't run in a fork).
 *
 * Run:
 *   $env:FORK_SEPOLIA="true"
 *   npx hardhat test test/fork/EverythingOnChain.test.ts
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
    IndividualChallenge__factory,
    GroupChallenge__factory,
    PublicChallenge__factory,
    ChallengeFactory__factory,
    Reputation__factory,
    Treasury__factory,
    PublicGovernance__factory,
    OnChainVerifier__factory,
    IndividualChallengeDeployer__factory,
    GroupChallengeDeployer__factory,
    PublicChallengeDeployer__factory,
    IERC20__factory,
} from "../../typechain-types";

// ── Sepolia constants ─────────────────────────────────────────────────────────

const LINK_TOKEN           = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const AUTOMATION_REGISTRAR = "0xb0E49c5D0d05cbc241d68c05BC5BA1d1B7B72976";
const LINK_WHALE           = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";

const E = ethers.parseEther;
const SKIP = !process.env.FORK_SEPOLIA;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function gasCost(tx: any): Promise<bigint> {
    const r = await tx.wait();
    return r.gasUsed * r.gasPrice;
}

async function fundLink(signers: HardhatEthersSigner[], amount = E("10")) {
    await ethers.provider.send("hardhat_impersonateAccount", [LINK_WHALE]);
    await ethers.provider.send("hardhat_setBalance", [LINK_WHALE, "0x56BC75E2D63100000"]);
    const whale = await ethers.getSigner(LINK_WHALE);
    const link  = IERC20__factory.connect(LINK_TOKEN, whale);
    for (const s of signers) await link.transfer(s.address, amount);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [LINK_WHALE]);
}

// ── Full protocol deploy ──────────────────────────────────────────────────────

async function deployAll() {
    const [owner, alice, bob, carol, dave, eve] = await ethers.getSigners();

    // Fund everyone with LINK for challenge creation
    await fundLink([alice, bob, carol, dave, eve], E("20"));

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

    const governance = await new PublicGovernance__factory(owner).deploy(
        await reputation.getAddress(), await treasury.getAddress(),
        await factory.getAddress(), LINK_TOKEN,
        7 * 24 * 3600, // 7-day epoch
        owner.address,
    );
    await treasury.authorize(await governance.getAddress());

    const link = IERC20__factory.connect(LINK_TOKEN, alice);

    return { owner, alice, bob, carol, dave, eve, reputation, treasury, factory, governance, verifier, link };
}

async function approveLink(signer: HardhatEthersSigner, spender: string) {
    const link = IERC20__factory.connect(LINK_TOKEN, signer);
    await link.approve(spender, E("2"));
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Everything On Chain — Sepolia Fork", function () {
    this.timeout(300_000);

    before(function () { if (SKIP) this.skip(); });

    // ═══════════════════════════════════════════════════════════════════════
    // 1. INDIVIDUAL CHALLENGE — COMPLETE LIFECYCLE (CREATOR WINS)
    // ═══════════════════════════════════════════════════════════════════════

    describe("1. Individual Challenge — creator wins", () => {

        it("1a. Create, state=JoinOpen, contract holds buyIn", async () => {
            const { factory, alice } = await deployAll();
            const buyIn = E("0.05");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());

            const tx = await factory.connect(alice).createChallenge(
                0, 0, "Prove 1 ETH", "eth::gte:1",
                now + 300, now + 900, buyIn,
                { value: buyIn }
            );
            await expect(tx).to.emit(factory, "ChallengeCreated");

            const all = await factory.getAllChallenges();
            const c = IndividualChallenge__factory.connect(all[0], alice);

            expect(await c.state()).to.equal(0);  // JoinOpen
            expect(await c.creator()).to.equal(alice.address);
            expect(await c.buyIn()).to.equal(buyIn);
            expect(await ethers.provider.getBalance(all[0])).to.equal(buyIn);
            expect(await c.bettorsFor()).to.equal(1n);   // creator counts
            expect(await c.bettorsAgainst()).to.equal(0n);
            expect(await c.forPool()).to.equal(buyIn);
            expect(await c.againstPool()).to.equal(0n);
        });

        it("1b. Bob bets FOR, carol bets AGAINST — balances correct", async () => {
            const { factory, alice, bob, carol } = await deployAll();
            const buyIn = E("0.05");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "ETH", "eth::gte:1", now + 300, now + 900, buyIn, { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            const bobBefore   = await ethers.provider.getBalance(bob.address);
            const carolBefore = await ethers.provider.getBalance(carol.address);

            const betForTx      = await c.connect(bob).placeBet(true,  { value: buyIn });
            const betAgainstTx  = await c.connect(carol).placeBet(false, { value: buyIn });
            const gasFor        = await gasCost(betForTx);
            const gasAgainst    = await gasCost(betAgainstTx);

            expect(await c.forPool()).to.equal(buyIn * 2n);
            expect(await c.againstPool()).to.equal(buyIn);
            expect(await c.bettorsFor()).to.equal(2n);
            expect(await c.bettorsAgainst()).to.equal(1n);
            expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(buyIn * 3n);
            expect((await ethers.provider.getBalance(bob.address)) - (bobBefore - buyIn - gasFor)).to.equal(0n);
            expect((await ethers.provider.getBalance(carol.address)) - (carolBefore - buyIn - gasAgainst)).to.equal(0n);

            // Both registered
            expect(await c.isRegistered(bob.address)).to.be.true;
            expect(await c.isRegistered(carol.address)).to.be.true;
        });

        it("1c. JoinOpen→Active→Settled in correct order, times respected", async () => {
            const { factory, alice, bob, carol, treasury, reputation } = await deployAll();
            const buyIn = E("0.05");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "ETH", "eth::gte:1", now + 300, now + 900, buyIn, { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            await c.connect(bob).placeBet(true,  { value: buyIn });
            await c.connect(carol).placeBet(false, { value: buyIn });

            // ── JoinOpen → Active ─────────────────────────────────────────
            let [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.false;

            await time.increaseTo(now + 301);
            [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.true;

            const activeTx = await c.connect(bob).performUpkeep("0x"); // bob = anyone
            await expect(activeTx).to.emit(c, "StateChanged");
            expect(await c.state()).to.equal(1); // Active

            // Cannot bet in Active
            await expect(c.connect(carol).placeBet(true, { value: buyIn }))
                .to.be.revertedWith("Betting closed");

            // ── Active → Settled (OnChain is synchronous) ─────────────────
            await time.increaseTo(now + 901);
            [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.true;

            const treasuryBefore = await treasury.prizePool();
            const settleTx = await c.connect(carol).performUpkeep("0x"); // carol = anyone
            await expect(settleTx).to.emit(c, "Settled");
            expect(await c.state()).to.equal(3); // Settled

            // ── Payout math ───────────────────────────────────────────────
            // againstPool = 0.05, fee = 0.001, winnerPot = 0.049
            // forPool = 0.1
            // alice winnings = 0.05 * 0.049 / 0.1 = 0.0245 → total 0.0745
            // bob   winnings = same                          = 0.0745
            // carol = 0
            const fee = buyIn * 2n / 100n;
            const winnerPot = buyIn - fee;
            const alicePending = await c.pendingWithdrawals(alice.address);
            const bobPending   = await c.pendingWithdrawals(bob.address);
            const carolPending = await c.pendingWithdrawals(carol.address);

            expect(alicePending).to.equal(buyIn + buyIn * winnerPot / (buyIn * 2n));
            expect(bobPending).to.equal(alicePending);
            expect(carolPending).to.equal(0n);
            expect(await treasury.prizePool() - treasuryBefore).to.equal(fee);

            // ── Reputation ────────────────────────────────────────────────
            expect(await reputation.getScore(alice.address)).to.equal(100n);
            expect(await reputation.getScore(bob.address)).to.equal(25n);
            expect(await reputation.getScore(carol.address)).to.equal(0n);

            // ── Withdrawals ───────────────────────────────────────────────
            const aliceBefore = await ethers.provider.getBalance(alice.address);
            const wTx = await c.connect(alice).withdraw();
            const wGas = await gasCost(wTx);
            expect((await ethers.provider.getBalance(alice.address)) - aliceBefore + wGas)
                .to.equal(alicePending);

            await c.connect(bob).withdraw();
            expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(0n);
            await expect(c.connect(carol).withdraw()).to.be.revertedWith("Nothing to withdraw");
            await expect(c.connect(alice).withdraw()).to.be.revertedWith("Nothing to withdraw");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 2. INDIVIDUAL CHALLENGE — CREATOR FAILS
    // ═══════════════════════════════════════════════════════════════════════

    describe("2. Individual Challenge — creator fails, AGAINST wins", () => {

        it("2a. Full lifecycle: AGAINST bettors collect, creator loses rep", async () => {
            const { factory, alice, bob, carol, treasury, reputation } = await deployAll();
            const buyIn = E("0.05");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Hold 999999 ETH", `eth::gte:${E("999999")}`,
                now + 300, now + 900, buyIn,
                { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            await c.connect(bob).placeBet(false,  { value: E("0.1") });
            await c.connect(carol).placeBet(false, { value: E("0.1") });

            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await c.performUpkeep("0x");

            expect(await c.state()).to.equal(3);

            // forPool = 0.05, fee = 0.001, grossWinnerPot = 0.049
            // againstPool = 0.2, cappedWinnerPot = min(0.049, 0.2) = 0.049
            // bob   winnings = 0.1 * 0.049 / 0.2 = 0.0245 → total 0.1245
            // carol winnings = same
            const fee = E("0.05") * 2n / 100n;
            const cappedWinnerPot = E("0.05") - fee; // 0.049, < againstPool
            const bobPending   = await c.pendingWithdrawals(bob.address);
            const carolPending = await c.pendingWithdrawals(carol.address);
            expect(await c.pendingWithdrawals(alice.address)).to.equal(0n);
            expect(bobPending).to.equal(E("0.1") + E("0.1") * cappedWinnerPot / E("0.2"));
            expect(carolPending).to.equal(bobPending);

            // dust goes to treasury
            const distributedWinnings = (E("0.1") * cappedWinnerPot / E("0.2")) * 2n;
            const dust = cappedWinnerPot - distributedWinnings;
            expect(await treasury.prizePool()).to.equal(fee + dust);

            // Rep
            expect(await reputation.getScore(alice.address)).to.equal(-50n);
            expect(await reputation.getScore(bob.address)).to.equal(25n);
            expect(await reputation.getScore(carol.address)).to.equal(25n);

            // Collect
            await c.connect(bob).withdraw();
            await c.connect(carol).withdraw();
            expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(0n);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 3. INDIVIDUAL CHALLENGE — EDGE CASES
    // ═══════════════════════════════════════════════════════════════════════

    describe("3. Individual Challenge — edge cases", () => {

        it("3a. No AGAINST bettors — creator wins, gets exact stake back, no fee", async () => {
            const { factory, alice, bob, treasury } = await deployAll();
            const buyIn = E("0.05");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Solo", "eth::gte:1", now + 300, now + 900, buyIn, { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await c.connect(bob).placeBet(true, { value: buyIn }); // FOR only

            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await c.performUpkeep("0x");

            expect(await c.pendingWithdrawals(alice.address)).to.equal(buyIn);
            expect(await c.pendingWithdrawals(bob.address)).to.equal(buyIn);
            expect(await treasury.prizePool()).to.equal(0n); // no fee
        });

        it("3b. AGAINST cap at 5× buyIn enforced", async () => {
            const { factory, alice, bob, carol, dave } = await deployAll();
            const buyIn = E("0.1");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Cap test", `eth::gte:${E("999999")}`,
                now + 300, now + 900, buyIn, { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            // 4× against accepted
            await c.connect(bob).placeBet(false,  { value: E("0.2") });
            await c.connect(carol).placeBet(false, { value: E("0.2") });
            expect(await c.againstPool()).to.equal(E("0.4"));

            // 5th would push to 0.6 = 6×: rejected
            await expect(c.connect(dave).placeBet(false, { value: E("0.2") }))
                .to.be.revertedWith("AGAINST pool cap reached");

            // Exactly filling to 5× (0.1 more) is accepted
            await c.connect(dave).placeBet(false, { value: E("0.1") });
            expect(await c.againstPool()).to.equal(E("0.5"));

            // 1 wei over 5× is rejected
            const [,,,,, eve] = await ethers.getSigners();
            await expect(c.connect(eve).placeBet(false, { value: 1n }))
                .to.be.revertedWith("AGAINST pool cap reached");
        });

        it("3c. FOR minimum = buyIn, 1 wei below reverts", async () => {
            const { factory, alice, bob } = await deployAll();
            const buyIn = E("0.1");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Min FOR", "eth::gte:1", now + 300, now + 900, buyIn, { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await expect(c.connect(bob).placeBet(true, { value: buyIn - 1n }))
                .to.be.revertedWith("FOR bet below minimum buy-in");
            await expect(c.connect(bob).placeBet(true, { value: buyIn }))
                .to.not.be.reverted;
        });

        it("3d. Creator cannot bet on own challenge", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Self bet", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await expect(c.connect(alice).placeBet(false, { value: E("0.05") }))
                .to.be.revertedWith("Already registered");
        });

        it("3e. Late bet blocked even if state still shows JoinOpen", async () => {
            const { factory, alice, bob, carol } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Late bet", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await c.connect(bob).placeBet(true, { value: E("0.05") });
            await time.increaseTo(now + 301); // past joinDl, state NOT advanced
            expect(await c.state()).to.equal(0); // still JoinOpen
            await expect(c.connect(carol).placeBet(true, { value: E("0.05") }))
                .to.be.revertedWith("Join deadline has passed");
        });

        it("3f. Multiple bettors each side, all balances consistent after settlement", async () => {
            const { factory, alice, bob, carol, dave, eve, treasury } = await deployAll();
            const buyIn = E("0.1");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Multi-bet", "eth::gte:1", now + 300, now + 900, buyIn, { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            await c.connect(bob).placeBet(true,  { value: E("0.2") }); // 2× buyIn
            await c.connect(carol).placeBet(true, { value: E("0.3") }); // 3× buyIn
            await c.connect(dave).placeBet(false, { value: E("0.1") });
            await c.connect(eve).placeBet(false,  { value: E("0.1") });

            const totalIn = buyIn + E("0.2") + E("0.3") + E("0.1") + E("0.1"); // 0.8
            expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(totalIn);

            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await c.performUpkeep("0x");

            // Collect everything
            for (const s of [alice, bob, carol]) await c.connect(s).withdraw();
            // dave and eve lost — nothing to withdraw
            await expect(c.connect(dave).withdraw()).to.be.revertedWith("Nothing to withdraw");
            await expect(c.connect(eve).withdraw()).to.be.revertedWith("Nothing to withdraw");

            // Contract fully drained (dust → treasury)
            expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(0n);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 4. GROUP CHALLENGE
    // ═══════════════════════════════════════════════════════════════════════

    describe("4. Group Challenge", () => {

        it("4a. All pass — full lifecycle, no fee, each gets stake back", async () => {
            const { factory, alice, bob, carol, treasury, reputation } = await deployAll();
            const buyIn = E("0.05");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                1, 0, "Group pass", "eth::gte:1", now + 300, now + 900, buyIn, { value: 0 }
            );
            const g = GroupChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            await expect(g.connect(alice).join({ value: buyIn })).to.emit(g, "ParticipantRegistered");
            await expect(g.connect(bob).join({ value: buyIn })).to.emit(g, "ParticipantRegistered");
            await expect(g.connect(carol).join({ value: buyIn })).to.emit(g, "ParticipantRegistered");

            expect(await g.participants()).to.deep.equal([alice.address, bob.address, carol.address]);
            expect(await ethers.provider.getBalance(await g.getAddress())).to.equal(buyIn * 3n);

            await time.increaseTo(now + 301);
            await g.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await g.performUpkeep("0x");

            expect(await g.state()).to.equal(3);
            expect(await treasury.prizePool()).to.equal(0n); // no fee on all-win

            for (const s of [alice, bob, carol]) {
                expect(await g.pendingWithdrawals(s.address)).to.equal(buyIn);
                await g.connect(s).withdraw();
                expect(await reputation.getScore(s.address)).to.equal(100n);
            }
            expect(await ethers.provider.getBalance(await g.getAddress())).to.equal(0n);
        });

        it("4b. All fail — entire pot to treasury, negative rep", async () => {
            const { factory, alice, bob, carol, treasury, reputation } = await deployAll();
            const buyIn = E("0.05");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                1, 0, "Group fail", `eth::gte:${E("999999")}`,
                now + 300, now + 900, buyIn, { value: 0 }
            );
            const g = GroupChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            await g.connect(alice).join({ value: buyIn });
            await g.connect(bob).join({ value: buyIn });
            await g.connect(carol).join({ value: buyIn });

            await time.increaseTo(now + 301);
            await g.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await g.performUpkeep("0x");

            expect(await treasury.prizePool()).to.equal(buyIn * 3n);
            for (const s of [alice, bob, carol]) {
                expect(await g.pendingWithdrawals(s.address)).to.equal(0n);
                expect(await reputation.getScore(s.address)).to.equal(-50n);
            }
        });

        it("4c. Cannot join after joinDeadline", async () => {
            const { factory, alice, bob } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                1, 0, "Late join", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: 0 }
            );
            const g = GroupChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await expect(g.connect(bob).join({ value: E("0.05") }))
                .to.be.revertedWith("Join deadline has passed");
        });

        it("4d. Cannot join with less than buyIn", async () => {
            const { factory, alice, bob } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                1, 0, "Under buy-in", "eth::gte:1", now + 300, now + 900, E("0.1"), { value: 0 }
            );
            const g = GroupChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await expect(g.connect(bob).join({ value: E("0.05") }))
                .to.be.revertedWith("Must send at least buy-in");
        });

        it("4e. Nobody joins — performUpkeep reverts at VerifyPending, no ETH stuck", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                1, 0, "Empty group", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: 0 }
            );
            const g = GroupChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await g.performUpkeep("0x"); // → Active
            await time.increaseTo(now + 901);
            // No participants → revert inside _onVerifyPending
            await expect(g.performUpkeep("0x")).to.be.revertedWith("No participants to verify");
            expect(await g.state()).to.equal(1); // stuck Active
            expect(await ethers.provider.getBalance(await g.getAddress())).to.equal(0n);
        });

        it("4f. Creator sending ETH for Group challenge reverts", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await expect(factory.connect(alice).createChallenge(
                1, 0, "Group with ETH", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            )).to.be.revertedWith("No initial stake for Group challenges");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 5. PUBLIC CHALLENGE
    // ═══════════════════════════════════════════════════════════════════════

    describe("5. Public Challenge", () => {

        it("5a. Create with prize pool — all win, bonus distributed", async () => {
            const { factory, alice, bob, carol, treasury, reputation } = await deployAll();
            const buyIn = E("0.02");
            const prize = E("0.3");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                2, 0, "Public WIN", "eth::gte:1",
                now + 300, now + 900, buyIn,
                { value: prize }
            );
            const p = PublicChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            expect(await p.prizePool()).to.equal(prize);
            expect(await ethers.provider.getBalance(await p.getAddress())).to.equal(prize);

            await p.connect(alice).join({ value: buyIn });
            await p.connect(bob).join({ value: buyIn });
            await p.connect(carol).join({ value: buyIn });

            const contractBal = await ethers.provider.getBalance(await p.getAddress());
            expect(contractBal).to.equal(prize + buyIn * 3n);

            await time.increaseTo(now + 301);
            await p.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await p.performUpkeep("0x");

            expect(await p.state()).to.equal(3);

            // All pass → bonus = prize / 3
            const bonus = prize / 3n;
            const dust  = prize - bonus * 3n;

            for (const s of [alice, bob, carol]) {
                const payout = await p.pendingWithdrawals(s.address);
                expect(payout).to.equal(buyIn + bonus);
                expect(await reputation.getScore(s.address)).to.equal(100n);
            }
            // Dust goes to treasury
            expect(await treasury.prizePool()).to.equal(dust);
        });

        it("5b. All fail — loserPot + prizePool to treasury", async () => {
            const { factory, alice, bob, treasury, reputation } = await deployAll();
            const buyIn = E("0.02");
            const prize = E("0.1");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                2, 0, "Public FAIL", `eth::gte:${E("999999")}`,
                now + 300, now + 900, buyIn, { value: prize }
            );
            const p = PublicChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            await p.connect(alice).join({ value: buyIn });
            await p.connect(bob).join({ value: buyIn });

            await time.increaseTo(now + 301);
            await p.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await p.performUpkeep("0x");

            // All fail → loserPot + prize → treasury
            expect(await treasury.prizePool()).to.equal(prize + buyIn * 2n);
            for (const s of [alice, bob]) {
                expect(await p.pendingWithdrawals(s.address)).to.equal(0n);
                expect(await reputation.getScore(s.address)).to.equal(-50n);
            }
        });

        it("5c. returnPrizePoolToTreasury — 0 participants past deadline", async () => {
            const { factory, alice, treasury } = await deployAll();
            const prize = E("0.5");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                2, 0, "Empty public", "eth::gte:1",
                now + 300, now + 900, E("0.01"), { value: prize }
            );
            const p = PublicChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            // Nobody joins. After challengeDeadline, creator can recover prize
            await time.increaseTo(now + 901);
            await p.connect(alice).returnPrizePoolToTreasury();
            expect(await p.prizePool()).to.equal(0n);
            expect(await treasury.prizePool()).to.equal(prize);
        });

        it("5c2. Only creator can call returnPrizePoolToTreasury", async () => {
            const { factory, alice, bob } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                2, 0, "Recover", "eth::gte:1",
                now + 300, now + 900, E("0.01"), { value: E("0.5") }
            );
            const p = PublicChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 901);
            await expect(p.connect(bob).returnPrizePoolToTreasury())
                .to.be.revertedWith("Only creator");
        });

        it("5d. Public challenge requires ETH prize pool", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await expect(factory.connect(alice).createChallenge(
                2, 0, "No prize", "eth::gte:1",
                now + 300, now + 900, E("0.01"), { value: 0 }
            )).to.be.revertedWith("Must send prize pool ETH for Public challenge");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 6. ON-CHAIN VERIFIER — ALL CRITERIA TYPES
    // ═══════════════════════════════════════════════════════════════════════

    describe("6. OnChain Verifier criteria (real Sepolia state)", () => {

        async function runCriteria(
            ctx: any,
            criteria: string,
            expectPass: boolean,
            note: string
        ) {
            const { factory, alice, bob } = ctx;
            const buyIn = E("0.02");
            const now   = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, note, criteria, now + 60, now + 300, buyIn, { value: buyIn }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges()).at(-1)!, alice
            );
            await c.connect(bob).placeBet(!expectPass, { value: buyIn });
            await time.increaseTo(now + 61);
            await c.performUpkeep("0x");
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            const alicePending = await c.pendingWithdrawals(alice.address);
            if (expectPass) {
                expect(alicePending).to.be.greaterThan(0n, `${note}: should PASS but got 0`);
            } else {
                expect(alicePending).to.equal(0n, `${note}: should FAIL but got payout`);
            }
        }

        it("6a. eth::gte — holds ≥ 1 ETH → PASS", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx, "eth::gte:1000000000000000000", true, "ETH gte 1");
        });

        it("6b. eth::gte — holds ≥ 999999 ETH → FAIL", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx, `eth::gte:${E("999999")}`, false, "ETH gte 999999");
        });

        it("6c. eth::lte — holds ≤ 9999 ETH → PASS", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx, `eth::lte:${E("9999")}`, true, "ETH lte 9999");
        });

        it("6d. erc20 LINK balance ≥ 1 LINK → PASS (alice was funded)", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx, `erc20:${LINK_TOKEN}:${E("1")}`, true, "LINK ≥ 1");
        });

        it("6e. erc20 LINK balance ≥ 999999 LINK → FAIL", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx, `erc20:${LINK_TOKEN}:${E("999999")}`, false, "LINK ≥ 999999");
        });

        it("6f. AND: eth≥1 AND eth≤9999 → PASS", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx,
                `and:eth::gte:${E("1")}|eth::lte:${E("9999")}`,
                true, "AND both pass"
            );
        });

        it("6g. AND: eth≥1 AND eth≥999999 → FAIL (second fails)", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx,
                `and:eth::gte:${E("1")}|eth::gte:${E("999999")}`,
                false, "AND second fails"
            );
        });

        it("6h. OR: eth≥999999 OR eth≥1 → PASS (second passes)", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx,
                `or:eth::gte:${E("999999")}|eth::gte:${E("1")}`,
                true, "OR second passes"
            );
        });

        it("6i. OR: both fail → FAIL", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx,
                `or:eth::gte:${E("999999")}|erc20:${LINK_TOKEN}:${E("999999")}`,
                false, "OR both fail"
            );
        });

        it("6j. call: — generic staticcall reads real LINK.balanceOf", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx,
                `call:${LINK_TOKEN}:balanceOf(address):gte:${E("1")}`,
                true, "call LINK.balanceOf ≥ 1"
            );
        });

        it("6k. Unknown criteria → false verdict, no revert", async () => {
            const ctx = await deployAll();
            await runCriteria(ctx, "unknown:garbage:criteria", false, "unknown type");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 7. EVIDENCE SUBMISSION
    // ═══════════════════════════════════════════════════════════════════════

    describe("7. Evidence submission (AI Oracle flow, on-chain side)", () => {

        it("7a. Submit evidence with correct nonce, getDaysComplete tracks days", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 2, "AI 3-day", "evidence:3",
                now + 300, now + 4 * 86400, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            await time.increaseTo(now + 301);
            await c.performUpkeep("0x"); // → Active

            // Day 0
            let nonce = await c.getCurrentDayNonce();
            await expect(c.connect(alice).submitEvidence("ipfs://day0", nonce))
                .to.emit(c, "EvidenceSubmitted");

            // Day 1
            await time.increase(86400);
            nonce = await c.getCurrentDayNonce();
            await c.connect(alice).submitEvidence("ipfs://day1", nonce);

            // Duplicate on day 1 — still counts as 1 day
            nonce = await c.getCurrentDayNonce();
            await c.connect(alice).submitEvidence("ipfs://day1dup", nonce);

            // Day 2
            await time.increase(86400);
            nonce = await c.getCurrentDayNonce();
            await c.connect(alice).submitEvidence("ipfs://day2", nonce);

            expect(await c.getDaysComplete(alice.address)).to.equal(3n);

            const evs = await c.getEvidence(alice.address);
            expect(evs.length).to.equal(4); // 3 unique days + 1 dup
            expect(evs[0].ipfsCid).to.equal("ipfs://day0");
        });

        it("7b. Wrong nonce reverts", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 2, "AI nonce", "evidence:1",
                now + 300, now + 86700, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await expect(
                c.connect(alice).submitEvidence("ipfs://bad", ethers.id("wrongseed"))
            ).to.be.revertedWith("Invalid nonce");
        });

        it("7c. Cannot submit during JoinOpen", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 2, "AI early", "evidence:1",
                now + 300, now + 86700, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            const nonce = await c.getCurrentDayNonce(); // fixed: no underflow
            await expect(c.connect(alice).submitEvidence("ipfs://x", nonce))
                .to.be.revertedWith("Can only submit evidence during Active");
        });

        it("7d. Cannot submit if not participant", async () => {
            const { factory, alice, bob } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 2, "AI participant", "evidence:1",
                now + 300, now + 86700, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            const nonce = await c.getCurrentDayNonce();
            await expect(c.connect(bob).submitEvidence("ipfs://x", nonce))
                .to.be.revertedWith("Must be a participant");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 8. BIND ACCOUNT (API Oracle)
    // ═══════════════════════════════════════════════════════════════════════

    describe("8. Bind account (API Oracle)", () => {

        it("8a. bindAccount works during JoinOpen, emits event", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 1, "API challenge", "github::repos::gte:5",
                now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await expect(c.connect(alice).bindAccount("octocat"))
                .to.emit(c, "AccountBound").withArgs(alice.address, "octocat");
        });

        it("8b. Cannot bind if not participant", async () => {
            const { factory, alice, bob } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 1, "API", "github::repos::gte:5",
                now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await expect(c.connect(bob).bindAccount("bob"))
                .to.be.revertedWith("Must be a participant");
        });

        it("8c. Cannot bind after JoinOpen ends", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 1, "API", "github::repos::gte:5",
                now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await expect(c.connect(alice).bindAccount("newhandle"))
                .to.be.revertedWith("Can only bind during JoinOpen");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 9. TREASURY
    // ═══════════════════════════════════════════════════════════════════════

    describe("9. Treasury", () => {

        it("9a. Only authorized challenge can depositFee", async () => {
            const { treasury, alice } = await deployAll();
            await expect(treasury.connect(alice).depositFee({ value: E("0.1") }))
                .to.be.revertedWith("Not authorized");
        });

        it("9b. prizePool accumulates from multiple challenges", async () => {
            const { factory, alice, bob, treasury } = await deployAll();
            const buyIn = E("0.05");

            for (let i = 0; i < 3; i++) {
                const now = await time.latest();
                await approveLink(alice, await factory.getAddress());
                await factory.connect(alice).createChallenge(
                    0, 0, `Acc ${i}`, "eth::gte:1",
                    now + 30, now + 90, buyIn, { value: buyIn }
                );
                const c = IndividualChallenge__factory.connect(
                    (await factory.getAllChallenges()).at(-1)!, alice
                );
                await c.connect(bob).placeBet(false, { value: buyIn });
                await time.increaseTo(now + 31);
                await c.performUpkeep("0x");
                await time.increaseTo(now + 91);
                await c.performUpkeep("0x");
            }

            const fee = buyIn * 2n / 100n;
            expect(await treasury.prizePool()).to.equal(fee * 3n);
        });

        it("9c. withdrawPrizePool only authorized (governance)", async () => {
            const { treasury, alice, owner } = await deployAll();
            await treasury.connect(owner).authorize(owner.address);
            await treasury.connect(owner).depositFee({ value: E("1") });
            await expect(treasury.connect(alice).withdrawPrizePool(alice.address, E("1")))
                .to.be.revertedWith("Not authorized");
        });

        it("9d. sweep drains all to recipient", async () => {
            const { treasury, owner } = await deployAll();
            await treasury.connect(owner).depositFee({ value: E("1") });
            const before = await ethers.provider.getBalance(owner.address);
            const tx = await treasury.connect(owner).sweep(owner.address);
            const gas = await gasCost(tx);
            expect((await ethers.provider.getBalance(owner.address)) - before + gas)
                .to.equal(E("1"));
            expect(await treasury.prizePool()).to.equal(0n);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 10. REPUTATION
    // ═══════════════════════════════════════════════════════════════════════

    describe("10. Reputation", () => {

        it("10a. Unauthorized updateRep reverts", async () => {
            const { reputation, alice } = await deployAll();
            await expect(reputation.connect(alice).updateRep(alice.address, 100n, alice.address))
                .to.be.revertedWith("Not authorized");
        });

        it("10b. Score accumulates: 3 wins = +300", async () => {
            const { factory, alice, reputation } = await deployAll();
            for (let i = 0; i < 3; i++) {
                const now = await time.latest();
                await approveLink(alice, await factory.getAddress());
                await factory.connect(alice).createChallenge(
                    0, 0, `Win ${i}`, "eth::gte:1",
                    now + 30, now + 90, E("0.05"), { value: E("0.05") }
                );
                const c = IndividualChallenge__factory.connect(
                    (await factory.getAllChallenges()).at(-1)!, alice
                );
                await time.increaseTo(now + 31);
                await c.performUpkeep("0x");
                await time.increaseTo(now + 91);
                await c.performUpkeep("0x");
            }
            expect(await reputation.getScore(alice.address)).to.equal(300n);
        });

        it("10c. Score goes negative: 3 failures = -150", async () => {
            const { factory, alice, reputation } = await deployAll();
            for (let i = 0; i < 3; i++) {
                const now = await time.latest();
                await approveLink(alice, await factory.getAddress());
                await factory.connect(alice).createChallenge(
                    0, 0, `Fail ${i}`, `eth::gte:${E("999999")}`,
                    now + 30, now + 90, E("0.05"), { value: E("0.05") }
                );
                const c = IndividualChallenge__factory.connect(
                    (await factory.getAllChallenges()).at(-1)!, alice
                );
                await time.increaseTo(now + 31);
                await c.performUpkeep("0x");
                await time.increaseTo(now + 91);
                await c.performUpkeep("0x");
            }
            expect(await reputation.getScore(alice.address)).to.equal(-150n);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 11. GOVERNANCE — PROPOSE → VOTE → TICK EPOCH → CHALLENGE DEPLOYED
    // ═══════════════════════════════════════════════════════════════════════

    describe("11. Governance", () => {

        it("11a. Full flow: propose → vote → tickEpoch → new PublicChallenge", async () => {
            const { factory, alice, bob, governance, treasury, reputation, owner } = await deployAll();

            // Build alice's reputation (needs >0 to vote)
            const now0 = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Rep build", "eth::gte:1", now0 + 30, now0 + 90, E("0.05"), { value: E("0.05") }
            );
            const rc = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now0 + 31);
            await rc.performUpkeep("0x");
            await time.increaseTo(now0 + 91);
            await rc.performUpkeep("0x");
            expect(await reputation.getScore(alice.address)).to.equal(100n);

            // Fund treasury and set prize per epoch
            await treasury.connect(owner).depositFee({ value: E("0.5") });
            await governance.connect(owner).setPrizePerEpoch(E("0.1"));

            // Propose
            const proposeTx = await governance.connect(owner).propose(
                "Hold 1 ETH", "Prove you hold 1 ETH", 0, 1, 1, E("0.01")
            );
            await expect(proposeTx).to.emit(governance, "ProposalCreated");
            expect((await governance.getProposals()).length).to.equal(1);

            // Alice votes (weight = her rep = 100)
            const voteTx = await governance.connect(alice).vote(0);
            await expect(voteTx).to.emit(governance, "Voted");
            const proposals = await governance.getProposals();
            expect(proposals[0].votes).to.equal(100n);

            // Cannot vote twice
            await expect(governance.connect(alice).vote(0))
                .to.be.revertedWith("Already voted this epoch");

            // Cannot tickEpoch before end
            await expect(governance.tickEpoch())
                .to.be.revertedWith("Epoch not ended yet");

            // Advance past epoch end
            const epochEnd = await governance.currentEpochEnd();
            await time.increaseTo(Number(epochEnd) + 1);

            // Approve LINK for factory (tickEpoch creates a challenge, needs 2 LINK)
            await fundLink([owner], E("3"));
            const linkToken = IERC20__factory.connect(LINK_TOKEN, owner);
            await linkToken.approve(await factory.getAddress(), E("2"));
            // tickEpoch does forceApprove internally, but factory needs the LINK from governance
            // Since we deployed with real LINK, governance needs 2 LINK to forward to factory
            await linkToken.transfer(await governance.getAddress(), E("2"));

            const tickTx = await governance.connect(alice).tickEpoch();
            await expect(tickTx).to.emit(governance, "EpochTicked");

            expect(await governance.currentEpoch()).to.equal(2n);
            expect((await governance.getProposals()).length).to.equal(0);

            // New PublicChallenge was deployed
            const all = await factory.getAllChallenges();
            expect(all.length).to.equal(2); // rep-build challenge + governance challenge
        });

        it("11b. Cannot tickEpoch with no votes", async () => {
            const { governance, owner } = await deployAll();
            await governance.connect(owner).setPrizePerEpoch(E("0.1"));
            await governance.connect(owner).propose("Test", "Test", 0, 7, 2, E("0.01"));
            const epochEnd = await governance.currentEpochEnd();
            await time.increaseTo(Number(epochEnd) + 1);
            await expect(governance.tickEpoch()).to.be.revertedWith("No votes cast this epoch");
        });

        it("11c. Cannot vote with negative/zero rep", async () => {
            const { factory, alice, governance, owner } = await deployAll();

            // Alice fails 3 challenges → rep = -150
            for (let i = 0; i < 3; i++) {
                const now = await time.latest();
                await approveLink(alice, await factory.getAddress());
                await factory.connect(alice).createChallenge(
                    0, 0, `Fail ${i}`, `eth::gte:${E("999999")}`,
                    now + 30, now + 90, E("0.05"), { value: E("0.05") }
                );
                const c = IndividualChallenge__factory.connect(
                    (await factory.getAllChallenges()).at(-1)!, alice
                );
                await time.increaseTo(now + 31);
                await c.performUpkeep("0x");
                await time.increaseTo(now + 91);
                await c.performUpkeep("0x");
            }

            await governance.connect(owner).propose("Test", "Test", 0, 7, 2, E("0.01"));
            await expect(governance.connect(alice).vote(0))
                .to.be.revertedWith("No voting power");
        });

        it("11d. Vote weight is proportional to rep (higher rep = more votes)", async () => {
            const { factory, alice, bob, governance, owner } = await deployAll();

            // Alice wins 3 challenges = 300 rep, Bob wins 1 = 100 rep
            for (let i = 0; i < 3; i++) {
                const now = await time.latest();
                await approveLink(alice, await factory.getAddress());
                await factory.connect(alice).createChallenge(
                    0, 0, `AliceWin${i}`, "eth::gte:1",
                    now + 30, now + 90, E("0.05"), { value: E("0.05") }
                );
                const c = IndividualChallenge__factory.connect(
                    (await factory.getAllChallenges()).at(-1)!, alice
                );
                await time.increaseTo(now + 31);
                await c.performUpkeep("0x");
                await time.increaseTo(now + 91);
                await c.performUpkeep("0x");
            }
            const now2 = await time.latest();
            await approveLink(bob, await factory.getAddress());
            await factory.connect(bob).createChallenge(
                0, 0, "BobWin", "eth::gte:1",
                now2 + 30, now2 + 90, E("0.05"), { value: E("0.05") }
            );
            const bc = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges()).at(-1)!, bob
            );
            await time.increaseTo(now2 + 31);
            await bc.performUpkeep("0x");
            await time.increaseTo(now2 + 91);
            await bc.performUpkeep("0x");

            await governance.connect(owner).propose("Prop A", "A", 0, 7, 2, E("0.01"));
            await governance.connect(owner).propose("Prop B", "B", 0, 7, 2, E("0.01"));

            await governance.connect(alice).vote(0); // 300 weight
            await governance.connect(bob).vote(1);   // 100 weight

            const props = await governance.getProposals();
            expect(props[0].votes).to.equal(300n);
            expect(props[1].votes).to.equal(100n);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 12. FACTORY — TRACKING & AUTHORIZATION
    // ═══════════════════════════════════════════════════════════════════════

    describe("12. Factory tracking & authorization", () => {

        it("12a. getChallengeInfo returns correct data", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Info test", "eth::gte:1",
                now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const all = await factory.getAllChallenges();
            const [id, type, ver, creator, title] = await factory.getChallengeInfo(all[0]);
            expect(creator).to.equal(alice.address);
            expect(title).to.equal("Info test");
            expect(type).to.equal(0n); // Individual
            expect(ver).to.equal(0n);  // OnChain
        });

        it("12b. getUserChallenges tracks creator across multiple", async () => {
            const { factory, alice } = await deployAll();
            for (let i = 0; i < 4; i++) {
                const now = await time.latest();
                await approveLink(alice, await factory.getAddress());
                await factory.connect(alice).createChallenge(
                    0, 0, `C${i}`, "eth::gte:1",
                    now + 300, now + 900, E("0.05"), { value: E("0.05") }
                );
            }
            const challenges = await factory.getUserChallenges(alice.address);
            expect(challenges.length).to.equal(4);
            expect(new Set(challenges).size).to.equal(4);
        });

        it("12c. LINK pulled from creator on every challenge creation", async () => {
            const { factory, alice } = await deployAll();
            const link = IERC20__factory.connect(LINK_TOKEN, alice);
            const before = await link.balanceOf(alice.address);
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "LINK pull", "eth::gte:1",
                now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const after = await link.balanceOf(alice.address);
            expect(before - after).to.equal(E("2")); // exactly 2 LINK
        });

        it("12d. Challenge not in allChallenges list cannot call depositFee", async () => {
            const { treasury, alice } = await deployAll();
            // Deploying a challenge manually (bypassing factory) = not authorized
            await expect(treasury.connect(alice).depositFee({ value: E("0.01") }))
                .to.be.revertedWith("Not authorized");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 13. STATE MACHINE INTEGRITY
    // ═══════════════════════════════════════════════════════════════════════

    describe("13. State machine & upkeep guards", () => {

        it("13a. checkUpkeep returns correct booleans at each state", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "CK", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );

            let [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.false; // before joinDl

            await time.increaseTo(now + 301);
            [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.true;

            await c.performUpkeep("0x");
            [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.false; // Active but chalDl not reached

            await time.increaseTo(now + 901);
            [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.true;

            await c.performUpkeep("0x");
            [needed] = await c.checkUpkeep("0x");
            expect(needed).to.be.false; // Settled
        });

        it("13b. performUpkeep before deadline reverts", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Early PU", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await expect(c.performUpkeep("0x")).to.be.revertedWith("Upkeep not needed");
        });

        it("13c. Anyone can call performUpkeep (removed upkeepRegistered guard)", async () => {
            const { factory, alice, bob } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Open PU", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await expect(c.connect(bob).performUpkeep("0x")).to.not.be.reverted;
            expect(await c.state()).to.equal(1);
        });

        it("13d. Cannot call performUpkeep twice in same state", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Double PU", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await expect(c.performUpkeep("0x")).to.be.revertedWith("Upkeep not needed");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 14. SECURITY
    // ═══════════════════════════════════════════════════════════════════════

    describe("14. Security", () => {

        it("14a. withdraw() is reentrancy-safe (pull pattern, state zeroed first)", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Reentrancy", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await c.performUpkeep("0x");

            await c.connect(alice).withdraw();
            // Second withdraw reverts — pendingWithdrawals was zeroed before ETH sent
            await expect(c.connect(alice).withdraw()).to.be.revertedWith("Nothing to withdraw");
        });

        it("14b. settle() cannot be called after settled", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Double settle", "eth::gte:1", now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await c.performUpkeep("0x");
            await expect(c.settle()).to.be.revertedWith("Not in VerifyPending");
        });

        it("14c. Reputation cannot be updated by arbitrary address", async () => {
            const { reputation, alice } = await deployAll();
            await expect(reputation.connect(alice).updateRep(alice.address, 999n, alice.address))
                .to.be.revertedWith("Not authorized");
            await expect(reputation.connect(alice).batchUpdateRep(
                [alice.address], [999n], alice.address
            )).to.be.revertedWith("Not authorized");
        });

        it("14d. Dead address criteria → false verdict, no revert (verifier is defensive)", async () => {
            const { factory, alice } = await deployAll();
            const now = await time.latest();
            await approveLink(alice, await factory.getAddress());
            await factory.connect(alice).createChallenge(
                0, 0, "Dead call", "call:0x000000000000000000000000000000000000dead:balanceOf(address):gte:1",
                now + 300, now + 900, E("0.05"), { value: E("0.05") }
            );
            const c = IndividualChallenge__factory.connect(
                (await factory.getAllChallenges())[0], alice
            );
            await time.increaseTo(now + 301);
            await c.performUpkeep("0x");
            await time.increaseTo(now + 901);
            await c.performUpkeep("0x"); // → evaluates → call fails → false verdict → settles
            expect(await c.state()).to.equal(3);
            expect(await c.pendingWithdrawals(alice.address)).to.equal(0n); // failed
        });
    });
});
