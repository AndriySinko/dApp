import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    IndividualChallenge__factory,
    GroupChallenge__factory,
    PublicChallenge__factory,
    MockVerifier__factory,
    MockReputation__factory,
    MockTreasury__factory,
    MockERC20__factory,
    MockAutomationRegistrar__factory,
    MockFactory__factory,
    MockChallenge__factory,
    MockFunctionsRouter__factory,
    MockERC20Balance__factory,
    MockERC721__factory,
    Reputation__factory,
    Treasury__factory,
    IndividualChallengeDeployer__factory,
    GroupChallengeDeployer__factory,
    PublicChallengeDeployer__factory,
    ChallengeFactory__factory,
    PublicGovernance__factory,
    OnChainVerifier__factory,
    ApiOracleVerifier__factory,
    AiOracleVerifier__factory,
} from "../../typechain-types";

export const ONE_ETH = ethers.parseEther("1");
export const TWO_ETH = ethers.parseEther("2");

// Durations in seconds relative to deployment time
export const JOIN_WINDOW   = 3_600;  // 1 hour
export const ACTIVE_WINDOW = 7_200;  // 2 hours (challengeDl = now + ACTIVE_WINDOW)

async function deployMocks() {
    const [owner, alice, bob, carol, dave] = await ethers.getSigners();

    const verifier   = await new MockVerifier__factory(owner).deploy();
    const reputation = await new MockReputation__factory(owner).deploy();
    const treasury   = await new MockTreasury__factory(owner).deploy();

    return { owner, alice, bob, carol, dave, verifier, reputation, treasury };
}

export async function individualFixture() {
    const mocks = await deployMocks();
    const { owner, verifier, reputation, treasury } = mocks;

    const now         = await time.latest();
    const joinDl      = now + JOIN_WINDOW;
    const challengeDl = now + ACTIVE_WINDOW;
    const buyIn       = ONE_ETH;

    const challenge = await new IndividualChallenge__factory(owner).deploy(
        1n,
        owner.address,
        "Test Challenge",
        "evidence:5",
        joinDl,
        challengeDl,
        buyIn,
        0,                               // VerifierType.OnChain
        await verifier.getAddress(),
        await reputation.getAddress(),
        await treasury.getAddress(),
        owner.address,                   // factory = owner in tests
        { value: buyIn },
    );

    await challenge.connect(owner).setUpkeepRegistered();
    return { ...mocks, challenge, joinDl, challengeDl, buyIn };
}

export async function groupFixture() {
    const mocks = await deployMocks();
    const { owner, verifier, reputation, treasury } = mocks;

    const now         = await time.latest();
    const joinDl      = now + JOIN_WINDOW;
    const challengeDl = now + ACTIVE_WINDOW;
    const buyIn       = ONE_ETH;

    const challenge = await new GroupChallenge__factory(owner).deploy(
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
        owner.address,                   // factory = owner in tests
    );
    await challenge.connect(owner).setUpkeepRegistered();

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

    const challenge = await new PublicChallenge__factory(owner).deploy(
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
        owner.address,                   // factory = owner in tests
        { value: prizePool },
    );
    await challenge.connect(owner).setUpkeepRegistered();

    return { ...mocks, challenge, joinDl, challengeDl, buyIn, prizePool };
}

// ── Core fixtures ─────────────────────────────────────────────────────────────

export async function reputationFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const reputation = await new Reputation__factory(owner).deploy(owner.address);
    return { owner, alice, bob, reputation };
}

export async function treasuryFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const treasury = await new Treasury__factory(owner).deploy(owner.address);
    await treasury.connect(owner).authorize(owner.address);
    return { owner, alice, bob, treasury };
}

export async function deployersFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const verifier   = await new MockVerifier__factory(owner).deploy();
    const reputation = await new MockReputation__factory(owner).deploy();
    const treasury   = await new MockTreasury__factory(owner).deploy();

    const indivDeployer  = await new IndividualChallengeDeployer__factory(owner).deploy();
    const groupDeployer  = await new GroupChallengeDeployer__factory(owner).deploy();
    const publicDeployer = await new PublicChallengeDeployer__factory(owner).deploy();

    return { owner, alice, bob, verifier, reputation, treasury, indivDeployer, groupDeployer, publicDeployer };
}

export async function factoryFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const verifier   = await new MockVerifier__factory(owner).deploy();
    const reputation = await new MockReputation__factory(owner).deploy();
    const treasury   = await new MockTreasury__factory(owner).deploy();
    const link       = await new MockERC20__factory(owner).deploy();
    const registrar  = await new MockAutomationRegistrar__factory(owner).deploy();

    const indivDeployer  = await new IndividualChallengeDeployer__factory(owner).deploy();
    const groupDeployer  = await new GroupChallengeDeployer__factory(owner).deploy();
    const publicDeployer = await new PublicChallengeDeployer__factory(owner).deploy();

    const factory = await new ChallengeFactory__factory(owner).deploy(
        await reputation.getAddress(),
        await treasury.getAddress(),
        await verifier.getAddress(),
        await verifier.getAddress(),
        await verifier.getAddress(),
        await registrar.getAddress(),
        await link.getAddress(),
        await indivDeployer.getAddress(),
        await groupDeployer.getAddress(),
        await publicDeployer.getAddress(),
    );

    await indivDeployer.initFactory(await factory.getAddress());
    await groupDeployer.initFactory(await factory.getAddress());
    await publicDeployer.initFactory(await factory.getAddress());

    return { owner, alice, bob, factory, verifier, reputation, treasury, link, registrar };
}

export const EPOCH_DURATION = 3_600; // 1 hour

export async function governanceFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const reputation = await new MockReputation__factory(owner).deploy();
    const treasury   = await new MockTreasury__factory(owner).deploy();
    const mockFactory = await new MockFactory__factory(owner).deploy();
    const link       = await new MockERC20__factory(owner).deploy();

    // Seed treasury with ETH so withdrawPrizePool can transfer to governance
    await owner.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("10") });

    const governance = await new PublicGovernance__factory(owner).deploy(
        await reputation.getAddress(),
        await treasury.getAddress(),
        await mockFactory.getAddress(),
        await link.getAddress(),
        EPOCH_DURATION,
        owner.address,
    );

    return { owner, alice, bob, governance, reputation, treasury, mockFactory, link };
}

// Advance time to joinDl and trigger JoinOpen → Active transition.
export async function advanceToActive(challenge: { performUpkeep: (data: string) => Promise<unknown> }, joinDl: number) {
    await time.increaseTo(joinDl);
    await challenge.performUpkeep("0x");
}

// Advance time to challengeDl and trigger Active → VerifyPending (+ optional auto-settle).
export async function advanceToVerifyPending(
    challenge: { performUpkeep: (data: string) => Promise<unknown> },
    joinDl: number,
    challengeDl: number,
) {
    await time.increaseTo(joinDl);
    await challenge.performUpkeep("0x");
    await time.increaseTo(challengeDl);
    await challenge.performUpkeep("0x");
}

// ── Verifier fixtures ─────────────────────────────────────────────────────────

export async function onChainVerifierFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const verifier  = await new OnChainVerifier__factory(owner).deploy();
    const challenge = await new MockChallenge__factory(owner).deploy(0, 9_999_999_999);
    const erc20     = await new MockERC20Balance__factory(owner).deploy();
    const erc721    = await new MockERC721__factory(owner).deploy();
    return { owner, alice, bob, verifier, challenge, erc20, erc721 };
}

export async function apiOracleVerifierFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const router   = await new MockFunctionsRouter__factory(owner).deploy();
    const verifier = await new ApiOracleVerifier__factory(owner).deploy(
        await router.getAddress(), owner.address, 1n, ethers.ZeroHash,
    );
    const challenge = await new MockChallenge__factory(owner).deploy(0, 9_999_999_999);
    return { owner, alice, bob, verifier, router, challenge };
}

export async function aiOracleVerifierFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const now      = await time.latest();
    const router   = await new MockFunctionsRouter__factory(owner).deploy();
    const verifier = await new AiOracleVerifier__factory(owner).deploy(
        await router.getAddress(), owner.address, 1n, ethers.ZeroHash,
    );
    // joinDeadline = now, challengeDeadline = now + 30 days
    const challenge = await new MockChallenge__factory(owner).deploy(now, now + 30 * 86_400);
    await verifier.setSecretsReference(0, 1n); // slotId=0, version=1
    return { owner, alice, bob, verifier, router, challenge };
}
