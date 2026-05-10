import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
    IndividualChallengeDeployer__factory,
    GroupChallengeDeployer__factory,
    PublicChallengeDeployer__factory,
} from "../../typechain-types";
import { deployersFixture, ONE_ETH, TWO_ETH, JOIN_WINDOW, ACTIVE_WINDOW } from "../helpers/deploy";

// Helper: standard challenge args for all deployer.deploy() calls.
async function challengeArgs(verifier: string, reputation: string, treasury: string) {
    const now = await time.latest();
    return {
        id:           1n,
        creator:      ethers.Wallet.createRandom().address,
        title:        "Test",
        criteria:     "evidence:1",
        joinDl:       now + JOIN_WINDOW,
        challengeDl:  now + ACTIVE_WINDOW,
        buyIn:        ONE_ETH,
        vType:        0,          // VerifierType.OnChain
        vAddress:     verifier,
        repAddress:   reputation,
        treasAddress: treasury,
    };
}

describe("Challenge Deployers", () => {

    // ── IndividualChallengeDeployer ───────────────────────────────────────────

    describe("IndividualChallengeDeployer", () => {
        describe("initFactory", () => {
            it("owner can set factory address", async () => {
                const { owner, alice } = await loadFixture(deployersFixture);
                const d = await new IndividualChallengeDeployer__factory(owner).deploy();
                await d.initFactory(alice.address);
                expect(await d.factory()).to.equal(alice.address);
            });

            it("reverts when called by non-owner", async () => {
                const { owner, alice, bob } = await loadFixture(deployersFixture);
                const d = await new IndividualChallengeDeployer__factory(owner).deploy();
                await expect(d.connect(alice).initFactory(bob.address)).to.be.revertedWith("Only owner");
            });

            it("reverts on second call (already set)", async () => {
                const { owner, alice, bob } = await loadFixture(deployersFixture);
                const d = await new IndividualChallengeDeployer__factory(owner).deploy();
                await d.initFactory(alice.address);
                await expect(d.initFactory(bob.address)).to.be.revertedWith("Already set");
            });

            it("reverts for zero address", async () => {
                const { owner } = await loadFixture(deployersFixture);
                const d = await new IndividualChallengeDeployer__factory(owner).deploy();
                await expect(d.initFactory(ethers.ZeroAddress)).to.be.revertedWith("Zero address");
            });
        });

        describe("deploy", () => {
            it("only the factory address can call deploy", async () => {
                const { owner, alice, verifier, reputation, treasury } = await loadFixture(deployersFixture);
                const d = await new IndividualChallengeDeployer__factory(owner).deploy();
                await d.initFactory(owner.address); // owner acts as factory

                const args = await challengeArgs(
                    await verifier.getAddress(),
                    await reputation.getAddress(),
                    await treasury.getAddress(),
                );
                await expect(
                    d.connect(alice).deploy(
                        args.id, args.creator, args.title, args.criteria,
                        args.joinDl, args.challengeDl, args.buyIn,
                        args.vType, args.vAddress, args.repAddress, args.treasAddress,
                        { value: ONE_ETH },
                    ),
                ).to.be.revertedWith("Only factory");
            });

            it("deploys a live IndividualChallenge contract", async () => {
                const { owner, verifier, reputation, treasury } = await loadFixture(deployersFixture);
                const d = await new IndividualChallengeDeployer__factory(owner).deploy();
                await d.initFactory(owner.address);

                const args = await challengeArgs(
                    await verifier.getAddress(),
                    await reputation.getAddress(),
                    await treasury.getAddress(),
                );
                const addr = await d.deploy.staticCall(
                    args.id, args.creator, args.title, args.criteria,
                    args.joinDl, args.challengeDl, args.buyIn,
                    args.vType, args.vAddress, args.repAddress, args.treasAddress,
                    { value: ONE_ETH },
                );
                await d.deploy(
                    args.id, args.creator, args.title, args.criteria,
                    args.joinDl, args.challengeDl, args.buyIn,
                    args.vType, args.vAddress, args.repAddress, args.treasAddress,
                    { value: ONE_ETH },
                );
                expect(await ethers.provider.getCode(addr)).to.not.equal("0x");
            });
        });
    });

    // ── GroupChallengeDeployer ────────────────────────────────────────────────

    describe("GroupChallengeDeployer", () => {
        describe("initFactory", () => {
            it("owner can set factory once", async () => {
                const { owner, alice } = await loadFixture(deployersFixture);
                const d = await new GroupChallengeDeployer__factory(owner).deploy();
                await d.initFactory(alice.address);
                expect(await d.factory()).to.equal(alice.address);
            });

            it("reverts on second call", async () => {
                const { owner, alice, bob } = await loadFixture(deployersFixture);
                const d = await new GroupChallengeDeployer__factory(owner).deploy();
                await d.initFactory(alice.address);
                await expect(d.initFactory(bob.address)).to.be.revertedWith("Already set");
            });

            it("non-owner cannot call initFactory", async () => {
                const { owner, alice, bob } = await loadFixture(deployersFixture);
                const d = await new GroupChallengeDeployer__factory(owner).deploy();
                await expect(d.connect(alice).initFactory(bob.address)).to.be.revertedWith("Only owner");
            });
        });

        describe("deploy", () => {
            it("reverts when not called by factory", async () => {
                const { owner, alice, verifier, reputation, treasury } = await loadFixture(deployersFixture);
                const d = await new GroupChallengeDeployer__factory(owner).deploy();
                await d.initFactory(owner.address);

                const args = await challengeArgs(
                    await verifier.getAddress(),
                    await reputation.getAddress(),
                    await treasury.getAddress(),
                );
                await expect(
                    d.connect(alice).deploy(
                        args.id, args.creator, args.title, args.criteria,
                        args.joinDl, args.challengeDl, args.buyIn,
                        args.vType, args.vAddress, args.repAddress, args.treasAddress,
                    ),
                ).to.be.revertedWith("Only factory");
            });

            it("deploys a live GroupChallenge contract", async () => {
                const { owner, verifier, reputation, treasury } = await loadFixture(deployersFixture);
                const d = await new GroupChallengeDeployer__factory(owner).deploy();
                await d.initFactory(owner.address);

                const args = await challengeArgs(
                    await verifier.getAddress(),
                    await reputation.getAddress(),
                    await treasury.getAddress(),
                );
                const addr = await d.deploy.staticCall(
                    args.id, args.creator, args.title, args.criteria,
                    args.joinDl, args.challengeDl, args.buyIn,
                    args.vType, args.vAddress, args.repAddress, args.treasAddress,
                );
                await d.deploy(
                    args.id, args.creator, args.title, args.criteria,
                    args.joinDl, args.challengeDl, args.buyIn,
                    args.vType, args.vAddress, args.repAddress, args.treasAddress,
                );
                expect(await ethers.provider.getCode(addr)).to.not.equal("0x");
            });
        });
    });

    // ── PublicChallengeDeployer ───────────────────────────────────────────────

    describe("PublicChallengeDeployer", () => {
        describe("initFactory", () => {
            it("owner can set factory once", async () => {
                const { owner, alice } = await loadFixture(deployersFixture);
                const d = await new PublicChallengeDeployer__factory(owner).deploy();
                await d.initFactory(alice.address);
                expect(await d.factory()).to.equal(alice.address);
            });

            it("reverts on second call", async () => {
                const { owner, alice, bob } = await loadFixture(deployersFixture);
                const d = await new PublicChallengeDeployer__factory(owner).deploy();
                await d.initFactory(alice.address);
                await expect(d.initFactory(bob.address)).to.be.revertedWith("Already set");
            });
        });

        describe("deploy", () => {
            it("reverts when not called by factory", async () => {
                const { owner, alice, verifier, reputation, treasury } = await loadFixture(deployersFixture);
                const d = await new PublicChallengeDeployer__factory(owner).deploy();
                await d.initFactory(owner.address);

                const args = await challengeArgs(
                    await verifier.getAddress(),
                    await reputation.getAddress(),
                    await treasury.getAddress(),
                );
                await expect(
                    d.connect(alice).deploy(
                        args.id, args.creator, args.title, args.criteria,
                        args.joinDl, args.challengeDl, args.buyIn,
                        args.vType, args.vAddress, args.repAddress, args.treasAddress,
                        { value: TWO_ETH },
                    ),
                ).to.be.revertedWith("Only factory");
            });

            it("deploys a live PublicChallenge and forwards prize pool ETH", async () => {
                const { owner, verifier, reputation, treasury } = await loadFixture(deployersFixture);
                const d = await new PublicChallengeDeployer__factory(owner).deploy();
                await d.initFactory(owner.address);

                const args = await challengeArgs(
                    await verifier.getAddress(),
                    await reputation.getAddress(),
                    await treasury.getAddress(),
                );
                const addr = await d.deploy.staticCall(
                    args.id, args.creator, args.title, args.criteria,
                    args.joinDl, args.challengeDl, args.buyIn,
                    args.vType, args.vAddress, args.repAddress, args.treasAddress,
                    { value: TWO_ETH },
                );
                await d.deploy(
                    args.id, args.creator, args.title, args.criteria,
                    args.joinDl, args.challengeDl, args.buyIn,
                    args.vType, args.vAddress, args.repAddress, args.treasAddress,
                    { value: TWO_ETH },
                );
                expect(await ethers.provider.getCode(addr)).to.not.equal("0x");
                // Prize pool ETH is held by the deployed challenge
                expect(await ethers.provider.getBalance(addr)).to.equal(TWO_ETH);
            });
        });
    });
});
