import { SecretsManager } from "@chainlink/functions-toolkit";
// functions-toolkit uses ethers v5 internally — must use v5 provider/signer
import { ethers as ethers5 } from "@chainlink/functions-toolkit/node_modules/ethers";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SEPOLIA_RPC_URL     = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY         = process.env.PRIVATE_KEY!;
const GEMINI_API_KEY      = process.env.GEMINI_API_KEY!;
const AI_ORACLE_VERIFIER  = process.env.AI_ORACLE_VERIFIER!;
const CL_FUNCTIONS_ROUTER = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
const DON_ID              = "fun-ethereum-sepolia-1";
const SLOT_ID             = 0;
const EXPIRATION_MINUTES  = 4320; // 3 days

const ACTIVATE_ABI = [
    "function setSecretsReference(uint8 slotId, uint64 version) external",
];

async function main() {
    if (!SEPOLIA_RPC_URL || !PRIVATE_KEY || !GEMINI_API_KEY) {
        throw new Error("Missing SEPOLIA_RPC_URL, PRIVATE_KEY or GEMINI_API_KEY in .env");
    }
    if (!AI_ORACLE_VERIFIER) {
        throw new Error("Missing AI_ORACLE_VERIFIER in .env");
    }

    // ── 1. Upload secrets to the DON (ethers v5 required by functions-toolkit) ──
    const provider5 = new ethers5.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const signer5   = new ethers5.Wallet(PRIVATE_KEY, provider5);

    console.log("Uploading secrets as:", signer5.address);

    const secretsManager = new SecretsManager({
        signer: signer5,
        functionsRouterAddress: CL_FUNCTIONS_ROUTER,
        donId: DON_ID,
    });
    await secretsManager.initialize();

    const { encryptedSecrets } = await secretsManager.encryptSecrets({ GEMINI_API_KEY });

    const { version, success } = await secretsManager.uploadEncryptedSecretsToDON({
        encryptedSecretsHexstring: encryptedSecrets,
        gatewayUrls: [
            "https://01.functions-gateway.testnet.chain.link/",
            "https://02.functions-gateway.testnet.chain.link/",
        ],
        slotId: SLOT_ID,
        minutesUntilExpiration: EXPIRATION_MINUTES,
    });

    if (!success) throw new Error("Secrets upload failed");

    console.log(`\nSecrets uploaded: slotId=${SLOT_ID} version=${version}`);

    // ── 2. Activate on AiOracleVerifier (ethers v6) ───────────────────────────
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
    const verifier = new ethers.Contract(AI_ORACLE_VERIFIER, ACTIVATE_ABI, signer);

    console.log(`\nActivating on AiOracleVerifier (${AI_ORACLE_VERIFIER})...`);
    const tx = await verifier.setSecretsReference(SLOT_ID, version);
    await tx.wait();

    console.log("Done. AiOracleVerifier secrets reference set.");
    console.log(`  tx: ${tx.hash}`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
