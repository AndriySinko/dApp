import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
    groupFixture,
    advanceToActive,
    advanceToVerifyPending,
    ONE_ETH,
    TWO_ETH,
    JOIN_WINDOW,
    ACTIVE_WINDOW,
} from "../helpers/deploy";

describe("GroupChallenge", () => {

    // ── Constructor ──────────────────────────────────────────────────────────

    describe("constructor", () => {
        it("starts in JoinOpen with no participants", async () => {
            const { challenge } = await loadFixture(groupFixture);
            expect(await challenge.state()).to.equal(0);
            expect((await challenge.participants()).length).to.equal(0);
        });

        it("reverts with zero buy-in", async () => {
            const { owner, verifier, reputation, treasury } = await loadFixture(groupFixture);
            const now = await time.latest();
            const GC = await ethers.getContractFactory("GroupChallenge");
            await expect(GC.deploy(
                2n, owner.address, "T", "C",
                now + JOIN_WINDOW, now + ACTIVE_WINDOW,
                0n, 0,
                await verifier.getAddress(),
                await reputation.getAddress(),
                await treasury.getAddress(),
            )).to.be.revertedWith("Buy-in must be positive");
        });

        it("reverts when joinDl >= challengeDl", async () => {
            const { owner, verifier, reputation, treasury } = await loadFixture(groupFixture);
            const now = await time.latest();
            const GC = await ethers.getContractFactory("GroupChallenge");
            await expect(GC.deploy(
                2n, owner.address, "T", "C",
                now + 7200, now + 3600,         // inverted order
                ONE_ETH, 0,
                await verifier.getAddress(),
                await reputation.getAddress(),
                await treasury.getAddress(),
            )).to.be.revertedWith("Join deadline must precede challenge deadline");
        });

        it("reverts with zero verifier address", async () => {
            const { owner, reputation, treasury } = await loadFixture(groupFixture);
            const now = await time.latest();
            const GC = await ethers.getContractFactory("GroupChallenge");
            await expect(GC.deploy(
                2n, owner.address, "T", "C",
                now + JOIN_WINDOW, now + ACTIVE_WINDOW,
                ONE_ETH, 0,
                ethers.ZeroAddress,
                await reputation.getAddress(),
                await treasury.getAddress(),
            )).to.be.revertedWith("Invalid verifier");
        });
    });

    // ── join ─────────────────────────────────────────────────────────────────

    describe("join", () => {
        it("registers a participant with exact buy-in", async () => {
            const { challenge, alice } = await loadFixture(groupFixture);
            await challenge.connect(alice).join({ value: ONE_ETH });
            expect(await challenge.isRegistered(alice.address)).to.be.true;
            expect(await challenge.stakes(alice.address)).to.equal(ONE_ETH);
        });

        it("accepts stake larger than buy-in", async () => {
            const { challenge, alice } = await loadFixture(groupFixture);
            await challenge.connect(alice).join({ value: TWO_ETH });
            expect(await challenge.stakes(alice.address)).to.equal(TWO_ETH);
        });

        it("appends to participants array", async () => {
            const { challenge, alice, bob } = await loadFixture(groupFixture);
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            expect((await challenge.participants()).length).to.equal(2);
        });

        it("reverts if not JoinOpen", async () => {
            const { challenge, alice, joinDl } = await loadFixture(groupFixture);
            await advanceToActive(challenge, joinDl);
            await expect(
                challenge.connect(alice).join({ value: ONE_ETH }),
            ).to.be.revertedWith("Challenge not open for joining");
        });

        it("reverts after join deadline (same state, just timestamp)", async () => {
            const { challenge, alice, joinDl } = await loadFixture(groupFixture);
            await time.increaseTo(joinDl); // at deadline, not yet performUpkeep
            await expect(
                challenge.connect(alice).join({ value: ONE_ETH }),
            ).to.be.revertedWith("Join deadline has passed");
        });

        it("reverts if already joined", async () => {
            const { challenge, alice } = await loadFixture(groupFixture);
            await challenge.connect(alice).join({ value: ONE_ETH });
            await expect(
                challenge.connect(alice).join({ value: ONE_ETH }),
            ).to.be.revertedWith("Already joined");
        });

        it("reverts with stake below buy-in", async () => {
            const { challenge, alice } = await loadFixture(groupFixture);
            await expect(
                challenge.connect(alice).join({ value: ONE_ETH / 2n }),
            ).to.be.revertedWith("Must send at least buy-in");
        });
    });

    // ── Automation ───────────────────────────────────────────────────────────

    describe("checkUpkeep / performUpkeep", () => {
        it("JoinOpen → Active after join deadline", async () => {
            const { challenge, joinDl } = await loadFixture(groupFixture);
            await time.increaseTo(joinDl);
            await challenge.performUpkeep("0x");
            expect(await challenge.state()).to.equal(1); // Active
        });

        it("Active → VerifyPending calls verifier for every participant", async () => {
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = await loadFixture(groupFixture);
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(false, true); // manual delivery
            await advanceToActive(challenge, joinDl);
            await time.increaseTo(challengeDl);
            await challenge.performUpkeep("0x");
            expect(await challenge.state()).to.equal(2); // VerifyPending
            expect(await verifier.pendingCount()).to.equal(2n);
        });

        it("performUpkeep with no participants reverts (no one to verify)", async () => {
            const { challenge, joinDl, challengeDl } = await loadFixture(groupFixture);
            await advanceToActive(challenge, joinDl);
            await time.increaseTo(challengeDl);
            await expect(challenge.performUpkeep("0x")).to.be.revertedWith("No participants to verify");
        });
    });

    // ── Settlement: all-win ───────────────────────────────────────────────────

    describe("settle — all win", () => {
        async function allWinFixture() {
            const f = await groupFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(true, true); // everyone passes
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("transitions to Settled", async () => {
            const { challenge } = await loadFixture(allWinFixture);
            expect(await challenge.state()).to.equal(3);
        });

        it("each participant gets their stake back", async () => {
            const { challenge, alice, bob } = await loadFixture(allWinFixture);
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(ONE_ETH);
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(ONE_ETH);
        });

        it("no fee goes to treasury", async () => {
            const { treasury } = await loadFixture(allWinFixture);
            expect(await treasury.totalDeposited()).to.equal(0n);
        });

        it("reputation +100 for each winner", async () => {
            const { reputation, alice, bob } = await loadFixture(allWinFixture);
            expect(await reputation.scores(alice.address)).to.equal(100n);
            expect(await reputation.scores(bob.address)).to.equal(100n);
        });
    });

    // ── Settlement: all-lose ──────────────────────────────────────────────────

    describe("settle — all lose", () => {
        async function allLoseFixture() {
            const f = await groupFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(true, false); // everyone fails
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("sends entire pot to treasury", async () => {
            const { treasury } = await loadFixture(allLoseFixture);
            expect(await treasury.totalDeposited()).to.equal(TWO_ETH);
        });

        it("no participant gets a payout", async () => {
            const { challenge, alice, bob } = await loadFixture(allLoseFixture);
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(0n);
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(0n);
        });

        it("reputation -50 for each loser", async () => {
            const { reputation, alice, bob } = await loadFixture(allLoseFixture);
            expect(await reputation.scores(alice.address)).to.equal(-50n);
            expect(await reputation.scores(bob.address)).to.equal(-50n);
        });
    });

    // ── Settlement: mixed ─────────────────────────────────────────────────────

    describe("settle — mixed (winner splits loser pot with 2% fee)", () => {
        async function mixedFixture() {
            const f = await groupFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            // alice wins, bob loses
            await verifier.setParticipantResult(alice.address, true);
            await verifier.setParticipantResult(bob.address, false);
            await verifier.setAutoDeliver(true, false); // default false, overrides per participant
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("fee = 2% of loser pot goes to treasury", async () => {
            const { treasury } = await loadFixture(mixedFixture);
            // loserPot = 1 ETH; fee = 0.02 ETH
            expect(await treasury.totalDeposited()).to.equal(ethers.parseEther("0.02"));
        });

        it("winner gets stake + proportional share of winner pot", async () => {
            const { challenge, alice } = await loadFixture(mixedFixture);
            // winnerPot = 0.98 ETH; alice stake = 1 ETH → payout = 1.98 ETH
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(ethers.parseEther("1.98"));
        });

        it("loser gets no payout", async () => {
            const { challenge, bob } = await loadFixture(mixedFixture);
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(0n);
        });

        it("winner reputation +100, loser -50", async () => {
            const { reputation, alice, bob } = await loadFixture(mixedFixture);
            expect(await reputation.scores(alice.address)).to.equal(100n);
            expect(await reputation.scores(bob.address)).to.equal(-50n);
        });
    });

    // ── Settlement: guard rails ───────────────────────────────────────────────

    describe("settle — guard rails", () => {
        it("reverts settle() if not all verdicts have been received", async () => {
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = await loadFixture(groupFixture);
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(false, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            // only alice verdict delivered
            await verifier.deliverVerdict(0, true);
            await expect(challenge.settle()).to.be.revertedWith("Not all verdicts received");
        });
    });

    // ── withdraw ──────────────────────────────────────────────────────────────

    describe("withdraw", () => {
        async function allWinSettled() {
            const f = await groupFixture();
            const { challenge, verifier, alice, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(true, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("transfers ETH to the winner", async () => {
            const { challenge, alice } = await loadFixture(allWinSettled);
            const before  = await ethers.provider.getBalance(alice.address);
            const tx      = await challenge.connect(alice).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
            const after   = await ethers.provider.getBalance(alice.address);
            expect(after - before + gasUsed).to.equal(ONE_ETH);
        });

        it("clears the pending amount", async () => {
            const { challenge, alice } = await loadFixture(allWinSettled);
            await challenge.connect(alice).withdraw();
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(0n);
        });

        it("reverts on a second withdraw attempt", async () => {
            const { challenge, alice } = await loadFixture(allWinSettled);
            await challenge.connect(alice).withdraw();
            await expect(challenge.connect(alice).withdraw()).to.be.revertedWith("Nothing to withdraw");
        });
    });
});
