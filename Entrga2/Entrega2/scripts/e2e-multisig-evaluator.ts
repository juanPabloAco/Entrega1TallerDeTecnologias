// End-to-end happy-path test for the Job Marketplace + Multisig stack.
//
// This script runs the SAME flow as DEPLOY.md "Caso 5 — Multisig como evaluator":
//   1. Deploy MockERC20 + Multisig + JobMarketplace on a local Hardhat node.
//   2. Mint mUSDC to the client; approve + fund the marketplace.
//   3. Provider submits a deliverable.
//   4. Two signers propose + approve a `complete` proposal through the multisig.
//   5. The third signer executes, releasing payment to the provider.
//
// Unlike `npx hardhat test`, this is a SCRIPT meant to be run as a sanity check
// from the command line. It uses a fresh local Hardhat network (in-process),
// so it doesn't need Sepolia ETH or any deployed contract.
//
// Usage:
//   npx hardhat run scripts/e2e-multisig-evaluator.ts

import { ethers, network } from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

const BUDGET = ethers.parseUnits("100", 6); // 100 mUSDC
const DELIVER_REF = keccak256(toUtf8Bytes("ipfs://Qm-example-deliverable"));
const REASON = keccak256(toUtf8Bytes("approved-by-multisig-e2e"));

function log(label: string, value: unknown) {
  console.log(`  ${label.padEnd(28)} ${value}`);
}

async function main() {
  console.log("\n=== E2E: Job Marketplace + Multisig as Evaluator ===\n");

  // 1. Fresh signer set. signer[0] will be the deployer+client+provider,
  //    signers 1 and 2 are additional multisig signers. signers[3] is a
  //    separate "extra" signer so we exercise the full 2-of-3 path.
  const [deployer, client, provider, s1, s2, s3] = await ethers.getSigners();
  const allSigners = [s1, s2, s3];
  console.log(`Network:                  ${network.name}`);
  log("Deployer (client)", deployer.address);
  log("Provider", provider.address);
  log("Signer 1 (proposer)", s1.address);
  log("Signer 2", s2.address);
  log("Signer 3 (executor)", s3.address);

  // 2. Deploy MockERC20.
  console.log("\n--- Step 1: Deploy contracts ---");
  const ERC20 = await ethers.getContractFactory("MockERC20");
  const token = await ERC20.deploy("Mock USDC", "mUSDC", 6);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  log("MockERC20 deployed", tokenAddress);

  // 3. Deploy Multisig with 3 signers, threshold 2.
  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy(
    allSigners.map((s) => s.address),
    2,
  );
  await multisig.waitForDeployment();
  const multisigAddress = await multisig.getAddress();
  log("Multisig deployed", multisigAddress);

  // 4. Deploy JobMarketplace bound to the token.
  const JM = await ethers.getContractFactory("JobMarketplace");
  const marketplace = await JM.deploy(tokenAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  log("JobMarketplace deployed", marketplaceAddress);

  // 5. Mint initial supply to the client so they can fund a job.
  await (await token.mint(client.address, ethers.parseUnits("10000", 6))).wait();
  log("Minted to client", "10,000 mUSDC");

  // 6. Client creates the job. Evaluator = multisig (the headline flow).
  console.log("\n--- Step 2: Client creates a job ---");
  const futureDeadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const createTx = await marketplace
    .connect(client)
    .createJob(
      "Build a landing page (e2e test)",
      BUDGET,
      multisigAddress, // evaluator = multisig
      provider.address, // provider is set at creation
      futureDeadline,
    );
  const createRcpt = await createTx.wait();
  const jobId = Number(await marketplace.nextJobId()) - 1;
  log("Job id", jobId);
  log("Tx hash", createRcpt!.hash);
  log("Job status (expect 1 Open)", Number(await marketplace.statusOf(jobId)));

  // 7. Client approves + funds the marketplace.
  console.log("\n--- Step 3: Client approves + funds ---");
  await (await token.connect(client).approve(marketplaceAddress, BUDGET)).wait();
  log("Approved", `${ethers.formatUnits(BUDGET, 6)} mUSDC`);
  await (await marketplace.connect(client).fund(jobId)).wait();
  log("Funded", `${ethers.formatUnits(BUDGET, 6)} mUSDC`);
  log("Job status (expect 2 Funded)", Number(await marketplace.statusOf(jobId)));
  log("Marketplace balance", `${ethers.formatUnits(await token.balanceOf(marketplaceAddress), 6)} mUSDC`);

  // 8. Provider submits the deliverable.
  console.log("\n--- Step 4: Provider submits ---");
  await (await marketplace.connect(provider).submit(jobId, DELIVER_REF)).wait();
  log("Deliverable ref", DELIVER_REF);
  log("Job status (expect 3 Submitted)", Number(await marketplace.statusOf(jobId)));

  // 9. Signer 1 encodes the complete() calldata and proposes it through the multisig.
  console.log("\n--- Step 5: Multisig propose + approve + execute ---");
  const jmIface = new ethers.Interface((await ethers.getContractFactory("JobMarketplace")).interface.formatJson());
  const completeData = jmIface.encodeFunctionData("complete", [jobId, REASON]);
  log("Encoded complete()", completeData.slice(0, 66) + "...");

  const propTx = await multisig.connect(s1).propose(marketplaceAddress, 0, completeData);
  const propRcpt = await propTx.wait();
  const proposalId = Number(await multisig.proposalCount()) - 1;
  log("Proposal id", proposalId);
  log("Propose tx", propRcpt!.hash);
  log("Approvals (expect 0)", Number((await multisig.getProposal(proposalId)).approvalCount));

  // 10. Signers 1 and 2 approve.
  await (await multisig.connect(s1).approve(proposalId)).wait();
  log("Approve 1 (s1) tx", "mined");
  await (await multisig.connect(s2).approve(proposalId)).wait();
  log("Approve 2 (s2) tx", "mined");
  log("Approvals (expect 2)", Number((await multisig.getProposal(proposalId)).approvalCount));

  // 11. Signer 3 executes.
  const execTx = await multisig.connect(s3).execute(proposalId);
  const execRcpt = await execTx.wait();
  log("Execute tx", execRcpt!.hash);
  log("Proposal executed", (await multisig.getProposal(proposalId)).executed);

  // 12. Verify final state.
  console.log("\n--- Step 6: Final assertions ---");
  const finalJob = await marketplace.getJob(jobId);
  const providerBalance = await token.balanceOf(provider.address);
  const marketplaceBalance = await token.balanceOf(marketplaceAddress);

  log("Job status (expect 4 Completed)", Number(finalJob.status));
  log("Provider balance", `${ethers.formatUnits(providerBalance, 6)} mUSDC`);
  log("Marketplace balance (expect 0)", `${ethers.formatUnits(marketplaceBalance, 6)} mUSDC`);

  // The provider started with 0 mUSDC. After execution they should have exactly
  // BUDGET mUSDC.
  const providerBalanceEqBudget = providerBalance === BUDGET;
  const marketplaceEmpty = marketplaceBalance === 0n;
  const statusCompleted = Number(finalJob.status) === 4;

  console.log("\n--- Result ---");
  console.log(`  Job reached Completed state:    ${statusCompleted ? "PASS" : "FAIL"}`);
  console.log(`  Provider received BUDGET:       ${providerBalanceEqBudget ? "PASS" : "FAIL"}`);
  console.log(`  Marketplace escrow drained:     ${marketplaceEmpty ? "PASS" : "FAIL"}`);

  const allPassed = statusCompleted && providerBalanceEqBudget && marketplaceEmpty;
  console.log(`\n  ${allPassed ? "✓ ALL CHECKS PASSED" : "✗ SOME CHECKS FAILED"}\n`);

  if (!allPassed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});