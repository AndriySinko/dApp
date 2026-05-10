import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { governanceFixture, EPOCH_DURATION, ONE_ETH } from "../helpers/deploy";

// Default proposal args used across tests.
const PROPOSAL = {
    title:       "30-day fitness challenge",
    description: "Complete 30 workouts in 30 days",
    verifier:    0,  // VerifierType.OnChain
    duration:    30, // durationDays
    joinDays:    7,
    minStake:    ONE_ETH,
};

async function proposeAndVote(governance: any, reputation: any, alice: any, bob: any) {
    await governance.propose(
        PROPOSAL.title, PROPOSAL.description, PROPOSAL.verifier,
        PROPOSAL.duration, PROPOSAL.joinDays, PROPOSAL.minStake,
    );
    // Give alice and bob voting power
    await reputation.updateRep(alice.address, 100n, ethers.ZeroAddress);
    await reputation.updateRep(bob.address, 50n, ethers.ZeroAddress);
}

describe("PublicGovernance", () => {

    // ── constructor ───────────────────────────────────────────────────────────

    describe("constructor", () => {
        it("starts at epoch 1", async () => {
            const { governance } = await loadFixture(governanceFixture);
            expect(await governance.currentEpoch()).to.equal(1n);
        });

        it("epochEnd is set to now + epochDuration", async () => {
            const { governance } = await loadFixture(governanceFixture);
            const now = await time.latest();
            const epochEnd = await governance.currentEpochEnd();
            expect(epochEnd).to.be.closeTo(BigInt(now + EPOCH_DURATION), 5n);
        });

        it("prizePerEpoch starts at 0", async () => {
            const { governance } = await loadFixture(governanceFixture);
            expect(await governance.prizePerEpoch()).to.equal(0n);
        });
    });

    // ── setPrizePerEpoch ──────────────────────────────────────────────────────

    describe("setPrizePerEpoch", () => {
        it("owner can set the prize", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await governance.setPrizePerEpoch(ONE_ETH);
            expect(await governance.prizePerEpoch()).to.equal(ONE_ETH);
        });

        it("non-owner cannot set the prize", async () => {
            const { governance, alice } = await loadFixture(governanceFixture);
            await expect(
                governance.connect(alice).setPrizePerEpoch(ONE_ETH),
            ).to.be.revertedWithCustomError(governance, "OwnableUnauthorizedAccount");
        });
    });

    // ── propose ───────────────────────────────────────────────────────────────

    describe("propose", () => {
        it("owner can create a proposal", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await governance.propose(
                PROPOSAL.title, PROPOSAL.description, PROPOSAL.verifier,
                PROPOSAL.duration, PROPOSAL.joinDays, PROPOSAL.minStake,
            );
            const proposals = await governance.getProposals();
            expect(proposals.length).to.equal(1);
            expect(proposals[0].title).to.equal(PROPOSAL.title);
            expect(proposals[0].votes).to.equal(0n);
        });

        it("non-owner cannot propose", async () => {
            const { governance, alice } = await loadFixture(governanceFixture);
            await expect(
                governance.connect(alice).propose(
                    PROPOSAL.title, PROPOSAL.description, PROPOSAL.verifier,
                    PROPOSAL.duration, PROPOSAL.joinDays, PROPOSAL.minStake,
                ),
            ).to.be.revertedWithCustomError(governance, "OwnableUnauthorizedAccount");
        });

        it("reverts with empty title", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await expect(
                governance.propose("", PROPOSAL.description, PROPOSAL.verifier, 30, 7, ONE_ETH),
            ).to.be.revertedWith("Title required");
        });

        it("reverts with empty description", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await expect(
                governance.propose(PROPOSAL.title, "", PROPOSAL.verifier, 30, 7, ONE_ETH),
            ).to.be.revertedWith("Description required");
        });

        it("reverts with zero durationDays", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await expect(
                governance.propose(PROPOSAL.title, PROPOSAL.description, PROPOSAL.verifier, 0, 7, ONE_ETH),
            ).to.be.revertedWith("Duration must be > 0");
        });

        it("reverts with zero joinDays", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await expect(
                governance.propose(PROPOSAL.title, PROPOSAL.description, PROPOSAL.verifier, 30, 0, ONE_ETH),
            ).to.be.revertedWith("Invalid join days");
        });

        it("reverts with zero minStake", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await expect(
                governance.propose(PROPOSAL.title, PROPOSAL.description, PROPOSAL.verifier, 30, 7, 0n),
            ).to.be.revertedWith("Min stake must be > 0");
        });

        it("emits ProposalCreated", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await expect(
                governance.propose(
                    PROPOSAL.title, PROPOSAL.description, PROPOSAL.verifier,
                    PROPOSAL.duration, PROPOSAL.joinDays, PROPOSAL.minStake,
                ),
            ).to.emit(governance, "ProposalCreated").withArgs(
                0n, PROPOSAL.title, PROPOSAL.description,
                PROPOSAL.verifier, PROPOSAL.duration, PROPOSAL.minStake, 1n,
            );
        });
    });

    // ── vote ──────────────────────────────────────────────────────────────────

    describe("vote", () => {
        async function withProposal() {
            const f = await governanceFixture();
            await proposeAndVote(f.governance, f.reputation, f.alice, f.bob);
            return f;
        }

        it("voter with positive reputation adds weighted vote", async () => {
            const { governance, alice } = await loadFixture(withProposal);
            await governance.connect(alice).vote(0);
            const proposals = await governance.getProposals();
            expect(proposals[0].votes).to.equal(100n); // alice's score
        });

        it("marks the voter so they cannot vote twice", async () => {
            const { governance, alice } = await loadFixture(withProposal);
            await governance.connect(alice).vote(0);
            await expect(governance.connect(alice).vote(0)).to.be.revertedWith("Already voted this epoch");
        });

        it("reverts with no voting power (zero score)", async () => {
            const { governance, bob } = await loadFixture(governanceFixture);
            await governance.propose(
                PROPOSAL.title, PROPOSAL.description, 0, 30, 7, ONE_ETH,
            );
            // bob has no reputation
            await expect(governance.connect(bob).vote(0)).to.be.revertedWith("No voting power");
        });

        it("reverts with invalid proposal index", async () => {
            const { governance, alice } = await loadFixture(withProposal);
            await expect(governance.connect(alice).vote(99)).to.be.revertedWith("Invalid proposal index");
        });

        it("reverts after epoch has ended", async () => {
            const { governance, alice } = await loadFixture(withProposal);
            const epochEnd = await governance.currentEpochEnd();
            await time.increaseTo(epochEnd);
            await expect(governance.connect(alice).vote(0)).to.be.revertedWith("Epoch has ended");
        });

        it("emits Voted with weight = reputation score", async () => {
            const { governance, alice } = await loadFixture(withProposal);
            await expect(governance.connect(alice).vote(0))
                .to.emit(governance, "Voted")
                .withArgs(alice.address, 0n, 100n, 100n);
        });

        it("hasVotedThisEpoch is true after voting", async () => {
            const { governance, alice } = await loadFixture(withProposal);
            await governance.connect(alice).vote(0);
            expect(await governance.hasVotedThisEpoch(alice.address)).to.be.true;
        });

        it("getVoteWeight returns the voter's reputation score", async () => {
            const { governance, alice } = await loadFixture(withProposal);
            expect(await governance.getVoteWeight(alice.address)).to.equal(100n);
        });
    });

    // ── tickEpoch ─────────────────────────────────────────────────────────────

    describe("tickEpoch", () => {
        async function readyToTickFixture() {
            const f = await governanceFixture();
            const { governance, reputation, treasury, alice, bob } = f;
            await governance.setPrizePerEpoch(ONE_ETH);
            await governance.propose(
                "Proposal A", "Do 30 workouts", 0, 30, 7, ONE_ETH,
            );
            await governance.propose(
                "Proposal B", "Read 10 books", 0, 10, 3, ONE_ETH,
            );
            // alice votes for proposal 0 (weight=100), bob votes for proposal 1 (weight=50)
            await reputation.updateRep(alice.address, 100n, ethers.ZeroAddress);
            await reputation.updateRep(bob.address, 50n, ethers.ZeroAddress);
            await governance.connect(alice).vote(0);
            await governance.connect(bob).vote(1);
            // Advance past epoch end
            const epochEnd = await governance.currentEpochEnd();
            await time.increaseTo(epochEnd);
            return f;
        }

        it("selects the proposal with the most votes as winner", async () => {
            const { governance, mockFactory } = await loadFixture(readyToTickFixture);
            await governance.tickEpoch();
            // proposal 0 won (votes=100 > 50); MockFactory.callCount = 1
            expect(await mockFactory.callCount()).to.equal(1n);
        });

        it("forwards prizePerEpoch ETH to the factory", async () => {
            const { governance, mockFactory } = await loadFixture(readyToTickFixture);
            await governance.tickEpoch();
            expect(await mockFactory.balance()).to.equal(ONE_ETH);
        });

        it("advances to the next epoch and clears proposals", async () => {
            const { governance } = await loadFixture(readyToTickFixture);
            await governance.tickEpoch();
            expect(await governance.currentEpoch()).to.equal(2n);
            expect((await governance.getProposals()).length).to.equal(0);
        });

        it("resets voter flags after epoch tick", async () => {
            const { governance, alice } = await loadFixture(readyToTickFixture);
            expect(await governance.hasVotedThisEpoch(alice.address)).to.be.true;
            await governance.tickEpoch();
            expect(await governance.hasVotedThisEpoch(alice.address)).to.be.false;
        });

        it("emits EpochTicked with winning proposal info", async () => {
            const { governance, mockFactory } = await loadFixture(readyToTickFixture);
            await expect(governance.tickEpoch())
                .to.emit(governance, "EpochTicked")
                .withArgs(1n, 0n, "Proposal A", await mockFactory.DUMMY_CHALLENGE(), ONE_ETH);
        });

        it("reverts if epoch has not yet ended", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await governance.setPrizePerEpoch(ONE_ETH);
            await governance.propose(PROPOSAL.title, PROPOSAL.description, 0, 30, 7, ONE_ETH);
            await expect(governance.tickEpoch()).to.be.revertedWith("Epoch not ended yet");
        });

        it("reverts if there are no proposals", async () => {
            const { governance } = await loadFixture(governanceFixture);
            await governance.setPrizePerEpoch(ONE_ETH);
            const epochEnd = await governance.currentEpochEnd();
            await time.increaseTo(epochEnd);
            await expect(governance.tickEpoch()).to.be.revertedWith("No proposals this epoch");
        });

        it("reverts if prizePerEpoch is not set", async () => {
            const { governance, reputation, alice } = await loadFixture(governanceFixture);
            await governance.propose(PROPOSAL.title, PROPOSAL.description, 0, 30, 7, ONE_ETH);
            await reputation.updateRep(alice.address, 100n, ethers.ZeroAddress);
            const epochEnd = await governance.currentEpochEnd();
            await time.increaseTo(epochEnd);
            await expect(governance.tickEpoch()).to.be.revertedWith("Prize pool per epoch not set");
        });
    });
});
