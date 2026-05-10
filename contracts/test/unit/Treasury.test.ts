import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { treasuryFixture, ONE_ETH, TWO_ETH } from "../helpers/deploy";

describe("Treasury", () => {

    // ── authorize / deauthorize ───────────────────────────────────────────────

    describe("authorize / deauthorize", () => {
        it("owner can authorize an address", async () => {
            const { treasury, owner, alice } = await loadFixture(treasuryFixture);
            await treasury.connect(owner).authorize(alice.address);
            await treasury.connect(owner).depositFee({ value: ONE_ETH });
            await expect(
                treasury.connect(alice).withdrawPrizePool(alice.address, ONE_ETH),
            ).to.not.be.reverted;
        });

        it("non-owner cannot authorize", async () => {
            const { treasury, alice, bob } = await loadFixture(treasuryFixture);
            await expect(
                treasury.connect(alice).authorize(bob.address),
            ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
        });

        it("reverts authorize for zero address", async () => {
            const { treasury, owner } = await loadFixture(treasuryFixture);
            await expect(
                treasury.connect(owner).authorize(ethers.ZeroAddress),
            ).to.be.revertedWith("Zero address");
        });

        it("owner can deauthorize a previously authorized address", async () => {
            const { treasury, owner, alice } = await loadFixture(treasuryFixture);
            await treasury.connect(owner).authorize(alice.address);
            await treasury.connect(owner).deauthorize(alice.address);
            await treasury.connect(owner).depositFee({ value: ONE_ETH });
            await expect(
                treasury.connect(alice).withdrawPrizePool(alice.address, ONE_ETH),
            ).to.be.revertedWith("Not authorized");
        });

        it("non-owner cannot deauthorize", async () => {
            const { treasury, alice } = await loadFixture(treasuryFixture);
            await expect(
                treasury.connect(alice).deauthorize(alice.address),
            ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
        });
    });

    // ── depositFee ────────────────────────────────────────────────────────────

    describe("depositFee", () => {
        it("increases prizePool by the sent amount", async () => {
            const { treasury } = await loadFixture(treasuryFixture);
            await treasury.depositFee({ value: ONE_ETH });
            expect(await treasury.prizePool()).to.equal(ONE_ETH);
        });

        it("accumulates across multiple deposits", async () => {
            const { treasury } = await loadFixture(treasuryFixture);
            await treasury.depositFee({ value: ONE_ETH });
            await treasury.depositFee({ value: TWO_ETH });
            expect(await treasury.prizePool()).to.equal(ONE_ETH + TWO_ETH);
        });

        it("emits FeeReceived and PrizePoolUpdated", async () => {
            const { treasury, owner } = await loadFixture(treasuryFixture);
            await expect(treasury.connect(owner).depositFee({ value: ONE_ETH }))
                .to.emit(treasury, "FeeReceived")
                .and.to.emit(treasury, "PrizePoolUpdated").withArgs(ONE_ETH);
        });

        it("reverts when 0 ETH is sent", async () => {
            const { treasury } = await loadFixture(treasuryFixture);
            await expect(treasury.depositFee({ value: 0n })).to.be.revertedWith("Must send some ether");
        });
    });

    // ── withdrawPrizePool ─────────────────────────────────────────────────────

    describe("withdrawPrizePool", () => {
        async function fundedTreasury() {
            const f = await treasuryFixture();
            await f.treasury.connect(f.owner).authorize(f.alice.address);
            await f.treasury.depositFee({ value: TWO_ETH });
            return f;
        }

        it("authorized address can withdraw ETH", async () => {
            const { treasury, alice } = await loadFixture(fundedTreasury);
            const before = await ethers.provider.getBalance(alice.address);
            const tx = await treasury.connect(alice).withdrawPrizePool(alice.address, ONE_ETH);
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
            const after = await ethers.provider.getBalance(alice.address);
            expect(after - before + gasUsed).to.equal(ONE_ETH);
        });

        it("decreases prizePool correctly", async () => {
            const { treasury, alice } = await loadFixture(fundedTreasury);
            await treasury.connect(alice).withdrawPrizePool(alice.address, ONE_ETH);
            expect(await treasury.prizePool()).to.equal(ONE_ETH);
        });

        it("emits PrizePoolWithdrawn and PrizePoolUpdated", async () => {
            const { treasury, alice } = await loadFixture(fundedTreasury);
            await expect(treasury.connect(alice).withdrawPrizePool(alice.address, ONE_ETH))
                .to.emit(treasury, "PrizePoolWithdrawn").withArgs(alice.address, ONE_ETH, ONE_ETH)
                .and.to.emit(treasury, "PrizePoolUpdated").withArgs(ONE_ETH);
        });

        it("reverts for non-authorized caller", async () => {
            const { treasury, bob } = await loadFixture(fundedTreasury);
            await expect(
                treasury.connect(bob).withdrawPrizePool(bob.address, ONE_ETH),
            ).to.be.revertedWith("Not authorized");
        });

        it("reverts for zero recipient address", async () => {
            const { treasury, alice } = await loadFixture(fundedTreasury);
            await expect(
                treasury.connect(alice).withdrawPrizePool(ethers.ZeroAddress, ONE_ETH),
            ).to.be.revertedWith("Zero address");
        });

        it("reverts when amount exceeds prizePool", async () => {
            const { treasury, alice } = await loadFixture(fundedTreasury);
            await expect(
                treasury.connect(alice).withdrawPrizePool(alice.address, ethers.parseEther("100")),
            ).to.be.revertedWith("Insufficient prize pool");
        });
    });

    // ── sweep ─────────────────────────────────────────────────────────────────

    describe("sweep", () => {
        it("owner sweeps entire balance and resets prizePool", async () => {
            const { treasury, owner, alice } = await loadFixture(treasuryFixture);
            await treasury.depositFee({ value: TWO_ETH });
            const before = await ethers.provider.getBalance(alice.address);
            await treasury.connect(owner).sweep(alice.address);
            const after = await ethers.provider.getBalance(alice.address);
            expect(after - before).to.equal(TWO_ETH);
            expect(await treasury.prizePool()).to.equal(0n);
        });

        it("reverts for non-owner", async () => {
            const { treasury, alice } = await loadFixture(treasuryFixture);
            await expect(
                treasury.connect(alice).sweep(alice.address),
            ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
        });

        it("reverts for zero recipient", async () => {
            const { treasury, owner } = await loadFixture(treasuryFixture);
            await expect(
                treasury.connect(owner).sweep(ethers.ZeroAddress),
            ).to.be.revertedWith("Zero address");
        });
    });
});
