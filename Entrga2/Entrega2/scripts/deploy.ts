// Deploys the full Job Marketplace stack to the configured network:
//   1. MockERC20  (test/demo token, 6 decimals, mints initial supply to deployer)
//   2. Multisig   (2-of-3 with fresh signer wallets)
//   3. JobMarketplace (bound to the MockERC20)
//
// On a local Hardhat node the test accounts come preloaded, signers and
// multisig are auto-funded, and the marketplace deployer (signer 1) is
// pre-approved + pre-funded so a quick demo flow is one click away.
//
// On Sepolia the deployer must hold at least ~0.05 ETH. Signers are NOT
// auto-funded (they need a faucet). Each signer requires Sepolia ETH to
// pay gas when proposing/approving/executing proposals.
//
// Environment:
//   SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
import { ethers, network, run } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { updateFrontend } from "./update-frontend";

const ROOT = resolve(__dirname, "..");
const FRONTEND_ENV_DIR = join(ROOT, "frontend");
const FRONTEND_ENV_FILE = join(FRONTEND_ENV_DIR, ".env");
const SIGNERS_DOC = join(ROOT, "SIGNERS.md");

const THRESHOLD = 2;
const NUM_SIGNERS = 3;

// 1000 mUSDC minted to the deployer for local demos. Set to 0 for sepolia.
const LOCAL_MINT = ethers.parseUnits("1000", 6);

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("\n=== Job Marketplace Deployment ===");
  console.log(`Network:        ${networkName}`);
  console.log(`Deployer:       ${await deployer.getAddress()}`);
  console.log(
    `Deployer bal:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`,
  );

  const isLocal = networkName === "hardhat" || networkName === "localhost";

  // 1. Generate signer wallets for the multisig.
  console.log(`Generating ${NUM_SIGNERS} fresh signer wallets...`);
  const signers = Array.from(
    { length: NUM_SIGNERS },
    () => ethers.Wallet.createRandom().connect(ethers.provider),
  );

  // On local networks, top up each signer with 1 ETH so it can pay gas.
  if (isLocal) {
    for (let i = 0; i < signers.length; i++) {
      const tx = await deployer.sendTransaction({
        to: signers[i].address,
        value: ethers.parseEther("1"),
      });
      await tx.wait();
      console.log(`  Signer ${i + 1} funded: ${signers[i].address} (tx: ${tx.hash})`);
    }
  } else {
    console.log("  Signers will not be auto-funded on real networks — use a faucet per signer.");
  }

  // 2. Deploy the ERC-20 (Mock).
  console.log("\nDeploying MockERC20 (mUSDC, 6 decimals)...");
  const ERC20 = await ethers.getContractFactory("MockERC20");
  const erc20 = await ERC20.deploy("Mock USDC", "mUSDC", 6);
  await erc20.waitForDeployment();
  const tokenAddress = await erc20.getAddress();
  console.log(`Token:          ${tokenAddress}`);

  // Mint initial supply to deployer (local only).
  if (isLocal && LOCAL_MINT > 0n) {
    const tx = await erc20.mint(deployer.address, LOCAL_MINT);
    await tx.wait();
    console.log(`Minted ${ethers.formatUnits(LOCAL_MINT, 6)} mUSDC to deployer (local demo).`);
  }

  // 3. Deploy Multisig.
  const signerAddresses = signers.map((s) => s.address);
  console.log(`\nDeploying Multisig (${NUM_SIGNERS} signers, threshold ${THRESHOLD})...`);
  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy(signerAddresses, THRESHOLD);
  await multisig.waitForDeployment();
  const multisigAddress = await multisig.getAddress();
  console.log(`Multisig:       ${multisigAddress}`);

  // 4. Deploy JobMarketplace bound to the token.
  console.log("\nDeploying JobMarketplace...");
  const JM = await ethers.getContractFactory("JobMarketplace");
  const marketplace = await JM.deploy(tokenAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`Marketplace:    ${marketplaceAddress}`);

  // 5. Etherscan verification (sepolia only).
  if (networkName === "sepolia" && process.env.ETHERSCAN_API_KEY) {
    console.log("\nVerifying on Etherscan...");
    for (const [name, addr, args] of [
      ["MockERC20", tokenAddress, ["Mock USDC", "mUSDC", 6]],
      ["Multisig", multisigAddress, [signerAddresses, THRESHOLD]],
      ["JobMarketplace", marketplaceAddress, [tokenAddress]],
    ] as const) {
      try {
        await run("verify:verify", { address: addr, constructorArguments: [...args] });
        console.log(`  ${name} verified.`);
      } catch (err) {
        console.warn(`  ${name} verification failed:`, (err as Error).message);
      }
    }
  }

  // 6. Persist deployment info for the frontend. Delegates the
  // frontend/.env + ABI sync to scripts/update-frontend.ts so both
  // deploy.ts and redeploy-marketplace.ts share the same writer
  // (preserves VITE_ALCHEMY_API_KEY / VITE_WC_PROJECT_ID).
  if (!existsSync(FRONTEND_ENV_DIR)) mkdirSync(FRONTEND_ENV_DIR, { recursive: true });
  await updateFrontend({
    multisig: multisigAddress,
    marketplace: marketplaceAddress,
    token: tokenAddress,
  });

  const docLines = [
    `# Deployment Info (${networkName})`,
    "",
    `- Multisig:        \`${multisigAddress}\``,
    `- JobMarketplace:  \`${marketplaceAddress}\``,
    `- Token (MockERC20): \`${tokenAddress}\``,
    `- Threshold:       ${THRESHOLD} of ${NUM_SIGNERS}`,
    "",
    "> These are TEST wallets. Never reuse them for real funds.",
    "",
    "## Signers",
    "",
    ...signers.map(
      (s, i) => `### Signer ${i + 1}\n\n- Address: \`${s.address}\`\n- Private key: \`${s.privateKey}\`\n`,
    ),
  ];
  writeFileSync(SIGNERS_DOC, docLines.join("\n"), "utf8");
  console.log(`Wrote ${SIGNERS_DOC}`);

  console.log("\n=== Summary ===");
  console.log(`Token:        ${tokenAddress}`);
  console.log(`Multisig:     ${multisigAddress}`);
  console.log(`Marketplace:  ${marketplaceAddress}`);
  console.log(`Signers:`);
  signers.forEach((s, i) => console.log(`  ${i + 1}. ${s.address}  pk=${s.privateKey}`));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
