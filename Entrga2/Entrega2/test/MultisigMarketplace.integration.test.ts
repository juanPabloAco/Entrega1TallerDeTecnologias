import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  JobMarketplace,
  JobMarketplace__factory,
  MockERC20,
  MockERC20__factory,
  Multisig,
  Multisig__factory,
} from "../typechain-types";

/**
 * Integration tests: a Multisig wallet plays the role of `evaluator` in
 * the JobMarketplace. The Multisig never imports nor knows about the
 * marketplace — it merely stores opaque calldata. Once threshold
 * approvals are gathered, any signer executes the proposal; the
 * Marketplace observes `msg.sender == evaluator` (the Multisig) and
 * releases the escrowed tokens to the provider.
 */
describe("JobMarketplace x Multisig (integration)", () => {
  let token: MockERC20;
  let marketplace: JobMarketplace;
  let multisig: Multisig;

  let client: HardhatEthersSigner;
  let provider: HardhatEthersSigner;
  let s1: HardhatEthersSigner; // multisig signer 1 (will propose)
  let s2: HardhatEthersSigner; // multisig signer 2
  let s3: HardhatEthersSigner; // multisig signer 3 (will execute)
  let attacker: HardhatEthersSigner;

  const BUDGET = ethers.parseUnits("100", 6);
  const INITIAL = ethers.parseUnits("1000", 6);
  const farFuture = () => Math.floor(Date.now() / 1000) + 86_400 * 365;

  const STATUS = { Open: 1, Funded: 2, Submitted: 3, Completed: 4 } as const;

  beforeEach(async () => {
    [client, provider, s1, s2, s3, attacker] = await ethers.getSigners();

    // 1. Deploy the ERC-20 used for escrow.
    const TokenF = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
    token = await TokenF.deploy("Mock USDC", "mUSDC", 6);
    await token.waitForDeployment();

    // 2. Deploy the Multisig (2-of-3) — it doesn't know about the marketplace yet.
    const MsF = (await ethers.getContractFactory("Multisig")) as Multisig__factory;
    multisig = await MsF.deploy([s1.address, s2.address, s3.address], 2);
    await multisig.waitForDeployment();

    // 3. Deploy the JobMarketplace, configured to use our token.
    const MktF = (await ethers.getContractFactory("JobMarketplace")) as JobMarketplace__factory;
    marketplace = await MktF.deploy(await token.getAddress());
    await marketplace.waitForDeployment();

    // 4. Fund the client.
    await token.mint(client.address, INITIAL);
  });

  /* ===================================================================
   * HAPPY PATH: createJob -> setProvider -> fund -> submit ->
   *              (Multisig approves + executes complete)
   * =================================================================== */
  describe("Happy path — Multisig as evaluator", () => {
    it("releases payment to the provider after 2-of-3 signers approve the proposal", async () => {
      // 1. Client publishes a job with the Multisig as evaluator.
      await expect(
        marketplace
          .connect(client)
          .createJob("Multisig-evaluated deliverable", BUDGET, await multisig.getAddress(), provider.address, farFuture()),
      )
        .to.emit(marketplace, "JobCreated")
        .withArgs(
          0,
          client.address,
          await multisig.getAddress(),
          provider.address,
          BUDGET,
          farFuture(),
          "Multisig-evaluated deliverable",
        );

      // 2. Client funds the escrow.
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(0);
      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Funded);

      // 3. Provider delivers.
      const deliverableRef = ethers.id("ipfs://QmDeliverable");
      await marketplace.connect(provider).submit(0, deliverableRef);
      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Submitted);

      // 4. Build calldata OFF-CHAIN: a signer (or any frontend) packs
      //    `complete(0, reason)` against the marketplace ABI. The
      //    Multisig itself never imports the marketplace.
      const marketplaceIface = JobMarketplace__factory.createInterface();
      const reason = ethers.encodeBytes32String("approved-by-multisig");
      const completeCalldata = marketplaceIface.encodeFunctionData("complete", [0n, reason]);
      expect(completeCalldata.slice(0, 10)).to.match(/^0x[0-9a-fA-F]{8}$/);

      // 5. s1 proposes on the Multisig: target=marketplace, value=0, data=completeCalldata.
      await expect(multisig.connect(s1).propose(await marketplace.getAddress(), 0, completeCalldata))
        .to.emit(multisig, "ProposalCreated")
        .withArgs(0, s1.address, await marketplace.getAddress(), 0, completeCalldata);

      // 6. Two signers approve (threshold = 2).
      await multisig.connect(s1).approve(0);
      await multisig.connect(s2).approve(0);

      const before = await multisig.getProposal(0);
      expect(before.approvalCount).to.equal(2);

      // 7. s3 executes the proposal. The Multisig does an external call
      //    to the marketplace with `completeCalldata`. Inside the
      //    marketplace, `msg.sender == address(multisig)` which equals
      //    `job.evaluator` -> access check passes.
      const execTx = await multisig.connect(s3).execute(0);
      const execReceipt = await execTx.wait();

      // ProposalExecuted was emitted on the multisig.
      expect(execReceipt!.status).to.equal(1);

      // 8. The marketplace must have emitted JobCompleted. We use queryFilter
      //    pinned at the block of the execute() call to capture the event.
      const filter = marketplace.filters.JobCompleted();
      const logs = await marketplace.queryFilter(filter, execReceipt!.blockNumber, execReceipt!.blockNumber);
      expect(logs.length, "JobCompleted not emitted").to.equal(1);
      expect(logs[0].args.provider).to.equal(provider.address);
      expect(logs[0].args.amount).to.equal(BUDGET);
      expect(logs[0].args.reason).to.equal(reason);

      // 9. Final state and ERC-20 balances.
      const job = await marketplace.getJob(0);
      expect(job.status).to.equal(STATUS.Completed);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(0);
      expect(await token.balanceOf(provider.address)).to.equal(BUDGET);
      expect(await token.balanceOf(client.address)).to.equal(INITIAL - BUDGET);

      const after = await multisig.getProposal(0);
      expect(after.executed).to.equal(true);
    });
  });

  /* ===================================================================
   * GUARDS: the multisig-as-evaluator path must respect threshold
   *         and not be bypassable by an external EOA.
   * =================================================================== */
  describe("Guards", () => {
    beforeEach(async () => {
      await marketplace
        .connect(client)
        .createJob("guarded", BUDGET, await multisig.getAddress(), provider.address, farFuture());
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(0);
      await marketplace.connect(provider).submit(0, ethers.id("d"));
    });

    it("reverts when only one approval has been collected", async () => {
      const data = JobMarketplace__factory.createInterface().encodeFunctionData("complete", [
        0n,
        ethers.encodeBytes32String("too-early"),
      ]);
      await multisig.connect(s1).propose(await marketplace.getAddress(), 0, data);
      await multisig.connect(s1).approve(0);

      await expect(multisig.connect(s3).execute(0)).to.be.revertedWithCustomError(multisig, "ThresholdNotMet");

      // Job must remain Submitted and tokens still escrowed.
      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Submitted);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(BUDGET);
    });

    it("reverts when an EOA calls complete() directly (not via multisig)", async () => {
      // The Multisig is the configured evaluator, so any other address (e.g. s1 as EOA)
      // must fail the access check, proving that `msg.sender == evaluator` is the only
      // authorization rule.
      await expect(
        marketplace.connect(s1).complete(0, ethers.encodeBytes32String("bypass")),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });

    it("reverts on a second execution of the same proposal", async () => {
      const data = JobMarketplace__factory.createInterface().encodeFunctionData("complete", [
        0n,
        ethers.encodeBytes32String("first"),
      ]);
      await multisig.connect(s1).propose(await marketplace.getAddress(), 0, data);
      await multisig.connect(s1).approve(0);
      await multisig.connect(s2).approve(0);
      await multisig.connect(s3).execute(0);

      // The Multisig rejects the second execute with AlreadyExecuted.
      await expect(multisig.connect(s1).execute(0)).to.be.revertedWithCustomError(multisig, "AlreadyExecuted");

      // And a direct complete() from any non-evaluator now fails with NotEvaluator
      // (because the job is Completed and the only authorized caller is the multisig).
      await expect(
        marketplace.connect(s1).complete(0, ethers.encodeBytes32String("again")),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });

    it("reverts when the multisig executes a proposal whose target call fails", async () => {
      // Encode a call that will revert in the marketplace (job is in Submitted,
      // so calling reject on it from the multisig is fine — instead, encode
      // `complete` on a job that is NOT Submitted).
      const data = JobMarketplace__factory.createInterface().encodeFunctionData("complete", [
        99n, // non-existent job
        ethers.encodeBytes32String("nope"),
      ]);
      await multisig.connect(s1).propose(await marketplace.getAddress(), 0, data);
      await multisig.connect(s1).approve(0);
      await multisig.connect(s2).approve(0);

      // The marketplace reverts with JobNotFound; the multisig wraps
      // the failed call as ExecutionFailed and unwinds its state.
      await expect(multisig.connect(s3).execute(0)).to.be.revertedWithCustomError(multisig, "ExecutionFailed");

      const p = await multisig.getProposal(0);
      expect(p.executed).to.equal(false); // state rolled back
    });
  });

  /* ===================================================================
   * Multisig-evaluator can also REJECT to refund the client.
   * =================================================================== */
  describe("Multisig-as-evaluator rejecting a job", () => {
    it("refunds the client from Funded through a multisig proposal", async () => {
      await marketplace
        .connect(client)
        .createJob("to-reject", BUDGET, await multisig.getAddress(), provider.address, farFuture());
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(0);

      const reason = ethers.encodeBytes32String("rejected-by-multisig");
      const data = JobMarketplace__factory.createInterface().encodeFunctionData("reject", [0n, reason]);

      await multisig.connect(s1).propose(await marketplace.getAddress(), 0, data);
      await multisig.connect(s1).approve(0);
      await multisig.connect(s2).approve(0);

      await expect(multisig.connect(s3).execute(0)).to.emit(marketplace, "JobRejected");

      expect((await marketplace.getJob(0)).status).to.equal(5 /* Rejected */);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(0);
      expect(await token.balanceOf(client.address)).to.equal(INITIAL);
    });
  });
});
