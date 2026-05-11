import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Sepolia constants ─────────────────────────────────────────────────────────
const AUTOMATION_REGISTRY  = "0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad";
const LINK_TOKEN           = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const CL_FUNCTIONS_ROUTER  = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
// "fun-ethereum-sepolia-1" encoded as bytes32
const CL_DON_ID            = "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000";

const EPOCH_DURATION_SECS  = 7 * 24 * 60 * 60; // 1 week

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    console.log("Balance:       ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    const rawSubId = process.env.CHAINLINK_SUBSCRIPTION_ID ?? "";
    const subId    = /^\d+$/.test(rawSubId) ? BigInt(rawSubId) : 0n;
    if (subId === 0n) {
        console.warn("Warning: CHAINLINK_SUBSCRIPTION_ID not set — oracle verifiers will need setSubscriptionId() called post-deploy");
    }

    // ── 1. Core infrastructure ────────────────────────────────────────────────
    const Reputation = await ethers.getContractFactory("Reputation");
    const reputation = await Reputation.deploy(deployer.address);
    await reputation.waitForDeployment();
    console.log("Reputation:        ", await reputation.getAddress());

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(deployer.address);
    await treasury.waitForDeployment();
    console.log("Treasury:          ", await treasury.getAddress());

    // ── 2. Verifiers ──────────────────────────────────────────────────────────
    const OnChainVerifier = await ethers.getContractFactory("OnChainVerifier");
    const onChain = await OnChainVerifier.deploy();
    await onChain.waitForDeployment();
    console.log("OnChainVerifier:   ", await onChain.getAddress());

    const ApiOracleVerifier = await ethers.getContractFactory("ApiOracleVerifier");
    const apiOracle = await ApiOracleVerifier.deploy(
        CL_FUNCTIONS_ROUTER,
        deployer.address,
        subId,
        CL_DON_ID,
    );
    await apiOracle.waitForDeployment();
    console.log("ApiOracleVerifier: ", await apiOracle.getAddress());

    const AiOracleVerifier = await ethers.getContractFactory("AiOracleVerifier");
    const aiOracle = await AiOracleVerifier.deploy(
        CL_FUNCTIONS_ROUTER,
        deployer.address,
        subId,
        CL_DON_ID,
    );
    await aiOracle.waitForDeployment();
    console.log("AiOracleVerifier:  ", await aiOracle.getAddress());

    // ── 3. Upload JS sources to oracle verifiers ──────────────────────────────
    const functionsDir = path.join(__dirname, "..", "functions");

    const apiJs = fs.readFileSync(path.join(functionsDir, "apiVerifier.js"), "utf8");
    await (await apiOracle.setJsSource(apiJs)).wait();
    console.log("ApiOracleVerifier: JS source set");

    const aiJs = fs.readFileSync(path.join(functionsDir, "aiVerifier.js"), "utf8");
    await (await aiOracle.setJsSource(aiJs)).wait();
    console.log("AiOracleVerifier:  JS source set");

    // ── 4. Challenge deployers ─────────────────────────────────────────────────
    const IndividualChallengeDeployer = await ethers.getContractFactory("IndividualChallengeDeployer");
    const individualDeployer = await IndividualChallengeDeployer.deploy();
    await individualDeployer.waitForDeployment();
    console.log("IndividualDeployer:", await individualDeployer.getAddress());

    const GroupChallengeDeployer = await ethers.getContractFactory("GroupChallengeDeployer");
    const groupDeployer = await GroupChallengeDeployer.deploy();
    await groupDeployer.waitForDeployment();
    console.log("GroupDeployer:     ", await groupDeployer.getAddress());

    const PublicChallengeDeployer = await ethers.getContractFactory("PublicChallengeDeployer");
    const publicDeployer = await PublicChallengeDeployer.deploy();
    await publicDeployer.waitForDeployment();
    console.log("PublicDeployer:    ", await publicDeployer.getAddress());

    // ── 5. Factory ────────────────────────────────────────────────────────────
    const ChallengeFactory = await ethers.getContractFactory("ChallengeFactory");
    const factory = await ChallengeFactory.deploy(
        await reputation.getAddress(),
        await treasury.getAddress(),
        await onChain.getAddress(),
        await apiOracle.getAddress(),
        await aiOracle.getAddress(),
        AUTOMATION_REGISTRY,
        LINK_TOKEN,
        await individualDeployer.getAddress(),
        await groupDeployer.getAddress(),
        await publicDeployer.getAddress(),
    );
    await factory.waitForDeployment();
    console.log("ChallengeFactory:  ", await factory.getAddress());

    // Wire the factory address into each deployer (access-control guard: only factory can call deploy())
    await (await individualDeployer.initFactory(await factory.getAddress())).wait();
    await (await groupDeployer.initFactory(await factory.getAddress())).wait();
    await (await publicDeployer.initFactory(await factory.getAddress())).wait();
    console.log("Deployers: initFactory ✓");

    // ── 6. Governance ─────────────────────────────────────────────────────────
    const PublicGovernance = await ethers.getContractFactory("PublicGovernance");
    const governance = await PublicGovernance.deploy(
        await reputation.getAddress(),
        await treasury.getAddress(),
        await factory.getAddress(),
        LINK_TOKEN,
        EPOCH_DURATION_SECS,
        deployer.address,
    );
    await governance.waitForDeployment();
    console.log("PublicGovernance:  ", await governance.getAddress());

    // ── 7. Wire permissions ───────────────────────────────────────────────────
    // reputation.authorize(factory): factory calls reputation.authorize(challenge) for each new challenge
    // treasury.authorize(governance): tickEpoch calls treasury.withdrawPrizePool()
    console.log("\nConfiguring permissions...");
    await (await reputation.authorize(await factory.getAddress())).wait();
    console.log("reputation.authorize(factory) ✓");

    await (await treasury.authorize(await governance.getAddress())).wait();
    console.log("treasury.authorize(governance) ✓");

    await (await treasury.setFactory(await factory.getAddress())).wait();
    console.log("treasury.setFactory(factory) ✓");

    // ── 8. Register Chainlink Automation upkeep for governance ────────────────
    // Governance contract now implements checkUpkeep/performUpkeep so Chainlink
    // will automatically call tickEpoch() when each epoch ends.
    console.log("\nRegistering governance upkeep...");
    const GOVERNANCE_UPKEEP_FUNDING = ethers.parseEther("2"); // 2 LINK
    const linkContract = await ethers.getContractAt("IERC20", LINK_TOKEN);
    const linkBalance  = await linkContract.balanceOf(deployer.address);
    if (linkBalance >= GOVERNANCE_UPKEEP_FUNDING) {
        await (await linkContract.approve(AUTOMATION_REGISTRY, GOVERNANCE_UPKEEP_FUNDING)).wait();
        // Use same IAutomationRegistrar interface as ChallengeFactory
        const registrarAbi = [
            "function registerUpkeep(tuple(string name, bytes encryptedEmail, address upkeepContract, uint32 gasLimit, address adminAddress, uint8 triggerType, bytes checkData, bytes triggerConfig, bytes offchainConfig, uint96 amount) requestParams) external returns (uint256 id)"
        ];
        const registrar = new ethers.Contract(AUTOMATION_REGISTRY, registrarAbi, deployer);
        const tx = await registrar.registerUpkeep({
            name:           "PACT Governance tickEpoch",
            encryptedEmail: "0x",
            upkeepContract: await governance.getAddress(),
            gasLimit:       500000,
            adminAddress:   deployer.address,
            triggerType:    0,
            checkData:      "0x",
            triggerConfig:  "0x",
            offchainConfig: "0x",
            amount:         GOVERNANCE_UPKEEP_FUNDING,
        });
        await tx.wait();
        console.log("Governance upkeep registered ✓ (2 LINK funded)");
    } else {
        console.warn("Warning: insufficient LINK — register governance upkeep manually at automation.chain.link");
        console.warn(`  Contract to register: ${await governance.getAddress()}`);
    }

    // ── 9. Print .env.local block ─────────────────────────────────────────────
    console.log("\n# ── Paste into frontend/.env.local ──────────────────────────");
    console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${await factory.getAddress()}`);
    console.log(`NEXT_PUBLIC_GOVERNANCE_ADDRESS=${await governance.getAddress()}`);
    console.log(`NEXT_PUBLIC_TREASURY_ADDRESS=${await treasury.getAddress()}`);
    console.log(`NEXT_PUBLIC_REPUTATION_ADDRESS=${await reputation.getAddress()}`);
    console.log(`NEXT_PUBLIC_ONCHAIN_VERIFIER=${await onChain.getAddress()}`);
    console.log(`NEXT_PUBLIC_API_VERIFIER=${await apiOracle.getAddress()}`);
    console.log(`NEXT_PUBLIC_AI_VERIFIER=${await aiOracle.getAddress()}`);

    // ── 9. Print Etherscan verification commands ──────────────────────────────
    console.log("\n# ── Etherscan verification commands ─────────────────────────");
    console.log(`npx hardhat verify --network sepolia ${await reputation.getAddress()} "${deployer.address}"`);
    console.log(`npx hardhat verify --network sepolia ${await treasury.getAddress()} "${deployer.address}"`);
    console.log(`npx hardhat verify --network sepolia ${await onChain.getAddress()}`);
    console.log(`npx hardhat verify --network sepolia ${await apiOracle.getAddress()} "${CL_FUNCTIONS_ROUTER}" "${deployer.address}" ${subId} "${CL_DON_ID}"`);
    console.log(`npx hardhat verify --network sepolia ${await aiOracle.getAddress()} "${CL_FUNCTIONS_ROUTER}" "${deployer.address}" ${subId} "${CL_DON_ID}"`);
    console.log(`npx hardhat verify --network sepolia ${await individualDeployer.getAddress()}  # IndividualChallengeDeployer`);
    console.log(`npx hardhat verify --network sepolia ${await groupDeployer.getAddress()}  # GroupChallengeDeployer`);
    console.log(`npx hardhat verify --network sepolia ${await publicDeployer.getAddress()}  # PublicChallengeDeployer`);
    console.log(`npx hardhat verify --network sepolia ${await factory.getAddress()} "${await reputation.getAddress()}" "${await treasury.getAddress()}" "${await onChain.getAddress()}" "${await apiOracle.getAddress()}" "${await aiOracle.getAddress()}" "${AUTOMATION_REGISTRY}" "${LINK_TOKEN}" "${await individualDeployer.getAddress()}" "${await groupDeployer.getAddress()}" "${await publicDeployer.getAddress()}"`);
    console.log(`npx hardhat verify --network sepolia ${await governance.getAddress()} "${await reputation.getAddress()}" "${await treasury.getAddress()}" "${await factory.getAddress()}" "${LINK_TOKEN}" ${EPOCH_DURATION_SECS} "${deployer.address}"`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
