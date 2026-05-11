import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { PublicChallenge__factory } from "../../typechain-types";
import {
    publicFixture,
    advanceToActive,
    advanceToVerifyPending,
    ONE_ETH,
    TWO_ETH,
    JOIN_WINDOW,
    ACTIVE_WINDOW,
} from "../helpers/deploy";

describe("PublicChallenge", () => {

    // ── Constructor ──────────────────────────────────────────────────────────

    describe("constructor", () => {
        it("starts JoinOpen and records the prize pool", async () => {
            const { challenge, prizePool } = await loadFixture(publicFixture);
            expect(await challenge.state()).to.equal(0);
            expect(await challenge.prizePool()).to.equal(prizePool);
        });

        it("reverts when no prize pool ETH is sent", async () => {
            const { owner, verifier, reputation, treasury } = await loadFixture(publicFixture);
            const now = await time.latest();
            const PC  = new PublicChallenge__factory(owner);
            await expect(PC.deploy(
                3n, owner.address, "T", "C",
                now + JOIN_WINDOW, now + ACTIVE_WINDOW,
                ONE_ETH, 0,
                await verifier.getAddress(),
                await reputation.getAddress(),
                await treasury.getAddress(),
                owner.address,
                { value: 0n },
            )).to.be.revertedWith("Prize pool required");
        });
    });

    // ── Settlement: all-win ───────────────────────────────────────────────────

    describe("settle — all win (stake back + flat prize bonus)", () => {
        async function allWinFixture() {
            const f = await publicFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(true, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("transitions to Settled", async () => {
            const { challenge } = await loadFixture(allWinFixture);
            expect(await challenge.state()).to.equal(3);
        });

        it("each winner gets stake + prizePool/count bonus (2 ETH / 2 = 1 ETH each)", async () => {
            const { challenge, alice, bob } = await loadFixture(allWinFixture);
            // prizePool = 2 ETH, 2 winners → bonus = 1 ETH each
            // payout = 1 ETH stake + 1 ETH bonus = 2 ETH each
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(TWO_ETH);
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(TWO_ETH);
        });

        it("routes prize dust (odd count) to treasury", async () => {
            // Use 3 winners with 2 ETH prize pool → bonus = 0.666... ETH → dust
            const f = await publicFixture();
            const { challenge, verifier, alice, bob, carol, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            await challenge.connect(carol).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(true, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            // prizeBonus = 2e18 / 3 = 666666666666666666 (each)
            // dust = 2e18 - 666666666666666666*3 = 2
            const { treasury } = f;
            expect(await treasury.totalDeposited()).to.be.gt(0n);
        });

        it("no 2% fee to treasury on a clean 2-winner all-win", async () => {
            const { treasury } = await loadFixture(allWinFixture);
            // 2 ETH prize pool distributes evenly → dust = 0; no group fee
            expect(await treasury.totalDeposited()).to.equal(0n);
        });
    });

    // ── Settlement: all-lose ──────────────────────────────────────────────────

    describe("settle — all lose (loser stakes + prize pool → treasury)", () => {
        async function allLoseFixture() {
            const f = await publicFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(true, false);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("sends loserPot + prizePool to treasury", async () => {
            const { treasury } = await loadFixture(allLoseFixture);
            // 2 ETH stakes + 2 ETH prize = 4 ETH to treasury
            expect(await treasury.totalDeposited()).to.equal(ethers.parseEther("4"));
        });

        it("no participant gets a payout", async () => {
            const { challenge, alice, bob } = await loadFixture(allLoseFixture);
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(0n);
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(0n);
        });

        it("reputation -50 per loser", async () => {
            const { reputation, alice, bob } = await loadFixture(allLoseFixture);
            expect(await reputation.scores(alice.address)).to.equal(-50n);
            expect(await reputation.scores(bob.address)).to.equal(-50n);
        });
    });

    // ── Settlement: mixed ─────────────────────────────────────────────────────

    describe("settle — mixed (no group fee, proportional split + flat bonus)", () => {
        async function mixedFixture() {
            const f = await publicFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await challenge.connect(bob).join({ value: ONE_ETH });
            // alice wins, bob loses
            await verifier.setParticipantResult(alice.address, true);
            await verifier.setParticipantResult(bob.address, false);
            await verifier.setAutoDeliver(true, false);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("transitions to Settled", async () => {
            const { challenge } = await loadFixture(mixedFixture);
            expect(await challenge.state()).to.equal(3);
        });

        it("winner gets stake + full loserPot + flat prize bonus (no 2% fee)", async () => {
            const { challenge, alice } = await loadFixture(mixedFixture);
            // alice: 1 ETH stake + 1 ETH loserPot (no fee!) + 2 ETH prize = 4 ETH
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(ethers.parseEther("4"));
        });

        it("no fee from loser pot to treasury (only dust)", async () => {
            const { treasury } = await loadFixture(mixedFixture);
            // 1 winner with 1 ETH stake, 1 ETH loserPot, 2 ETH prize → no dust → treasury = 0
            expect(await treasury.totalDeposited()).to.equal(0n);
        });

        it("loser gets nothing; reputation -50, winner +100", async () => {
            const { challenge, reputation, alice, bob } = await loadFixture(mixedFixture);
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(0n);
            expect(await reputation.scores(alice.address)).to.equal(100n);
            expect(await reputation.scores(bob.address)).to.equal(-50n);
        });
    });

    // ── returnPrizePoolToTreasury ─────────────────────────────────────────────────────

    describe("returnPrizePoolToTreasury", () => {
        it("creator can reclaim prize when Active, no participants, past deadline", async () => {
            const { challenge, treasury, joinDl, challengeDl } = await loadFixture(publicFixture);
            await advanceToActive(challenge, joinDl);
            await time.increaseTo(challengeDl + 1);
            await challenge.returnPrizePoolToTreasury();
            expect(await challenge.state()).to.equal(3); // Settled
            expect(await challenge.prizePool()).to.equal(0n);
            expect(await treasury.totalDeposited()).to.equal(TWO_ETH);
        });

        it("reverts when caller is not creator", async () => {
            const { challenge, alice, joinDl, challengeDl } = await loadFixture(publicFixture);
            await advanceToActive(challenge, joinDl);
            await time.increaseTo(challengeDl + 1);
            await expect(challenge.connect(alice).returnPrizePoolToTreasury()).to.be.revertedWith("Only creator");
        });

        it("reverts when state is not Active (still JoinOpen)", async () => {
            const { challenge } = await loadFixture(publicFixture);
            await expect(challenge.returnPrizePoolToTreasury()).to.be.revertedWith("Not in Active state");
        });

        it("reverts when participants have joined", async () => {
            const { challenge, alice, joinDl, challengeDl } = await loadFixture(publicFixture);
            await challenge.connect(alice).join({ value: ONE_ETH });
            await advanceToActive(challenge, joinDl);
            await time.increaseTo(challengeDl + 1);
            await expect(challenge.returnPrizePoolToTreasury()).to.be.revertedWith("Participants exist");
        });

        it("reverts before challenge deadline", async () => {
            const { challenge, joinDl } = await loadFixture(publicFixture);
            await advanceToActive(challenge, joinDl);
            // still before challengeDl
            await expect(challenge.returnPrizePoolToTreasury()).to.be.revertedWith("Challenge not over");
        });
    });

    // ── withdraw ──────────────────────────────────────────────────────────────

    describe("withdraw", () => {
        async function winnerFixture() {
            const f = await publicFixture();
            const { challenge, verifier, alice, joinDl, challengeDl } = f;
            await challenge.connect(alice).join({ value: ONE_ETH });
            await verifier.setAutoDeliver(true, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("transfers the full payout to the winner", async () => {
            const { challenge, alice } = await loadFixture(winnerFixture);
            // alice: 1 ETH stake + 2 ETH prize (solo winner) = 3 ETH
            const pending = await challenge.pendingWithdrawals(alice.address);
            expect(pending).to.equal(ethers.parseEther("3"));
            const before  = await ethers.provider.getBalance(alice.address);
            const tx      = await challenge.connect(alice).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
            const after   = await ethers.provider.getBalance(alice.address);
            expect(after - before + gasUsed).to.equal(ethers.parseEther("3"));
        });

        it("reverts when nothing is pending", async () => {
            const { challenge, bob } = await loadFixture(winnerFixture);
            await expect(challenge.connect(bob).withdraw()).to.be.revertedWith("Nothing to withdraw");
        });
    });
});
