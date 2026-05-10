import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { IndividualChallenge__factory, GroupChallenge__factory, PublicChallenge__factory } from "../../typechain-types";
import { factoryFixture, ONE_ETH, TWO_ETH, JOIN_WINDOW, ACTIVE_WINDOW } from "../helpers/deploy";

// Build valid deadline pair relative to current block time.
async function deadlines() {
    const now = await time.latest();
    return { joinDl: now + JOIN_WINDOW, challengeDl: now + ACTIVE_WINDOW };
}

describe("ChallengeFactory", () => {

    // ── createChallenge — Individual ──────────────────────────────────────────

    describe("createChallenge — Individual", () => {
        it("deploys a JoinOpen IndividualChallenge and records it", async () => {
            const { factory, owner } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();

            await factory.connect(owner).createChallenge(
                0,                  // ChallengeType.Individual
                0,                  // VerifierType.OnChain
                "My Goal", "evidence:10",
                joinDl, challengeDl, ONE_ETH,
                { value: ONE_ETH },
            );

            const all = await factory.getAllChallenges();
            expect(all.length).to.equal(1);
            const challenge = IndividualChallenge__factory.connect(all[0], owner);
            expect(await challenge.state()).to.equal(0);         // JoinOpen
            expect(await challenge.buyIn()).to.equal(ONE_ETH);
            expect(await challenge.creator()).to.equal(owner.address);
        });

        it("getChallengeInfo returns correct metadata", async () => {
            const { factory, owner } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();

            await factory.createChallenge(
                0, 0, "My Goal", "evidence:10",
                joinDl, challengeDl, ONE_ETH,
                { value: ONE_ETH },
            );

            const all = await factory.getAllChallenges();
            const [id, type, verifier, creator, title] = await factory.getChallengeInfo(all[0]);
            expect(id).to.equal(0n);
            expect(type).to.equal(0n);     // Individual
            expect(verifier).to.equal(0n); // OnChain
            expect(creator).to.equal(owner.address);
            expect(title).to.equal("My Goal");
        });

        it("registers the challenge under the creator's address", async () => {
            const { factory, owner } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();

            await factory.createChallenge(
                0, 0, "My Goal", "evidence:10",
                joinDl, challengeDl, ONE_ETH,
                { value: ONE_ETH },
            );

            const all = await factory.getAllChallenges();
            const userChallenges = await factory.getUserChallenges(owner.address);
            expect(userChallenges[0]).to.equal(all[0]);
        });

        it("nextId increments with each new challenge", async () => {
            const { factory, owner } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();

            await factory.createChallenge(0, 0, "A", "C", joinDl, challengeDl, ONE_ETH, { value: ONE_ETH });

            const { joinDl: jd2, challengeDl: cd2 } = await deadlines();
            await factory.createChallenge(0, 0, "B", "C", jd2, cd2, ONE_ETH, { value: ONE_ETH });

            const all = await factory.getAllChallenges();
            const [id0] = await factory.getChallengeInfo(all[0]);
            const [id1] = await factory.getChallengeInfo(all[1]);
            expect(id0).to.equal(0n);
            expect(id1).to.equal(1n);
        });

        it("emits ChallengeCreated with correct fields", async () => {
            const { factory, owner } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();

            await expect(
                factory.createChallenge(
                    0, 0, "My Goal", "evidence:10",
                    joinDl, challengeDl, ONE_ETH,
                    { value: ONE_ETH },
                ),
            ).to.emit(factory, "ChallengeCreated")
             .withArgs(0n, anyValue, owner.address, 0n, 0n, "My Goal", "evidence:10", ONE_ETH, joinDl, challengeDl);
        });

        it("reverts when msg.value != buyIn", async () => {
            const { factory } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();
            await expect(
                factory.createChallenge(0, 0, "T", "C", joinDl, challengeDl, ONE_ETH, { value: TWO_ETH }),
            ).to.be.revertedWith("Creator must stake buy-in for Individual challenge");
        });
    });

    // ── createChallenge — Group ───────────────────────────────────────────────

    describe("createChallenge — Group", () => {
        it("deploys a JoinOpen GroupChallenge with no initial stake", async () => {
            const { factory, owner } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();

            await factory.connect(owner).createChallenge(
                1, 0, "Group Goal", "evidence:5",
                joinDl, challengeDl, ONE_ETH,
                { value: 0n },
            );

            const all = await factory.getAllChallenges();
            const challenge = GroupChallenge__factory.connect(all[0], owner);
            expect(await challenge.state()).to.equal(0);
            expect((await challenge.participants()).length).to.equal(0);
        });

        it("reverts when msg.value > 0 for Group type", async () => {
            const { factory } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();
            await expect(
                factory.createChallenge(1, 0, "T", "C", joinDl, challengeDl, ONE_ETH, { value: ONE_ETH }),
            ).to.be.revertedWith("No initial stake for Group challenges");
        });
    });

    // ── createChallenge — Public ──────────────────────────────────────────────

    describe("createChallenge — Public", () => {
        it("deploys a JoinOpen PublicChallenge and holds prize pool ETH", async () => {
            const { factory, owner } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();

            await factory.connect(owner).createChallenge(
                2, 0, "Public Goal", "evidence:5",
                joinDl, challengeDl, ONE_ETH,
                { value: TWO_ETH },
            );

            const all = await factory.getAllChallenges();
            const challenge = PublicChallenge__factory.connect(all[0], owner);
            expect(await challenge.state()).to.equal(0);
            expect(await challenge.prizePool()).to.equal(TWO_ETH);
        });

        it("reverts when no prize ETH is sent for Public type", async () => {
            const { factory } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();
            await expect(
                factory.createChallenge(2, 0, "T", "C", joinDl, challengeDl, ONE_ETH, { value: 0n }),
            ).to.be.revertedWith("Must send prize pool ETH for Public challenge");
        });
    });

    // ── Deadline validation ───────────────────────────────────────────────────

    describe("deadline validation", () => {
        it("reverts when joinDeadline is in the past", async () => {
            const { factory } = await loadFixture(factoryFixture);
            const now = await time.latest();
            await expect(
                factory.createChallenge(1, 0, "T", "C", now - 1, now + 3600, ONE_ETH, { value: 0n }),
            ).to.be.revertedWith("Join deadline must be in the future");
        });

        it("reverts when challengeDeadline is in the past", async () => {
            const { factory } = await loadFixture(factoryFixture);
            const now = await time.latest();
            await expect(
                factory.createChallenge(1, 0, "T", "C", now + 100, now - 1, ONE_ETH, { value: 0n }),
            ).to.be.revertedWith("Challenge deadline must be in the future");
        });

        it("reverts when joinDeadline >= challengeDeadline", async () => {
            const { factory } = await loadFixture(factoryFixture);
            const now = await time.latest();
            await expect(
                factory.createChallenge(1, 0, "T", "C", now + 3600, now + 3600, ONE_ETH, { value: 0n }),
            ).to.be.revertedWith("Join deadline must be before challenge deadline");
        });
    });

    // ── Registry view functions ───────────────────────────────────────────────

    describe("registry", () => {
        it("getAllChallenges returns empty before any challenge", async () => {
            const { factory } = await loadFixture(factoryFixture);
            expect((await factory.getAllChallenges()).length).to.equal(0);
        });

        it("getUserChallenges is empty before any challenge from that user", async () => {
            const { factory, alice } = await loadFixture(factoryFixture);
            expect((await factory.getUserChallenges(alice.address)).length).to.equal(0);
        });

        it("different creators each appear in their own userChallenges list", async () => {
            const { factory, owner, alice } = await loadFixture(factoryFixture);
            const { joinDl, challengeDl } = await deadlines();
            await factory.connect(owner).createChallenge(0, 0, "A", "C", joinDl, challengeDl, ONE_ETH, { value: ONE_ETH });

            const { joinDl: jd2, challengeDl: cd2 } = await deadlines();
            await factory.connect(alice).createChallenge(0, 0, "B", "C", jd2, cd2, ONE_ETH, { value: ONE_ETH });

            expect((await factory.getUserChallenges(owner.address)).length).to.equal(1);
            expect((await factory.getUserChallenges(alice.address)).length).to.equal(1);
            expect((await factory.getAllChallenges()).length).to.equal(2);
        });
    });
});
