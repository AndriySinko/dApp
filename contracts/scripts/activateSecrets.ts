import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const AI_ORACLE_VERIFIER = process.env.AI_ORACLE_VERIFIER!;

async function main() {
    const slotId  = parseInt(process.argv[2]);
    const version = parseInt(process.argv[3]);

    if (isNaN(slotId) || isNaN(version)) {
        throw new Error("Usage: npx ts-node scripts/activateSecrets.ts <slotId> <version>");
    }

    if (!AI_ORACLE_VERIFIER) {
        throw new Error("Set AI_ORACLE_VERIFIER in .env");
    }

    const [deployer] = await ethers.getSigners();
    const verifier = await ethers.getContractAt("AiOracleVerifier", AI_ORACLE_VERIFIER, deployer);

    console.log(`Setting secrets reference: slot=${slotId} version=${version}`);
    await (await verifier.setSecretsReference(slotId, version)).wait();
    console.log("Done. AiOracleVerifier secrets reference updated.");
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
