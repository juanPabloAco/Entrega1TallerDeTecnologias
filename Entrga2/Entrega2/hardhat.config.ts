import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

// Treat placeholder values (e.g. from .env.example) as "not set" so hardhat
// doesn't try to use the literal "0xYOUR_DEPLOYER_PRIVATE_KEY" as a real key
// and fail with HH8 "private key too short".
const isPlaceholder = (v: string) =>
  !v ||
  v.toLowerCase().includes("your_") ||
  v.toLowerCase().includes("your-") ||
  v === "0x";

const isHexKey = (v: string) => /^0x[0-9a-fA-F]{64}$/.test(v.trim());

const validPrivateKey = isHexKey(PRIVATE_KEY) && !isPlaceholder(PRIVATE_KEY)
  ? PRIVATE_KEY.trim()
  : "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    // Only register the sepolia network when the deployer key is valid.
    // Otherwise `npx hardhat compile` and `npx hardhat test` fail with HH8
    // because hardhat parses every registered account.
    ...(validPrivateKey
      ? {
          sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [validPrivateKey],
            chainId: 11155111,
          },
        }
      : {}),
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
