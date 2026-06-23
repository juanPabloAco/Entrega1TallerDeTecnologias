// Re-deploys JobMarketplace and MockERC20, leaving the existing Multisig
// and its 3 signers intact (their private keys are not needed and not used).
//
// Why: the marketplace is a stateful contract. Once a job is created, it
// stays in storage forever (you can move it through statuses but never
// remove it). To start fresh, deploy a new marketplace and update the env.
//
// Usage:
//   npx hardhat run scripts/redeploy-marketplace.ts --network sepolia
import { ethers, network } from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(__dirname, "..");
const SIGNERS_DOC = join(ROOT, "SIGNERS.md");
const FRONTEND_ENV = join(ROOT, "frontend", ".env");
const DEPLOY_MD = join(ROOT, "DEPLOY.md");

function extractField(doc: string, name: string): string | undefined {
  const re = new RegExp(`- ${name}:\\s+\`([^\`]+)\``);
  return doc.match(re)?.[1];
}

async function main() {
  const doc = readFileSync(SIGNERS_DOC, "utf8");
  const multisigAddress = extractField(doc, "Multisig");
  if (!multisigAddress) {
    throw new Error(`Could not find Multisig address in ${SIGNERS_DOC}`);
  }
  console.log(`Reusing Multisig at: ${multisigAddress}`);

  // Deploy fresh token.
  console.log("\nDeploying fresh MockERC20...");
  const TokenF = await ethers.getContractFactory("MockERC20");
  const erc20 = await TokenF.deploy("Mock USDC", "mUSDC", 6);
  await erc20.waitForDeployment();
  const tokenAddress = await erc20.getAddress();
  console.log(`Token:        ${tokenAddress}`);

  // Deploy fresh marketplace bound to the new token.
  console.log("\nDeploying fresh JobMarketplace...");
  const JMF = await ethers.getContractFactory("JobMarketplace");
  const marketplace = await JMF.deploy(tokenAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`Marketplace:  ${marketplaceAddress}`);

  if (network.name === "sepolia" && process.env.ETHERSCAN_API_KEY) {
    try {
      const { run } = await import("hardhat");
      await run("verify:verify", { address: tokenAddress, constructorArguments: ["Mock USDC", "mUSDC", 6] });
      await run("verify:verify", { address: marketplaceAddress, constructorArguments: [tokenAddress] });
      console.log("Verified on Etherscan.");
    } catch (e) {
      console.warn("Verification failed:", (e as Error).message);
    }
  }

  // Update frontend .env
  if (existsSync(FRONTEND_ENV)) {
    let env = readFileSync(FRONTEND_ENV, "utf8");
    env = env.replace(/VITE_MULTISIG_ADDRESS=0x[0-9a-fA-F]{40}/, `VITE_MULTISIG_ADDRESS=${multisigAddress}`);
    env = env.replace(/VITE_MARKETPLACE_ADDRESS=0x[0-9a-fA-F]{40}/, `VITE_MARKETPLACE_ADDRESS=${marketplaceAddress}`);
    env = env.replace(/VITE_TOKEN_ADDRESS=0x[0-9a-fA-F]{40}/, `VITE_TOKEN_ADDRESS=${tokenAddress}`);
    writeFileSync(FRONTEND_ENV, env, "utf8");
    console.log(`Updated ${FRONTEND_ENV}`);
  }

  // Update DEPLOY.md
  if (existsSync(DEPLOY_MD)) {
    let md = readFileSync(DEPLOY_MD, "utf8");
    const EXPLORER = "https://sepolia.etherscan.io";
    md = md.replace(
      /\| \*\*Multisig\*\* \| `0x[0-9a-fA-F]{40}` \| https:\/\/sepolia\.etherscan\.io\/address\/0x[0-9a-fA-F]{40} \|/,
      `| **Multisig** | \`${multisigAddress}\` | ${EXPLORER}/address/${multisigAddress} |`,
    );
    md = md.replace(
      /\| \*\*JobMarketplace\*\* \| `0x[0-9a-fA-F]{40}` \| https:\/\/sepolia\.etherscan\.io\/address\/0x[0-9a-fA-F]{40} \|/,
      `| **JobMarketplace** | \`${marketplaceAddress}\` | ${EXPLORER}/address/${marketplaceAddress} |`,
    );
    md = md.replace(
      /\| \*\*MockERC20 \(mUSDC\)\*\* \| `0x[0-9a-fA-F]{40}` \| https:\/\/sepolia\.etherscan\.io\/address\/0x[0-9a-fA-F]{40} \|/,
      `| **MockERC20 (mUSDC)** | \`${tokenAddress}\` | ${EXPLORER}/address/${tokenAddress} |`,
    );
    writeFileSync(DEPLOY_MD, md, "utf8");
    console.log(`Updated ${DEPLOY_MD}`);
  }

  // Update SIGNERS.md
  const newDoc = doc
    .replace(/- JobMarketplace:\s+`0x[0-9a-fA-F]{40}`/, `- JobMarketplace:  \`${marketplaceAddress}\``)
    .replace(/- Token \(MockERC20\):\s+`0x[0-9a-fA-F]{40}`/, `- Token (MockERC20): \`${tokenAddress}\``);
  writeFileSync(SIGNERS_DOC, newDoc, "utf8");
  console.log(`Updated ${SIGNERS_DOC}`);

  console.log("\n=== Summary ===");
  console.log(`Multisig (reused): ${multisigAddress}`);
  console.log(`Token (new):       ${tokenAddress}`);
  console.log(`Marketplace (new): ${marketplaceAddress}`);
  console.log("\nRefresh the browser (Ctrl+Shift+R) to pick up the new addresses.");
  console.log("Your signers still own the old marketplace; they now also control this one.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});