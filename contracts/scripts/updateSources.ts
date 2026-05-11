import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SEPOLIA_RPC_URL    = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY        = process.env.PRIVATE_KEY!;
const API_VERIFIER_ADDR  = process.env.API_VERIFIER  || "0x91f6A713883d9CC0eE54039B016708C1d4188f1f";
const AI_VERIFIER_ADDR   = process.env.AI_ORACLE_VERIFIER || "0x59e36b6081f94B3BB832c825e8d56997f7eB6D8E";

const ABI = [
    "function setJsSource(string calldata _jsSource) external",
    "function jsSource() external view returns (string)",
];

async function main() {
    if (!SEPOLIA_RPC_URL || !PRIVATE_KEY) throw new Error("Missing SEPOLIA_RPC_URL or PRIVATE_KEY in .env");

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const signer   = new ethers.Wallet(PRIVATE_KEY, provider);

    const functionsDir = path.join(__dirname, "..", "functions");
    const apiJs = fs.readFileSync(path.join(functionsDir, "apiVerifier.js"), "utf8");
    const aiJs  = fs.readFileSync(path.join(functionsDir, "aiVerifier.js"),  "utf8");

    console.log("Updating JS sources on deployed verifiers...");
    console.log("Signer:", signer.address);

    // Update ApiOracleVerifier
    const apiVerifier = new ethers.Contract(API_VERIFIER_ADDR, ABI, signer);
    console.log("\nUpdating ApiOracleVerifier (" + API_VERIFIER_ADDR + ")...");
    const tx1 = await apiVerifier.setJsSource(apiJs);
    await tx1.wait();
    console.log("ApiOracleVerifier JS source updated ✓  tx:", tx1.hash);

    // Update AiOracleVerifier
    const aiVerifier = new ethers.Contract(AI_VERIFIER_ADDR, ABI, signer);
    console.log("\nUpdating AiOracleVerifier (" + AI_VERIFIER_ADDR + ")...");
    const tx2 = await aiVerifier.setJsSource(aiJs);
    await tx2.wait();
    console.log("AiOracleVerifier JS source updated ✓  tx:", tx2.hash);

    console.log("\nDone. Both verifiers now run the expression engine v2.");
    console.log("No redeployment needed — changes are live immediately.");
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
