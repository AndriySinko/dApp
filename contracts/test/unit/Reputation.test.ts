import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { reputationFixture } from "../helpers/deploy";

describe("Reputation", () => {

    // ── authorize / revoke ────────────────────────────────────────────────────

    describe("authorize", () => {
        it("owner can authorize an address", async () => {
            const { reputation, owner, alice } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            // Verify authorization works by having alice call updateRep
            await expect(
                reputation.connect(alice).updateRep(alice.address, 10n, ethers.ZeroAddress),
            ).to.not.be.reverted;
        });

        it("authorized address cannot authorize another address", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            await expect(
                reputation.connect(alice).authorize(bob.address),
            ).to.be.revertedWithCustomError(reputation, "OwnableUnauthorizedAccount");
        });

        it("reverts when called by an unauthorized non-owner", async () => {
            const { reputation, alice, bob } = await loadFixture(reputationFixture);
            await expect(
                reputation.connect(alice).authorize(bob.address),
            ).to.be.revertedWithCustomError(reputation, "OwnableUnauthorizedAccount");
        });

        it("reverts for zero address", async () => {
            const { reputation, owner } = await loadFixture(reputationFixture);
            await expect(
                reputation.connect(owner).authorize(ethers.ZeroAddress),
            ).to.be.revertedWith("Zero address");
        });
    });

    describe("revoke", () => {
        it("owner can revoke an authorized address", async () => {
            const { reputation, owner, alice } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            await reputation.connect(owner).revoke(alice.address);
            await expect(
                reputation.connect(alice).updateRep(alice.address, 10n, ethers.ZeroAddress),
            ).to.be.revertedWith("Not authorized");
        });

        it("authorized-but-not-owner cannot revoke", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            await expect(
                reputation.connect(alice).revoke(bob.address),
            ).to.be.revertedWithCustomError(reputation, "OwnableUnauthorizedAccount");
        });
    });

    // ── updateRep ─────────────────────────────────────────────────────────────

    describe("updateRep", () => {
        it("authorized address can update a user's reputation", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            await reputation.connect(alice).updateRep(bob.address, 100n, ethers.ZeroAddress);
            expect(await reputation.getScore(bob.address)).to.equal(100n);
        });

        it("applies a negative delta (int256)", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            await reputation.connect(alice).updateRep(bob.address, 100n, ethers.ZeroAddress);
            await reputation.connect(alice).updateRep(bob.address, -50n, ethers.ZeroAddress);
            expect(await reputation.getScore(bob.address)).to.equal(50n);
        });

        it("accumulates multiple updates", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            await reputation.connect(alice).updateRep(bob.address, 100n, ethers.ZeroAddress);
            await reputation.connect(alice).updateRep(bob.address, 25n, ethers.ZeroAddress);
            await reputation.connect(alice).updateRep(bob.address, -50n, ethers.ZeroAddress);
            expect(await reputation.getScore(bob.address)).to.equal(75n);
        });

        it("emits ReputationUpdated with correct args", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            const challengeAddr = ethers.Wallet.createRandom().address;
            await expect(reputation.connect(alice).updateRep(bob.address, 100n, challengeAddr))
                .to.emit(reputation, "ReputationUpdated")
                .withArgs(bob.address, 100n, 100n, challengeAddr, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));
        });

        it("reverts when called by a non-authorized address", async () => {
            const { reputation, alice, bob } = await loadFixture(reputationFixture);
            await expect(
                reputation.connect(alice).updateRep(bob.address, 10n, ethers.ZeroAddress),
            ).to.be.revertedWith("Not authorized");
        });
    });

    // ── getScore ──────────────────────────────────────────────────────────────

    describe("getScore", () => {
        it("returns 0 for an address with no history", async () => {
            const { reputation, alice } = await loadFixture(reputationFixture);
            expect(await reputation.getScore(alice.address)).to.equal(0n);
        });

        it("score can go negative", async () => {
            const { reputation, owner, alice, bob } = await loadFixture(reputationFixture);
            await reputation.connect(owner).authorize(alice.address);
            await reputation.connect(alice).updateRep(bob.address, -50n, ethers.ZeroAddress);
            expect(await reputation.getScore(bob.address)).to.equal(-50n);
        });
    });
});
