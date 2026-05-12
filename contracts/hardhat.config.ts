import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 1 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      // Set FORK_SEPOLIA=true to fork Sepolia for realistic integration tests.
      // npx cross-env FORK_SEPOLIA=true npx hardhat test test/fork/
      forking: process.env.FORK_SEPOLIA
        ? { url: process.env.SEPOLIA_RPC_URL || "", enabled: true }
        : undefined,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY
        ? [`0x${process.env.PRIVATE_KEY.replace(/^0x/i, "")}`]
        : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};

export default config;
