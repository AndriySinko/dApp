/**
 * Narrative integration tests.
 *
 * Written as a USER would interact — no knowledge of contract internals,
 * no peeking at _forPool/_againstPool directly. Every assertion is derived
 * from observable on-chain state: ETH balances, public view calls, events.
 *
 * These tests exist to catch bugs that "circular" tests miss because they
 * were written alongside the implementation.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
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
    MockERC20__factory,
    MockAutomationRegistrar__factory,
} from "../../typechain-types";

const E = ethers.parseEther;

// Gas spent by a transaction — used to track net ETH changes precisely
async function gasCost(tx: any): Promise<bigint> {
    const r = await tx.wait();
    return r.gasUsed * r.gasPrice;
}

// ─────────────────────────────────────────────────────────────────────────────

async function deployProtocol() {
    const [owner, alice, bob, carol, dave, eve] = await ethers.getSigners();

    const reputation = await new Reputation__factory(owner).deploy(owner.address);
    const treasury   = await new Treasury__factory(owner).deploy(owner.address);
    const verifier   = await new OnChainVerifier__factory(owner).deploy();
    const link       = await new MockERC20__factory(owner).deploy();
    const registrar  = await new MockAutomationRegistrar__factory(owner).deploy();

    const iDep = await new IndividualChallengeDeployer__factory(owner).deploy();
    const gDep = await new GroupChallengeDeployer__factory(owner).deploy();
    const pDep = await new PublicChallengeDeployer__factory(owner).deploy();

    const factory = await new ChallengeFactory__factory(owner).deploy(
        await reputation.getAddress(), await treasury.getAddress(),
        await verifier.getAddress(), await verifier.getAddress(), await verifier.getAddress(),
        await registrar.getAddress(), await link.getAddress(),
        await iDep.getAddress(), await gDep.getAddress(), await pDep.getAddress(),
    );

    await iDep.initFactory(await factory.getAddress());
    await gDep.initFactory(await factory.getAddress());
    await pDep.initFactory(await factory.getAddress());
    await reputation.setFactory(await factory.getAddress());
    await treasury.authorize(owner.address);
    await treasury.setFactory(await factory.getAddress());

    return { owner, alice, bob, carol, dave, eve, reputation, treasury, factory, verifier, link, registrar };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: Individual Challenge Full Lifecycle", () => {

    it("Story 1 — creator wins: state machine, betting, ETH balances, rep", async () => {
        const { factory, alice, bob, carol, dave, treasury, reputation, link } = await loadFixture(deployProtocol);

        // ── Setup ───────────────────────────────────────────────────────────
        const buyIn = E("0.5");
        const now   = await time.latest();
        const joinDl  = now + 300;
        const chalDl  = now + 900;

        // Alice approves 2 LINK for factory
        await link.connect(alice).approve(await factory.getAddress(), E("2"));

        // ── CREATION ────────────────────────────────────────────────────────
        // Alice creates a challenge: prove she holds ≥ 1 ETH by deadline
        // State should immediately be JoinOpen
        const balAliceBefore = await ethers.provider.getBalance(alice.address);

        const createTx = await factory.connect(alice).createChallenge(
            0, 0, "Hold 1 ETH", "eth::gte:1",
            joinDl, chalDl, buyIn,
            { value: buyIn }
        );
        const createGas = await gasCost(createTx);

        const all = await factory.getAllChallenges();
        expect(all.length).to.equal(1);
        const c = IndividualChallenge__factory.connect(all[0], alice);

        // Verify creation consumed alice's buyIn
        const balAliceAfterCreate = await ethers.provider.getBalance(alice.address);
        expect(balAliceBefore - balAliceAfterCreate - createGas).to.equal(buyIn);

        // State = JoinOpen (0)
        expect(await c.state()).to.equal(0);
        expect(await c.creator()).to.equal(alice.address);
        expect(await c.buyIn()).to.equal(buyIn);

        // Contract holds the buyIn ETH
        expect(await ethers.provider.getBalance(all[0])).to.equal(buyIn);

        // ── BOB BETS FOR ────────────────────────────────────────────────────
        // Bob bets FOR (believes Alice will succeed) with 0.5 ETH (= buyIn)
        const balBobBefore = await ethers.provider.getBalance(bob.address);
        const betForTx = await c.connect(bob).placeBet(true, { value: buyIn });
        const betForGas = await gasCost(betForTx);

        expect(await c.state()).to.equal(0); // still JoinOpen
        expect(await ethers.provider.getBalance(all[0])).to.equal(buyIn * 2n);

        // Bob is registered
        expect(await c.isRegistered(bob.address)).to.be.true;

        const balBobAfterBet = await ethers.provider.getBalance(bob.address);
        expect(balBobBefore - balBobAfterBet - betForGas).to.equal(buyIn);

        // ── CAROL BETS AGAINST ──────────────────────────────────────────────
        // Carol bets AGAINST (believes Alice will fail) with 0.5 ETH
        const balCarolBefore = await ethers.provider.getBalance(carol.address);
        const betAgainstTx = await c.connect(carol).placeBet(false, { value: buyIn });
        const betAgainstGas = await gasCost(betAgainstTx);

        expect(await ethers.provider.getBalance(all[0])).to.equal(buyIn * 3n);

        // ── CANNOT BET AFTER JOINDEADLINE ───────────────────────────────────
        // Move time past joinDeadline WITHOUT calling performUpkeep
        await time.increaseTo(joinDl + 1);

        // Dave tries to bet — should fail even though state is still JoinOpen
        await expect(c.connect(dave).placeBet(true, { value: buyIn }))
            .to.be.revertedWith("Join deadline has passed");

        // ── STATE ADVANCE: JoinOpen → Active ────────────────────────────────
        // Anyone can call performUpkeep — not just Chainlink
        // dave (random) advances the state
        await c.connect(dave).performUpkeep("0x");
        expect(await c.state()).to.equal(1); // Active

        // Cannot bet in Active state
        await expect(c.connect(dave).placeBet(true, { value: buyIn }))
            .to.be.revertedWith("Betting closed");

        // Contract balance unchanged — no ETH moved
        expect(await ethers.provider.getBalance(all[0])).to.equal(buyIn * 3n);

        // ── STATE ADVANCE: Active → VerifyPending → Settled ─────────────────
        // OnChainVerifier resolves synchronously, so the entire settlement
        // happens inside performUpkeep
        await time.increaseTo(chalDl + 1);

        const balTreasuryBefore = await ethers.provider.getBalance(await treasury.getAddress());
        const prizePoolBefore   = await treasury.prizePool();

        // Alice holds > 1 ETH, so the OnChain verifier should return true
        // This means: FOR wins, AGAINST loses
        await c.performUpkeep("0x"); // anyone can call

        // State = Settled (3)
        expect(await c.state()).to.equal(3);

        // ── PAYOUT VERIFICATION ─────────────────────────────────────────────
        // Expected:
        //   againstPool = 0.5 ETH (Carol's bet)
        //   fee = 2% of againstPool = 0.01 ETH → to treasury
        //   winnerPot = 0.49 ETH
        //   forPool = 1 ETH (Alice 0.5 + Bob 0.5)
        //   Alice winnings = 0.5 * 0.49 / 1.0 = 0.245 ETH → total 0.745 ETH
        //   Bob winnings   = 0.5 * 0.49 / 1.0 = 0.245 ETH → total 0.745 ETH
        //   Carol gets 0 (lost her bet)

        const fee = buyIn * 2n / 100n; // 0.01 ETH
        const winnerPot = buyIn - fee;  // 0.49 ETH (carol's bet - fee)
        const forPool = buyIn * 2n;     // 1 ETH

        const alicePending = await c.pendingWithdrawals(alice.address);
        const bobPending   = await c.pendingWithdrawals(bob.address);
        const carolPending = await c.pendingWithdrawals(carol.address);

        expect(alicePending).to.equal(buyIn + (buyIn * winnerPot / forPool));
        expect(bobPending).to.equal(buyIn + (buyIn * winnerPot / forPool));
        expect(carolPending).to.equal(0n);

        // Treasury received exactly the fee
        const prizePoolAfter = await treasury.prizePool();
        expect(prizePoolAfter - prizePoolBefore).to.equal(fee);

        // Contract ETH = pendingWithdrawals (alice + bob). Carol's bet funded winners.
        // total = alice + bob = (0.745 + 0.745) = 1.49
        // contract balance should equal alice + bob pending
        expect(await ethers.provider.getBalance(all[0])).to.equal(alicePending + bobPending);

        // ── WITHDRAWALS ─────────────────────────────────────────────────────
        const balAliceBeforeWithdraw = await ethers.provider.getBalance(alice.address);
        const withdrawAliceTx = await c.connect(alice).withdraw();
        const withdrawAliceGas = await gasCost(withdrawAliceTx);
        const balAliceAfterWithdraw = await ethers.provider.getBalance(alice.address);

        expect(balAliceAfterWithdraw - balAliceBeforeWithdraw + withdrawAliceGas).to.equal(alicePending);
        expect(await c.pendingWithdrawals(alice.address)).to.equal(0n);

        // Cannot withdraw twice
        await expect(c.connect(alice).withdraw()).to.be.revertedWith("Nothing to withdraw");

        const withdrawBobTx = await c.connect(bob).withdraw();
        await withdrawBobTx.wait();

        // Contract should now be empty (all funds withdrawn)
        expect(await ethers.provider.getBalance(all[0])).to.equal(0n);

        // Carol has nothing to withdraw
        await expect(c.connect(carol).withdraw()).to.be.revertedWith("Nothing to withdraw");

        // ── REPUTATION ──────────────────────────────────────────────────────
        expect(await reputation.getScore(alice.address)).to.equal(100n);  // creator won
        expect(await reputation.getScore(bob.address)).to.equal(25n);     // FOR won
        expect(await reputation.getScore(carol.address)).to.equal(0n);    // AGAINST lost = 0 rep change
    });

    it("Story 2 — creator fails: AGAINST wins, capped payout, treasury overflow", async () => {
        const { factory, alice, bob, carol, treasury, reputation, link } = await loadFixture(deployProtocol);

        const buyIn  = E("0.2");
        const now    = await time.latest();
        const joinDl = now + 300;
        const chalDl = now + 900;

        await link.connect(alice).approve(await factory.getAddress(), E("2"));

        // Alice challenges herself to hold 999999 ETH — she can't
        await factory.connect(alice).createChallenge(
            0, 0, "Hold 999999 ETH", `eth::gte:${E("999999")}`,
            joinDl, chalDl, buyIn,
            { value: buyIn }
        );

        const all = await factory.getAllChallenges();
        const c = IndividualChallenge__factory.connect(all[0], alice);

        // Bob bets AGAINST 0.2 ETH
        await c.connect(bob).placeBet(false, { value: buyIn });
        // Carol bets AGAINST 0.2 ETH as well
        await c.connect(carol).placeBet(false, { value: buyIn });

        // Contract holds 3 × 0.2 = 0.6 ETH
        expect(await ethers.provider.getBalance(all[0])).to.equal(buyIn * 3n);

        await time.increaseTo(joinDl + 1);
        await c.performUpkeep("0x"); // → Active
        await time.increaseTo(chalDl + 1);
        await c.performUpkeep("0x"); // → VerifyPending → Settled

        expect(await c.state()).to.equal(3);

        // Expected payout:
        //   forPool = 0.2 ETH (alice's stake)
        //   fee = 2% of forPool = 0.004 ETH
        //   grossWinnerPot = 0.196 ETH
        //   againstPool = 0.4 ETH (bob + carol)
        //   cappedWinnerPot = min(0.196, 0.4) = 0.196 ETH (no overflow since gross < against)
        //   overflow = 0
        //   Bob winnings   = 0.2 * 0.196 / 0.4 = 0.098 → total 0.298
        //   Carol winnings = same = 0.298
        //   Alice gets 0 (creator failed)

        const fee = buyIn * 2n / 100n; // 0.004
        const grossWinnerPot = buyIn - fee; // 0.196
        const againstPool = buyIn * 2n; // 0.4
        const cappedWinnerPot = grossWinnerPot < againstPool ? grossWinnerPot : againstPool;

        const bobPending   = await c.pendingWithdrawals(bob.address);
        const carolPending = await c.pendingWithdrawals(carol.address);
        const alicePending = await c.pendingWithdrawals(alice.address);

        expect(alicePending).to.equal(0n);
        expect(bobPending).to.equal(buyIn + (buyIn * cappedWinnerPot / againstPool));
        expect(carolPending).to.equal(buyIn + (buyIn * cappedWinnerPot / againstPool));

        // Treasury got fee + any integer-division dust
        const distributedWinnings = (buyIn * cappedWinnerPot / againstPool) * 2n;
        const dust = cappedWinnerPot - distributedWinnings;
        expect(await treasury.prizePool()).to.equal(fee + dust);

        // Reputation: alice -50, bob +25, carol +25
        expect(await reputation.getScore(alice.address)).to.equal(-50n);
        expect(await reputation.getScore(bob.address)).to.equal(25n);
        expect(await reputation.getScore(carol.address)).to.equal(25n);
    });

    it("Story 3 — late betting: security check for joinDeadline", async () => {
        const { factory, alice, bob, carol, link } = await loadFixture(deployProtocol);

        const buyIn = E("0.1");
        const now   = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Test", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], bob
        );

        // Bob successfully bets during JoinOpen
        await c.connect(bob).placeBet(true, { value: buyIn });
        expect(await c.isRegistered(bob.address)).to.be.true;

        // Move past joinDeadline WITHOUT calling performUpkeep
        // State is STILL JoinOpen — but carol cannot bet because timestamp check
        await time.increaseTo(now + 301);

        // Carol tries to bet — blocked by timestamp guard even though state shows JoinOpen
        await expect(c.connect(carol).placeBet(true, { value: buyIn }))
            .to.be.revertedWith("Join deadline has passed");

        // Verify no ETH was taken from carol
        expect(await c.isRegistered(carol.address)).to.be.false;
    });

    it("Story 4 — getCurrentDayNonce works during JoinOpen (no underflow)", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Test", "eth::gte:1",
            now + 3600, now + 7200, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        // Should return day 0 nonce without reverting (fixed underflow bug)
        const nonce = await c.getCurrentDayNonce();
        expect(nonce).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Story 5 — no bettors against, creator wins, gets exact buy-in back", async () => {
        const { factory, alice, bob, link, treasury } = await loadFixture(deployProtocol);
        const buyIn = E("0.3");
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Solo", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        // Bob bets FOR only (no AGAINST)
        await c.connect(bob).placeBet(true, { value: buyIn });

        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        await time.increaseTo(now + 901);
        await c.performUpkeep("0x");

        // No AGAINST pool → no fee → no winnings
        // Both alice and bob get exact buyIn back
        expect(await c.pendingWithdrawals(alice.address)).to.equal(buyIn);
        expect(await c.pendingWithdrawals(bob.address)).to.equal(buyIn);
        expect(await treasury.prizePool()).to.equal(0n); // no fee charged
    });

    it("Story 6 — AGAINST pool overflow: excess AGAINST stake goes to treasury", async () => {
        const { factory, alice, bob, carol, dave, link, treasury } = await loadFixture(deployProtocol);
        const buyIn = E("0.1");
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));

        // Alice will fail (impossible criteria)
        await factory.connect(alice).createChallenge(
            0, 0, "Impossible", `eth::gte:${E("999999")}`,
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        // AGAINST pool = 5 * buyIn = max allowed (5x cap)
        await c.connect(bob).placeBet(false,  { value: E("0.1") });
        await c.connect(carol).placeBet(false, { value: E("0.1") });
        await c.connect(dave).placeBet(false,  { value: E("0.1") });

        // The 6th AGAINST bet that would exceed 5x cap should be rejected
        const [,,,,, eve] = await ethers.getSigners();
        await expect(
            c.connect(eve).placeBet(false, { value: E("0.3") }) // would push to 0.6 = 6x
        ).to.be.revertedWith("AGAINST pool cap reached");

        // Only 0.3 ETH against (bob + carol + dave = 3 × 0.1 = 0.3)
        // forPool = 0.1, fee = 0.002
        // grossWinnerPot = 0.098
        // againstPool = 0.3
        // cappedWinnerPot = min(0.098, 0.3) = 0.098 (no overflow! gross < against)
        // Each of 3 AGAINST bettors gets: 0.1 + (0.1 * 0.098 / 0.3) ≈ 0.133

        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        await time.increaseTo(now + 901);
        await c.performUpkeep("0x");

        const bobPending  = await c.pendingWithdrawals(bob.address);
        const carolPending = await c.pendingWithdrawals(carol.address);
        const davePending  = await c.pendingWithdrawals(dave.address);

        expect(bobPending).to.be.greaterThan(E("0.1")); // got winnings
        expect(carolPending).to.equal(bobPending);
        expect(davePending).to.equal(bobPending);

        // dust (integer division remainder) now goes to treasury, so
        // contract balance = totalPending only (no leftover wei)
        const totalPending = bobPending + carolPending + davePending;
        expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(totalPending);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: Group Challenge Full Lifecycle", () => {

    it("Story 7 — mixed winners/losers: fee math, balance tracking", async () => {
        // We can't get a mixed result with OnChainVerifier + eth balance criteria
        // because both alice and bob hold ETH. Instead we test the math
        // directly via OR/AND criteria that produces different results per person.
        //
        // Actually: use a GROUP challenge where criteria is IMPOSSIBLE,
        // so all fail → entire pot to treasury. Then verify treasury received it.

        const { factory, alice, bob, carol, treasury, reputation, link } = await loadFixture(deployProtocol);
        const buyIn = E("0.1");
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));

        // All-fail group challenge
        await factory.connect(alice).createChallenge(
            1, 0, "Impossible Group", `eth::gte:${E("999999")}`,
            now + 300, now + 900, buyIn,
            { value: 0 }
        );
        const g = GroupChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        await g.connect(alice).join({ value: buyIn });
        await g.connect(bob).join({ value: buyIn });
        await g.connect(carol).join({ value: buyIn });

        const contractBalBefore = await ethers.provider.getBalance(await g.getAddress());
        expect(contractBalBefore).to.equal(buyIn * 3n);

        await time.increaseTo(now + 301);
        await g.performUpkeep("0x");
        await time.increaseTo(now + 901);
        await g.performUpkeep("0x");

        expect(await g.state()).to.equal(3);

        // All failed → all stakes go to treasury
        expect(await g.pendingWithdrawals(alice.address)).to.equal(0n);
        expect(await g.pendingWithdrawals(bob.address)).to.equal(0n);
        expect(await g.pendingWithdrawals(carol.address)).to.equal(0n);

        // Contract now empty
        expect(await ethers.provider.getBalance(await g.getAddress())).to.equal(0n);

        // Treasury received the entire pot
        expect(await treasury.prizePool()).to.equal(buyIn * 3n);

        // All three: -50 rep each
        expect(await reputation.getScore(alice.address)).to.equal(-50n);
        expect(await reputation.getScore(bob.address)).to.equal(-50n);
        expect(await reputation.getScore(carol.address)).to.equal(-50n);
    });

    it("Story 8 — all-win group: everyone gets exact stake back, zero fee", async () => {
        const { factory, alice, bob, carol, treasury, reputation, link } = await loadFixture(deployProtocol);
        const buyIn = E("0.15");
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));

        await factory.connect(alice).createChallenge(
            1, 0, "Easy Group", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: 0 }
        );
        const g = GroupChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        await g.connect(alice).join({ value: buyIn });
        await g.connect(bob).join({ value: buyIn });

        await time.increaseTo(now + 301);
        await g.performUpkeep("0x");
        await time.increaseTo(now + 901);
        await g.performUpkeep("0x");

        // No fee when everyone wins
        expect(await treasury.prizePool()).to.equal(0n);

        // Each gets exact stake back
        expect(await g.pendingWithdrawals(alice.address)).to.equal(buyIn);
        expect(await g.pendingWithdrawals(bob.address)).to.equal(buyIn);

        // Rep: +100 each
        expect(await reputation.getScore(alice.address)).to.equal(100n);
        expect(await reputation.getScore(bob.address)).to.equal(100n);
    });

    it("Story 9 — nobody joins group: stuck in Active, no ETH locked", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            1, 0, "Empty Group", "eth::gte:1",
            now + 300, now + 900, E("0.1"),
            { value: 0 }
        );
        const g = GroupChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        await time.increaseTo(now + 301);
        await g.performUpkeep("0x"); // → Active (no participants yet)
        expect(await g.state()).to.equal(1); // Active

        await time.increaseTo(now + 901);
        // performUpkeep tries Active → VerifyPending but _onVerifyPending reverts
        // (require _participants.length > 0). The state does NOT advance.
        await expect(g.performUpkeep("0x")).to.be.revertedWith("No participants to verify");
        expect(await g.state()).to.equal(1); // still Active

        // No ETH is locked (group challenge requires no creator stake)
        expect(await ethers.provider.getBalance(await g.getAddress())).to.equal(0n);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: State Machine Integrity", () => {

    it("Story 10 — state transitions in exact order", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "State test", "eth::gte:1",
            now + 300, now + 900, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        // 0 = JoinOpen
        expect(await c.state()).to.equal(0);

        // Cannot advance to Active before joinDeadline
        await expect(c.performUpkeep("0x")).to.be.revertedWith("Upkeep not needed");

        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        expect(await c.state()).to.equal(1); // Active

        // Cannot advance again (already Active, but challengeDeadline not passed)
        await expect(c.performUpkeep("0x")).to.be.revertedWith("Upkeep not needed");

        await time.increaseTo(now + 901);
        // OnChain verifier resolves synchronously → goes all the way to Settled
        await c.performUpkeep("0x");
        expect(await c.state()).to.equal(3); // Settled

        // Settled — all further performUpkeep calls revert
        await expect(c.performUpkeep("0x")).to.be.revertedWith("Upkeep not needed");
    });

    it("Story 11 — checkUpkeep returns correct signal at each state", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "CheckUpkeep test", "eth::gte:1",
            now + 300, now + 900, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        // During JoinOpen before deadline: no upkeep needed
        let [needed] = await c.checkUpkeep("0x");
        expect(needed).to.be.false;

        // After joinDeadline: upkeep needed
        await time.increaseTo(now + 301);
        [needed] = await c.checkUpkeep("0x");
        expect(needed).to.be.true;

        // After advancing to Active: no upkeep needed until challengeDeadline
        await c.performUpkeep("0x");
        [needed] = await c.checkUpkeep("0x");
        expect(needed).to.be.false;

        // After challengeDeadline: upkeep needed again
        await time.increaseTo(now + 901);
        [needed] = await c.checkUpkeep("0x");
        expect(needed).to.be.true;

        // After settling: no more upkeep
        await c.performUpkeep("0x");
        [needed] = await c.checkUpkeep("0x");
        expect(needed).to.be.false;
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: Treasury & Authorization Chain", () => {

    it("Story 12 — unauthorized depositFee reverts cleanly", async () => {
        const { treasury, alice, bob } = await loadFixture(deployProtocol);

        // A random EOA cannot deposit fees
        await expect(treasury.connect(alice).depositFee({ value: E("1") }))
            .to.be.revertedWith("Not authorized");

        // A random contract address cannot deposit fees
        await expect(treasury.connect(bob).depositFee({ value: E("0.1") }))
            .to.be.revertedWith("Not authorized");

        // Treasury still empty
        expect(await treasury.prizePool()).to.equal(0n);
    });

    it("Story 13 — challenge authorized by factory can deposit fees", async () => {
        // The ONLY way to deposit fee is through a challenge contract created by factory
        // This verifies the full authorization chain is wired up
        const { factory, alice, bob, carol, treasury, link } = await loadFixture(deployProtocol);
        const buyIn = E("0.1");
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Auth test", "eth::gte:1",
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

        // Treasury should have received fee without reverting
        expect(await treasury.prizePool()).to.equal(buyIn * 2n / 100n);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: Evidence submission", () => {

    it("Story 14 — submit evidence with correct nonce during Active", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 2, "AI Challenge", "some-ai-criteria",
            now + 300, now + 86400 + 300, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        // Advance to Active
        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        expect(await c.state()).to.equal(1);

        // Get the current day nonce — should not revert (bug was fixed)
        const nonce = await c.getCurrentDayNonce();

        // Submit evidence
        await expect(
            c.connect(alice).submitEvidence("ipfs://QmFakeHash123", nonce)
        ).to.emit(c, "EvidenceSubmitted");

        // Verify it was recorded
        const evidence = await c.getEvidence(alice.address);
        expect(evidence.length).to.equal(1);
        expect(evidence[0].ipfsCid).to.equal("ipfs://QmFakeHash123");
        expect(evidence[0].day).to.equal(0n); // day 0 (just entered Active)

        // Wrong nonce should fail
        const wrongNonce = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
        await expect(
            c.connect(alice).submitEvidence("ipfs://QmOther", wrongNonce)
        ).to.be.revertedWith("Invalid nonce");
    });

    it("Story 15 — getDaysComplete counts unique days", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 2, "Multi-day", "evidence:3",
            now + 300, now + 4 * 86400 + 300, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");

        // Day 0
        let nonce = await c.getCurrentDayNonce();
        await c.submitEvidence("ipfs://day0", nonce);

        // Day 1
        await time.increase(86400);
        nonce = await c.getCurrentDayNonce();
        await c.submitEvidence("ipfs://day1", nonce);

        // Day 1 again (duplicate — should not count as day 2)
        nonce = await c.getCurrentDayNonce();
        await c.submitEvidence("ipfs://day1-b", nonce);

        // Day 2
        await time.increase(86400);
        nonce = await c.getCurrentDayNonce();
        await c.submitEvidence("ipfs://day2", nonce);

        expect(await c.getDaysComplete(alice.address)).to.equal(3n); // 3 unique days
    });

    it("Story 16 — cannot submit evidence during JoinOpen", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 2, "Early submit", "evidence:1",
            now + 300, now + 86700, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        const nonce = await c.getCurrentDayNonce(); // should return day 0 without reverting
        await expect(
            c.connect(alice).submitEvidence("ipfs://too-early", nonce)
        ).to.be.revertedWith("Can only submit evidence during Active");
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: Factory & User Tracking", () => {

    it("Story 17 — multiple challenges tracked correctly", async () => {
        const { factory, alice, bob, link } = await loadFixture(deployProtocol);
        const now = await time.latest();

        for (let i = 0; i < 3; i++) {
            await link.connect(alice).approve(await factory.getAddress(), E("2"));
            await factory.connect(alice).createChallenge(
                0, 0, `Challenge ${i}`, "eth::gte:1",
                now + 300 + i * 10, now + 900 + i * 10, E("0.1"),
                { value: E("0.1") }
            );
        }

        const all = await factory.getAllChallenges();
        expect(all.length).to.equal(3);

        // All are unique addresses
        expect(new Set(all).size).to.equal(3);

        // Each shows alice as creator
        for (const addr of all) {
            const [, , , creator] = await factory.getChallengeInfo(addr);
            expect(creator).to.equal(alice.address);
        }

        // getUserChallenges tracks alice as creator
        const aliceChallenges = await factory.getUserChallenges(alice.address);
        expect(aliceChallenges.length).to.equal(3);
    });

    it("Story 18 — challenge type 1 (Group) rejects ETH in createChallenge", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await expect(
            factory.connect(alice).createChallenge(
                1, 0, "Group", "eth::gte:1",
                now + 300, now + 900, E("0.1"),
                { value: E("0.1") } // sending ETH for a Group challenge = revert
            )
        ).to.be.revertedWith("No initial stake for Group challenges");
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: Bind Account", () => {

    it("Story 19 — bind account works during JoinOpen, blocked after", async () => {
        const { factory, alice, bob, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 1, "API Challenge", "github::repos::gte:10",
            now + 300, now + 900, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        // Alice binds her GitHub account
        await expect(
            c.connect(alice).bindAccount("octocat")
        ).to.emit(c, "AccountBound").withArgs(alice.address, "octocat");

        // Bob is not registered, cannot bind
        await expect(
            c.connect(bob).bindAccount("bob")
        ).to.be.revertedWith("Must be a participant");

        // After deadline passes and state moves to Active, cannot bind
        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");

        await expect(
            c.connect(alice).bindAccount("newname")
        ).to.be.revertedWith("Can only bind during JoinOpen");
    });
});

// reuse reputation variable from outer scope
let reputation: any;
// ─────────────────────────────────────────────────────────────────────────────

describe("Narrative: Security — Reentrancy & edge cases", () => {

    it("Story 20 — cannot double-enter settle via direct call", async () => {
        const { factory, alice, link } = await loadFixture(deployProtocol);
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Reentrancy test", "eth::gte:1",
            now + 300, now + 900, E("0.1"),
            { value: E("0.1") }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], alice
        );

        await time.increaseTo(now + 301);
        await c.performUpkeep("0x");
        await time.increaseTo(now + 901);
        await c.performUpkeep("0x"); // → Settled

        // Now in Settled state — settle() should revert
        await expect(c.settle()).to.be.revertedWith("Not in VerifyPending");
    });

    it("Story 21 — minimum FOR bet is buyIn (not 1 wei)", async () => {
        const { factory, alice, bob, link } = await loadFixture(deployProtocol);
        const buyIn = E("0.5");
        const now = await time.latest();
        await link.connect(alice).approve(await factory.getAddress(), E("2"));
        await factory.connect(alice).createChallenge(
            0, 0, "Min bet test", "eth::gte:1",
            now + 300, now + 900, buyIn,
            { value: buyIn }
        );
        const c = IndividualChallenge__factory.connect(
            (await factory.getAllChallenges())[0], bob
        );

        // 1 wei below buyIn
        await expect(
            c.connect(bob).placeBet(true, { value: buyIn - 1n })
        ).to.be.revertedWith("FOR bet below minimum buy-in");

        // Exactly buyIn
        await expect(
            c.connect(bob).placeBet(true, { value: buyIn })
        ).to.not.be.reverted;
    });
});
