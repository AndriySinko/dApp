import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

export const ONE_ETH = ethers.parseEther("1");
export const TWO_ETH = ethers.parseEther("2");

// Durations in seconds relative to deployment time
export const JOIN_WINDOW    = 3_600;  // 1 hour
export const ACTIVE_WINDOW  = 7_200;  // 2 hours (challengeDl = now + ACTIVE_WINDOW)

async function deployMocks() {
    const signers = await ethers.getSigners();
    const [owner, alice, bob, carol, dave] = signers;

    const verifier   = await (await ethers.getContractFactory("MockVerifier")).deploy();
    const reputation = await (await ethers.getContractFactory("MockReputation")).deploy();
    const treasury   = await (await ethers.getContractFactory("MockTreasury")).deploy();

    return { owner, alice, bob, carol, dave, verifier, reputation, treasury };
}

export async function individualFixture() {
    const mocks = await deployMocks();
    const { owner, verifier, reputation, treasury } = mocks;

    const now         = await time.latest();
    const joinDl      = now + JOIN_WINDOW;
    const challengeDl = now + ACTIVE_WINDOW;
    const buyIn       = ONE_ETH;

    const challenge = await (await ethers.getContractFactory("IndividualChallenge")).deploy(
        1n,
        owner.address,
        "Test Challenge",
        "evidence:5",
        joinDl,
        challengeDl,
        buyIn,
        0,                                  // VerifierType.OnChain
        await verifier.getAddress(),
        await reputation.getAddress(),
        await treasury.getAddress(),
        { value: buyIn },
    );

    return { ...mocks, challenge, joinDl, challengeDl, buyIn };
}

export async function groupFixture() {
    const mocks = await deployMocks();
    const { owner, verifier, reputation, treasury } = mocks;

    const now         = await time.latest();
    const joinDl      = now + JOIN_WINDOW;
    const challengeDl = now + ACTIVE_WINDOW;
    const buyIn       = ONE_ETH;

    const challenge = await (await ethers.getContractFactory("GroupChallenge")).deploy(
        2n,
        owner.address,
        "Group Test",
        "evidence:5",
        joinDl,
        challengeDl,
        buyIn,
        0,
        await verifier.getAddress(),
        await reputation.getAddress(),
        await treasury.getAddress(),
    );

    return { ...mocks, challenge, joinDl, challengeDl, buyIn };
}

export async function publicFixture() {
    const mocks = await deployMocks();
    const { owner, verifier, reputation, treasury } = mocks;

    const now         = await time.latest();
    const joinDl      = now + JOIN_WINDOW;
    const challengeDl = now + ACTIVE_WINDOW;
    const buyIn       = ONE_ETH;
    const prizePool   = TWO_ETH;

    const challenge = await (await ethers.getContractFactory("PublicChallenge")).deploy(
        3n,
        owner.address,
        "Public Test",
        "evidence:5",
        joinDl,
        challengeDl,
        buyIn,
        0,
        await verifier.getAddress(),
        await reputation.getAddress(),
        await treasury.getAddress(),
        { value: prizePool },
    );

    return { ...mocks, challenge, joinDl, challengeDl, buyIn, prizePool };
}

// Advance time to joinDl and trigger JoinOpen → Active transition.
export async function advanceToActive(challenge: any, joinDl: number) {
    await time.increaseTo(joinDl);
    await challenge.performUpkeep("0x");
}

// Advance time to challengeDl and trigger Active → VerifyPending (+ optional auto-settle).
export async function advanceToVerifyPending(challenge: any, joinDl: number, challengeDl: number) {
    await time.increaseTo(joinDl);
    await challenge.performUpkeep("0x");
    await time.increaseTo(challengeDl);
    await challenge.performUpkeep("0x");
}
