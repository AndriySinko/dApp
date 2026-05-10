import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
    individualFixture,
    advanceToActive,
    advanceToVerifyPending,
    ONE_ETH,
    TWO_ETH,
    JOIN_WINDOW,
    ACTIVE_WINDOW,
} from "../helpers/deploy";

describe("IndividualChallenge", () => {

    // ── Constructor ──────────────────────────────────────────────────────────

    describe("constructor", () => {
        it("starts in JoinOpen state", async () => {
            const { challenge } = await loadFixture(individualFixture);
            expect(await challenge.state()).to.equal(0); // JoinOpen
        });

        it("registers creator as a FOR bettor in the forPool", async () => {
            const { challenge, owner } = await loadFixture(individualFixture);
            expect(await challenge.isRegistered(owner.address)).to.be.true;
            expect(await challenge.forPool()).to.equal(ONE_ETH);
            expect(await challenge.againstPool()).to.equal(0n);
            const [amount, side] = await challenge.getBet(owner.address);
            expect(amount).to.equal(ONE_ETH);
            expect(side).to.be.true;
        });

        it("records the creator as a participant", async () => {
            const { challenge, owner } = await loadFixture(individualFixture);
            const participants = await challenge.participants();
            expect(participants).to.deep.equal([owner.address]);
        });

        it("reverts when buy-in is zero", async () => {
            const { owner, verifier, reputation, treasury } = await loadFixture(individualFixture);
            const now = await time.latest();
            const IC = await ethers.getContractFactory("IndividualChallenge");
            await expect(IC.deploy(
                1n, owner.address, "T", "C",
                now + JOIN_WINDOW, now + ACTIVE_WINDOW,
                0n,                             // zero buy-in
                0, await verifier.getAddress(),
                await reputation.getAddress(), await treasury.getAddress(),
                { value: 0n },
            )).to.be.revertedWith("Buy-in must be positive");
        });

        it("reverts when msg.value != buyIn", async () => {
            const { owner, verifier, reputation, treasury } = await loadFixture(individualFixture);
            const now = await time.latest();
            const IC = await ethers.getContractFactory("IndividualChallenge");
            await expect(IC.deploy(
                1n, owner.address, "T", "C",
                now + JOIN_WINDOW, now + ACTIVE_WINDOW,
                ONE_ETH, 0, await verifier.getAddress(),
                await reputation.getAddress(), await treasury.getAddress(),
                { value: ONE_ETH / 2n },        // wrong value
            )).to.be.revertedWith("Must send exact buy-in");
        });

        it("reverts when joinDeadline is in the past", async () => {
            const { owner, verifier, reputation, treasury } = await loadFixture(individualFixture);
            const past = (await time.latest()) - 1;
            const IC = await ethers.getContractFactory("IndividualChallenge");
            await expect(IC.deploy(
                1n, owner.address, "T", "C",
                past, past + 100,
                ONE_ETH, 0, await verifier.getAddress(),
                await reputation.getAddress(), await treasury.getAddress(),
                { value: ONE_ETH },
            )).to.be.revertedWith("Join deadline must be in the future");
        });

        it("reverts when joinDeadline >= challengeDeadline", async () => {
            const { owner, verifier, reputation, treasury } = await loadFixture(individualFixture);
            const now = await time.latest();
            const IC = await ethers.getContractFactory("IndividualChallenge");
            await expect(IC.deploy(
                1n, owner.address, "T", "C",
                now + 3600, now + 3600,         // equal deadlines
                ONE_ETH, 0, await verifier.getAddress(),
                await reputation.getAddress(), await treasury.getAddress(),
                { value: ONE_ETH },
            )).to.be.revertedWith("Join deadline must precede challenge deadline");
        });
    });

    // ── placeBet ─────────────────────────────────────────────────────────────

    describe("placeBet", () => {
        it("accepts a FOR bet at the minimum buy-in", async () => {
            const { challenge, alice } = await loadFixture(individualFixture);
            await challenge.connect(alice).placeBet(true, { value: ONE_ETH });
            expect(await challenge.forPool()).to.equal(ONE_ETH * 2n);
            expect(await challenge.bettorsFor()).to.equal(1n);
        });

        it("accepts an AGAINST bet below the cap", async () => {
            const { challenge, alice } = await loadFixture(individualFixture);
            await challenge.connect(alice).placeBet(false, { value: ONE_ETH });
            expect(await challenge.againstPool()).to.equal(ONE_ETH);
            expect(await challenge.bettorsAgainst()).to.equal(1n);
        });

        it("marks the bettor as registered", async () => {
            const { challenge, alice } = await loadFixture(individualFixture);
            await challenge.connect(alice).placeBet(true, { value: ONE_ETH });
            expect(await challenge.isRegistered(alice.address)).to.be.true;
        });

        it("reverts if the challenge is not JoinOpen", async () => {
            const { challenge, alice, joinDl } = await loadFixture(individualFixture);
            await advanceToActive(challenge, joinDl);
            await expect(
                challenge.connect(alice).placeBet(true, { value: ONE_ETH }),
            ).to.be.revertedWith("Betting closed");
        });

        it("reverts if the bettor is already registered", async () => {
            const { challenge, owner } = await loadFixture(individualFixture);
            await expect(
                challenge.connect(owner).placeBet(true, { value: ONE_ETH }),
            ).to.be.revertedWith("Already registered");
        });

        it("reverts if no ETH is sent", async () => {
            const { challenge, alice } = await loadFixture(individualFixture);
            await expect(
                challenge.connect(alice).placeBet(true, { value: 0n }),
            ).to.be.revertedWith("Must send ETH");
        });

        it("reverts FOR bet below the buy-in minimum", async () => {
            const { challenge, alice } = await loadFixture(individualFixture);
            await expect(
                challenge.connect(alice).placeBet(true, { value: ONE_ETH / 2n }),
            ).to.be.revertedWith("FOR bet below minimum buy-in");
        });

        it("reverts AGAINST bet that would exceed the 5× pool cap", async () => {
            const { challenge, alice, bob, carol, dave } = await loadFixture(individualFixture);
            // buyIn = 1 ETH → cap = 5 ETH.  Fill 4 ETH first.
            await challenge.connect(alice).placeBet(false, { value: ONE_ETH });
            await challenge.connect(bob).placeBet(false, { value: ONE_ETH });
            await challenge.connect(carol).placeBet(false, { value: ONE_ETH });
            await challenge.connect(dave).placeBet(false, { value: ONE_ETH });
            // againstPool = 4 ETH; 2 more ETH would push it to 6 → over cap
            const extra = await ethers.getSigner((await ethers.getSigners())[5].address);
            await expect(
                challenge.connect(extra).placeBet(false, { value: TWO_ETH }),
            ).to.be.revertedWith("AGAINST pool cap reached");
        });
    });

    // ── Automation ───────────────────────────────────────────────────────────

    describe("checkUpkeep / performUpkeep", () => {
        it("checkUpkeep is false before joinDeadline", async () => {
            const { challenge } = await loadFixture(individualFixture);
            const [needed] = await challenge.checkUpkeep("0x");
            expect(needed).to.be.false;
        });

        it("checkUpkeep is true after joinDeadline in JoinOpen", async () => {
            const { challenge, joinDl } = await loadFixture(individualFixture);
            await time.increaseTo(joinDl);
            const [needed] = await challenge.checkUpkeep("0x");
            expect(needed).to.be.true;
        });

        it("performUpkeep transitions JoinOpen → Active", async () => {
            const { challenge, joinDl } = await loadFixture(individualFixture);
            await time.increaseTo(joinDl);
            await challenge.performUpkeep("0x");
            expect(await challenge.state()).to.equal(1); // Active
        });

        it("checkUpkeep is true after challengeDeadline in Active", async () => {
            const { challenge, joinDl, challengeDl } = await loadFixture(individualFixture);
            await advanceToActive(challenge, joinDl);
            await time.increaseTo(challengeDl);
            const [needed] = await challenge.checkUpkeep("0x");
            expect(needed).to.be.true;
        });

        it("performUpkeep reverts when upkeep is not needed", async () => {
            const { challenge } = await loadFixture(individualFixture);
            await expect(challenge.performUpkeep("0x")).to.be.revertedWith("Upkeep not needed");
        });

        it("performUpkeep Active→VerifyPending calls verifier for creator only", async () => {
            const { challenge, verifier, owner, joinDl, challengeDl } = await loadFixture(individualFixture);
            await verifier.setAutoDeliver(false, true); // disable auto so we can inspect
            await advanceToActive(challenge, joinDl);
            await time.increaseTo(challengeDl);
            await challenge.performUpkeep("0x");
            expect(await challenge.state()).to.equal(2); // VerifyPending
            expect(await verifier.pendingCount()).to.equal(1n);
            const [, participant] = await verifier.getPending(0);
            expect(participant).to.equal(owner.address);
        });
    });

    // ── Settlement: creator passes (FOR wins) ────────────────────────────────

    describe("settle — creator passes (FOR wins)", () => {
        async function forWinsFixture() {
            const f = await individualFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            // alice bets 1 ETH FOR, bob bets 2 ETH AGAINST
            await challenge.connect(alice).placeBet(true, { value: ONE_ETH });
            await challenge.connect(bob).placeBet(false, { value: TWO_ETH });
            // verifier auto-delivers true (creator passes)
            await verifier.setAutoDeliver(true, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("transitions to Settled", async () => {
            const { challenge } = await loadFixture(forWinsFixture);
            expect(await challenge.state()).to.equal(3); // Settled
        });

        it("sends 2% of againstPool as fee to treasury", async () => {
            const { challenge, treasury } = await loadFixture(forWinsFixture);
            // againstPool = 2 ETH; fee = 0.04 ETH
            expect(await treasury.totalDeposited()).to.equal(ethers.parseEther("0.04"));
        });

        it("credits FOR bettors with stake + proportional share", async () => {
            const { challenge, owner, alice } = await loadFixture(forWinsFixture);
            // forPool = 2 ETH, winnerPot = 2 - 0.04 = 1.96 ETH
            // creator: 1 + (1/2)*1.96 = 1.98 ETH; alice: 1 + (1/2)*1.96 = 1.98 ETH
            expect(await challenge.pendingWithdrawals(owner.address)).to.equal(ethers.parseEther("1.98"));
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(ethers.parseEther("1.98"));
        });

        it("AGAINST bettors receive nothing", async () => {
            const { challenge, bob } = await loadFixture(forWinsFixture);
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(0n);
        });

        it("updates reputation: creator +100, FOR bettor +25", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(forWinsFixture);
            expect(await reputation.scores(owner.address)).to.equal(100n);
            expect(await reputation.scores(alice.address)).to.equal(25n);
            expect(await reputation.scores(bob.address)).to.equal(0n);
        });
    });

    // ── Settlement: creator fails (AGAINST wins) ─────────────────────────────

    describe("settle — creator fails (AGAINST wins)", () => {
        async function againstWinsFixture() {
            const f = await individualFixture();
            const { challenge, verifier, alice, joinDl, challengeDl } = f;
            await challenge.connect(alice).placeBet(false, { value: ONE_ETH });
            await verifier.setAutoDeliver(true, false); // creator fails
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("transitions to Settled", async () => {
            const { challenge } = await loadFixture(againstWinsFixture);
            expect(await challenge.state()).to.equal(3);
        });

        it("sends 2% of forPool as fee to treasury", async () => {
            const { treasury } = await loadFixture(againstWinsFixture);
            // forPool = 1 ETH; fee = 0.02 ETH
            expect(await treasury.totalDeposited()).to.equal(ethers.parseEther("0.02"));
        });

        it("credits AGAINST bettor with stake + capped winnings", async () => {
            const { challenge, alice } = await loadFixture(againstWinsFixture);
            // grossWinnerPot = 0.98 ETH < againstPool = 1 ETH → no cap
            // alice: 1 + 0.98 = 1.98 ETH
            expect(await challenge.pendingWithdrawals(alice.address)).to.equal(ethers.parseEther("1.98"));
        });

        it("creator gets nothing and reputation -50", async () => {
            const { challenge, reputation, owner } = await loadFixture(againstWinsFixture);
            expect(await challenge.pendingWithdrawals(owner.address)).to.equal(0n);
            expect(await reputation.scores(owner.address)).to.equal(-50n);
        });
    });

    describe("settle — AGAINST wins with cap (forPool >> againstPool)", () => {
        async function cappedFixture() {
            const f = await individualFixture();
            const { challenge, verifier, alice, bob, joinDl, challengeDl } = f;
            // alice bets 2 ETH FOR → forPool = 3 ETH, againstPool stays 0
            // bob bets 1 ETH AGAINST → againstPool = 1 ETH
            await challenge.connect(alice).placeBet(true, { value: TWO_ETH });
            await challenge.connect(bob).placeBet(false, { value: ONE_ETH });
            await verifier.setAutoDeliver(true, false); // creator fails
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            return f;
        }

        it("caps AGAINST winnings at againstPool and routes overflow to treasury", async () => {
            const { challenge, treasury, bob } = await loadFixture(cappedFixture);
            // forPool = 3 ETH; fee = 0.06; grossWinnerPot = 2.94; cap = 1 → overflow = 1.94
            // treasury = 0.06 + 1.94 = 2 ETH
            expect(await treasury.totalDeposited()).to.equal(TWO_ETH);
            // bob: 1 + 1 = 2 ETH (capped at 2×)
            expect(await challenge.pendingWithdrawals(bob.address)).to.equal(TWO_ETH);
        });
    });

    // ── Settlement: empty AGAINST pool ──────────────────────────────────────

    describe("settle — no AGAINST bettors (creator only)", () => {
        async function emptyAgainstFixture() {
            const f = await individualFixture();
            const { verifier, joinDl, challengeDl } = f;
            await verifier.setAutoDeliver(true, true);
            await advanceToVerifyPending(f.challenge, joinDl, challengeDl);
            return f;
        }

        it("creator gets stake back; no fee to treasury", async () => {
            const { challenge, treasury, owner } = await loadFixture(emptyAgainstFixture);
            expect(await challenge.pendingWithdrawals(owner.address)).to.equal(ONE_ETH);
            expect(await treasury.totalDeposited()).to.equal(0n);
        });
    });

    // ── withdraw ─────────────────────────────────────────────────────────────

    describe("withdraw", () => {
        async function settledFixture() {
            const f = await individualFixture();
            const { verifier, joinDl, challengeDl } = f;
            await verifier.setAutoDeliver(true, true);
            await advanceToVerifyPending(f.challenge, joinDl, challengeDl);
            return f;
        }

        it("transfers the pending amount to the caller", async () => {
            const { challenge, owner } = await loadFixture(settledFixture);
            const before = await ethers.provider.getBalance(owner.address);
            const tx     = await challenge.connect(owner).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
            const after  = await ethers.provider.getBalance(owner.address);
            expect(after - before + gasUsed).to.equal(ONE_ETH);
        });

        it("clears pending after withdrawal", async () => {
            const { challenge, owner } = await loadFixture(settledFixture);
            await challenge.connect(owner).withdraw();
            expect(await challenge.pendingWithdrawals(owner.address)).to.equal(0n);
        });

        it("reverts when there is nothing to withdraw", async () => {
            const { challenge, alice } = await loadFixture(settledFixture);
            await expect(challenge.connect(alice).withdraw()).to.be.revertedWith("Nothing to withdraw");
        });

        it("reverts on double withdraw", async () => {
            const { challenge, owner } = await loadFixture(settledFixture);
            await challenge.connect(owner).withdraw();
            await expect(challenge.connect(owner).withdraw()).to.be.revertedWith("Nothing to withdraw");
        });
    });

    // ── Manual settle (no auto-deliver) ─────────────────────────────────────

    describe("settle — manual verdict delivery", () => {
        it("stays in VerifyPending until verifier delivers and then auto-settles", async () => {
            const { challenge, verifier, joinDl, challengeDl } = await loadFixture(individualFixture);
            await verifier.setAutoDeliver(false, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            expect(await challenge.state()).to.equal(2); // still VerifyPending
            await verifier.deliverVerdict(0, true);
            expect(await challenge.state()).to.equal(3); // Settled
        });

        it("reverts settle() when creator verdict not yet received", async () => {
            const { challenge, verifier, joinDl, challengeDl } = await loadFixture(individualFixture);
            await verifier.setAutoDeliver(false, true);
            await advanceToVerifyPending(challenge, joinDl, challengeDl);
            await expect(challenge.settle()).to.be.revertedWith("Creator verdict not received");
        });
    });
});

