import { SecretsManager } from "@chainlink/functions-toolkit";
// functions-toolkit uses ethers v5 internally — must use v5 provider/signer
import { ethers } from "@chainlink/functions-toolkit/node_modules/ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SEPOLIA_RPC_URL      = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY          = process.env.PRIVATE_KEY!;
const GEMINI_API_KEY       = process.env.GEMINI_API_KEY!;
const CL_FUNCTIONS_ROUTER  = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
const DON_ID               = "fun-ethereum-sepolia-1";
const SLOT_ID              = 0;   // DON-hosted secrets slot (0–9)
const EXPIRATION_MINUTES   = 4320; // 3 days

async function main() {
    if (!SEPOLIA_RPC_URL || !PRIVATE_KEY || !GEMINI_API_KEY) {
        throw new Error("Missing SEPOLIA_RPC_URL, PRIVATE_KEY or GEMINI_API_KEY in .env");
    }

    const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const signer   = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Uploading secrets as:", signer.address);

    const secretsManager = new SecretsManager({
        signer,
        functionsRouterAddress: CL_FUNCTIONS_ROUTER,
        donId: DON_ID,
    });
    await secretsManager.initialize();

    const { version, success } = await secretsManager.uploadEncryptedSecretsToDON({
        encryptedSecretsHexstring: await secretsManager.encryptSecrets({
            GEMINI_API_KEY,
        }),
        gatewayUrls: await secretsManager.getSecretsDONPublicKey(),
        slotId:  SLOT_ID,
        minutesUntilExpiration: EXPIRATION_MINUTES,
    });

    if (!success) throw new Error("Secrets upload failed");

    console.log("\nSecrets uploaded successfully:");
    console.log(`  slotId:  ${SLOT_ID}`);
    console.log(`  version: ${version}`);
    console.log("\nCall on AiOracleVerifier:");
    console.log(`  aiOracle.setSecretsReference(${SLOT_ID}, ${version})`);
    console.log("\nOr run:");
    console.log(`  npx ts-node scripts/activateSecrets.ts ${SLOT_ID} ${version}`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
