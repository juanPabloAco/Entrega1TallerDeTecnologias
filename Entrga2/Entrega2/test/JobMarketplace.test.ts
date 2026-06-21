import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  JobMarketplace,
  JobMarketplace__factory,
  MockERC20,
  MockERC20__factory,
} from "../typechain-types";

const STATUS = {
  None: 0,
  Open: 1,
  Funded: 2,
  Submitted: 3,
  Completed: 4,
  Rejected: 5,
  Expired: 6,
} as const;

describe("JobMarketplace", () => {
  let token: MockERC20;
  let marketplace: JobMarketplace;
  let client: HardhatEthersSigner;
  let provider: HardhatEthersSigner;
  let evaluator: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let anyone: HardhatEthersSigner;

  const BUDGET = ethers.parseUnits("100", 6); // 100 USDC-equivalent
  const INITIAL = ethers.parseUnits("1000", 6);
  const ONE_DAY = 86_400;
  const farFuture = () => Math.floor(Date.now() / 1000) + ONE_DAY * 365;
  // Helper for short-lived expiry tests. Anchors on the *chain* clock plus
  // a generous buffer so that several seconds of mining between createJob
  // and the next user action never crosses the deadline.
  const soonExpiry = async () => (await time.latest()) + 60;
  const approvedReason = () => ethers.encodeBytes32String("approved");
  const rejectedReason = () => ethers.encodeBytes32String("rejected");

  beforeEach(async () => {
    [client, provider, evaluator, attacker, anyone] = await ethers.getSigners();

    const TokenF = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
    token = await TokenF.deploy("Mock USDC", "mUSDC", 6);
    await token.waitForDeployment();

    const MktF = (await ethers.getContractFactory("JobMarketplace")) as JobMarketplace__factory;
    marketplace = await MktF.deploy(await token.getAddress());
    await marketplace.waitForDeployment();

    await token.mint(client.address, INITIAL);
  });

  async function createJob(opts?: { providerAddr?: string; expiresAt?: number; evalAddr?: string }) {
    const evalAddr = opts?.evalAddr ?? evaluator.address;
    const providerAddr = opts?.providerAddr ?? ethers.ZeroAddress;
    const expiresAt = opts?.expiresAt ?? farFuture();
    const tx = await marketplace
      .connect(client)
      .createJob("Build landing page", BUDGET, evalAddr, providerAddr, expiresAt);
    const receipt = await tx.wait();
    return receipt!;
  }

  async function createAndFund(opts?: { providerAddr?: string; expiresAt?: number; evalAddr?: string }) {
    await createJob(opts);
    await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
    await marketplace.connect(client).setProvider(0, opts?.providerAddr ?? provider.address);
    await marketplace.connect(client).fund(0);
  }

  /* ============================================================
   *                       DEPLOYMENT
   * ============================================================ */
  describe("Deployment", () => {
    it("stores the token address and nextJobId=0", async () => {
      expect(await marketplace.token()).to.equal(await token.getAddress());
      expect(await marketplace.nextJobId()).to.equal(0);
    });

    it("reverts when token is zero address", async () => {
      const F = await ethers.getContractFactory("JobMarketplace");
      await expect(F.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(marketplace, "ZeroAddress");
    });
  });

  /* ============================================================
   *                      createJob
   * ============================================================ */
  describe("createJob", () => {
    it("creates a job in Open state and emits JobCreated", async () => {
      await expect(
        marketplace.connect(client).createJob("desc", BUDGET, evaluator.address, provider.address, farFuture()),
      )
        .to.emit(marketplace, "JobCreated")
        .withArgs(0, client.address, evaluator.address, provider.address, BUDGET, farFuture(), "desc");

      const job = await marketplace.getJob(0);
      expect(job.status).to.equal(STATUS.Open);
      expect(job.client).to.equal(client.address);
      expect(job.evaluator).to.equal(evaluator.address);
      expect(job.provider).to.equal(provider.address);
      expect(job.budget).to.equal(BUDGET);
      expect(await marketplace.nextJobId()).to.equal(1);
    });

    it("reverts with zero budget", async () => {
      await expect(
        marketplace.connect(client).createJob("desc", 0, evaluator.address, ethers.ZeroAddress, farFuture()),
      ).to.be.revertedWithCustomError(marketplace, "ZeroBudget");
    });

    it("reverts with zero evaluator", async () => {
      await expect(
        marketplace.connect(client).createJob("desc", BUDGET, ethers.ZeroAddress, ethers.ZeroAddress, farFuture()),
      ).to.be.revertedWithCustomError(marketplace, "ZeroAddress");
    });

    it("reverts when expiresAt is in the past", async () => {
      await expect(
        marketplace.connect(client).createJob("desc", BUDGET, evaluator.address, ethers.ZeroAddress, 1),
      ).to.be.revertedWithCustomError(marketplace, "DeadlineInPast");
    });
  });

  /* ============================================================
   *                      setProvider
   * ============================================================ */
  describe("setProvider", () => {
    beforeEach(async () => {
      await createJob(); // provider = address(0)
    });

    it("assigns a provider to an Open job without one", async () => {
      await expect(marketplace.connect(client).setProvider(0, provider.address))
        .to.emit(marketplace, "ProviderSet")
        .withArgs(0, provider.address);
      expect((await marketplace.getJob(0)).provider).to.equal(provider.address);
    });

    it("reverts when caller is not the client", async () => {
      await expect(marketplace.connect(attacker).setProvider(0, provider.address)).to.be.revertedWithCustomError(
        marketplace,
        "NotClient",
      );
    });

    it("reverts when provider already set", async () => {
      await marketplace.connect(client).setProvider(0, provider.address);
      await expect(marketplace.connect(client).setProvider(0, attacker.address)).to.be.revertedWithCustomError(
        marketplace,
        "ProviderAlreadySet",
      );
    });

    it("reverts with zero provider address", async () => {
      await expect(marketplace.connect(client).setProvider(0, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        marketplace,
        "ZeroAddress",
      );
    });

    it("reverts when called on a non-existent job", async () => {
      await expect(marketplace.connect(client).setProvider(99, provider.address)).to.be.revertedWithCustomError(
        marketplace,
        "JobNotFound",
      );
    });
  });

  /* ============================================================
   *                         fund
   * ============================================================ */
  describe("fund", () => {
    it("happy path: pulls tokens into escrow and moves to Funded", async () => {
      await createJob({ providerAddr: provider.address });
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);

      await expect(marketplace.connect(client).fund(0))
        .to.emit(marketplace, "JobFunded")
        .withArgs(0, BUDGET);

      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Funded);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(BUDGET);
      expect(await token.balanceOf(client.address)).to.equal(INITIAL - BUDGET);
    });

    it("reverts when caller is not the client", async () => {
      await createJob({ providerAddr: provider.address });
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await expect(marketplace.connect(attacker).fund(0)).to.be.revertedWithCustomError(marketplace, "NotClient");
    });

    it("reverts when no provider is set", async () => {
      await createJob();
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await expect(marketplace.connect(client).fund(0)).to.be.revertedWithCustomError(marketplace, "NoProvider");
    });

    it("reverts when job has expired", async () => {
      await createJob({ providerAddr: provider.address, expiresAt: await soonExpiry() });
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await time.increase(400);
      await expect(marketplace.connect(client).fund(0)).to.be.revertedWithCustomError(marketplace, "JobAlreadyExpired");
    });

    it("reverts when state is not Open", async () => {
      await createJob({ providerAddr: provider.address });
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(0);
      await expect(marketplace.connect(client).fund(0)).to.be.revertedWithCustomError(marketplace, "InvalidState");
    });
  });

  /* ============================================================
   *                        submit
   * ============================================================ */
  describe("submit", () => {
    beforeEach(async () => {
      await createAndFund();
    });

    it("moves Funded -> Submitted and stores deliverableRef", async () => {
      const ref = ethers.id("ipfs-cid-of-deliverable");
      await expect(marketplace.connect(provider).submit(0, ref))
        .to.emit(marketplace, "JobSubmitted")
        .withArgs(0, provider.address, ref);

      const job = await marketplace.getJob(0);
      expect(job.status).to.equal(STATUS.Submitted);
      expect(job.deliverableRef).to.equal(ref);
    });

    it("reverts when caller is not the provider", async () => {
      const ref = ethers.id("x");
      await expect(marketplace.connect(attacker).submit(0, ref)).to.be.revertedWithCustomError(
        marketplace,
        "NotProvider",
      );
    });

    it("reverts when job is not Funded", async () => {
      const ref = ethers.id("x");
      await marketplace.connect(provider).submit(0, ref);
      await expect(marketplace.connect(provider).submit(0, ref)).to.be.revertedWithCustomError(
        marketplace,
        "InvalidState",
      );
    });

    it("reverts after expiry", async () => {
      const ref = ethers.id("x");
      // Create a fresh job with a short deadline. The beforeEach already created
      // job 0; this one is job 1.
      await marketplace.connect(client).createJob(
        "expiry-test",
        BUDGET,
        evaluator.address,
        provider.address,
        await soonExpiry(),
      );
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(1);
      await time.increase(120);
      await expect(marketplace.connect(provider).submit(1, ref)).to.be.revertedWithCustomError(
        marketplace,
        "JobAlreadyExpired",
      );
    });
  });

  /* ============================================================
   *                       complete
   * ============================================================ */
  describe("complete", () => {
    beforeEach(async () => {
      await createAndFund();
      await marketplace.connect(provider).submit(0, ethers.id("deliv"));
    });

    it("pays provider and moves to Completed", async () => {
      const reason = approvedReason();
      await expect(marketplace.connect(evaluator).complete(0, reason))
        .to.emit(marketplace, "JobCompleted")
        .withArgs(0, provider.address, BUDGET, reason);

      const job = await marketplace.getJob(0);
      expect(job.status).to.equal(STATUS.Completed);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(0);
      expect(await token.balanceOf(provider.address)).to.equal(BUDGET);
    });

    it("reverts when caller is not the evaluator", async () => {
      await expect(
        marketplace.connect(attacker).complete(0, approvedReason()),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });

    it("reverts when state is not Submitted", async () => {
      await marketplace.connect(evaluator).complete(0, approvedReason());
      await expect(
        marketplace.connect(evaluator).complete(0, approvedReason()),
      ).to.be.revertedWithCustomError(marketplace, "InvalidState");
    });

    it("reverts with zero reason", async () => {
      await expect(
        marketplace.connect(evaluator).complete(0, ethers.ZeroHash),
      ).to.be.revertedWithCustomError(marketplace, "ZeroReason");
    });
  });

  /* ============================================================
   *                        reject
   * ============================================================ */
  describe("reject", () => {
    it("client rejects in Open (no funds escrowed)", async () => {
      await createJob({ providerAddr: provider.address });
      const reason = rejectedReason();
      await expect(marketplace.connect(client).reject(0, reason))
        .to.emit(marketplace, "JobRejected")
        .withArgs(0, client.address, 0, reason);

      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Rejected);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(0);
    });

    it("evaluator rejects in Funded (refund client)", async () => {
      await createAndFund();
      const reason = rejectedReason();
      await expect(marketplace.connect(evaluator).reject(0, reason))
        .to.emit(marketplace, "JobRejected")
        .withArgs(0, client.address, BUDGET, reason);

      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Rejected);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(0);
      expect(await token.balanceOf(client.address)).to.equal(INITIAL);
    });

    it("evaluator rejects in Submitted (refund client)", async () => {
      await createAndFund();
      await marketplace.connect(provider).submit(0, ethers.id("x"));
      const reason = rejectedReason();
      await expect(marketplace.connect(evaluator).reject(0, reason))
        .to.emit(marketplace, "JobRejected")
        .withArgs(0, client.address, BUDGET, reason);

      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Rejected);
      expect(await token.balanceOf(client.address)).to.equal(INITIAL);
    });

    it("reverts when client tries to reject in Funded (only evaluator can)", async () => {
      await createAndFund();
      // In Funded state, only the evaluator is allowed to reject — the contract
      // surfaces NotEvaluator before NotClient, which is the spec-correct path.
      await expect(
        marketplace.connect(client).reject(0, rejectedReason()),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });

    it("reverts when attacker tries to reject in Submitted", async () => {
      await createAndFund();
      await marketplace.connect(provider).submit(0, ethers.id("x"));
      await expect(
        marketplace.connect(attacker).reject(0, rejectedReason()),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });

    it("reverts on Completed jobs", async () => {
      await createAndFund();
      await marketplace.connect(provider).submit(0, ethers.id("x"));
      await marketplace.connect(evaluator).complete(0, approvedReason());
      await expect(
        marketplace.connect(evaluator).reject(0, rejectedReason()),
      ).to.be.revertedWithCustomError(marketplace, "InvalidState");
    });

    it("reverts with zero reason", async () => {
      await createJob({ providerAddr: provider.address });
      await expect(marketplace.connect(client).reject(0, ethers.ZeroHash)).to.be.revertedWithCustomError(
        marketplace,
        "ZeroReason",
      );
    });
  });

  /* ============================================================
   *                     claimRefund
   * ============================================================ */
  describe("claimRefund", () => {
    it("anyone can refund from Funded after expiry", async () => {
      await createJob({ providerAddr: provider.address, expiresAt: await soonExpiry() });
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(0);

      await time.increase(120);

      await expect(marketplace.connect(anyone).claimRefund(0))
        .to.emit(marketplace, "RefundClaimed")
        .withArgs(0, client.address, BUDGET);

      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Expired);
      expect(await token.balanceOf(client.address)).to.equal(INITIAL);
    });

    it("anyone can refund from Submitted after expiry", async () => {
      await createJob({ providerAddr: provider.address, expiresAt: await soonExpiry() });
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(0);
      await marketplace.connect(provider).submit(0, ethers.id("x"));

      await time.increase(120);

      await expect(marketplace.connect(anyone).claimRefund(0)).to.emit(marketplace, "RefundClaimed");
      expect((await marketplace.getJob(0)).status).to.equal(STATUS.Expired);
      expect(await token.balanceOf(client.address)).to.equal(INITIAL);
    });

    it("reverts when called before expiry", async () => {
      await createAndFund();
      await expect(marketplace.connect(anyone).claimRefund(0)).to.be.revertedWithCustomError(
        marketplace,
        "JobNotExpired",
      );
    });

    it("reverts on Open (no funds escrowed)", async () => {
      await createJob({ providerAddr: provider.address, expiresAt: await soonExpiry() });
      await time.increase(120);
      await expect(marketplace.connect(anyone).claimRefund(0)).to.be.revertedWithCustomError(
        marketplace,
        "InvalidState",
      );
    });

    it("reverts on Completed", async () => {
      await createJob({ providerAddr: provider.address, expiresAt: await soonExpiry() });
      await token.connect(client).approve(await marketplace.getAddress(), BUDGET);
      await marketplace.connect(client).fund(0);
      await marketplace.connect(provider).submit(0, ethers.id("x"));
      await marketplace.connect(evaluator).complete(0, approvedReason());

      await time.increase(120);
      await expect(marketplace.connect(anyone).claimRefund(0)).to.be.revertedWithCustomError(
        marketplace,
        "InvalidState",
      );
    });
  });
});
