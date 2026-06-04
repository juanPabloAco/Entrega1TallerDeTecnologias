import { expect } from "chai";
import { ethers } from "hardhat";
import { Multisig } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const ENCODED_ADD_SIGNER = (newSigner: string) =>
  new ethers.Interface(["function addSigner(address)"]).encodeFunctionData("addSigner", [newSigner]);

const ENCODED_REMOVE_SIGNER = (signer: string) =>
  new ethers.Interface(["function removeSigner(address)"]).encodeFunctionData("removeSigner", [signer]);

const ENCODED_CHANGE_THRESHOLD = (newThreshold: number) =>
  new ethers.Interface(["function changeThreshold(uint256)"]).encodeFunctionData("changeThreshold", [newThreshold]);

describe("Multisig", () => {
  let multisig: Multisig;
  let signers: HardhatEthersSigner[];
  let nonSigner: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;

  const THRESHOLD = 2;
  const NUM_SIGNERS = 3;

  beforeEach(async () => {
    const all = await ethers.getSigners();
    signers = all.slice(0, NUM_SIGNERS);
    nonSigner = all[NUM_SIGNERS];
    recipient = all[NUM_SIGNERS + 1];

    const Factory = await ethers.getContractFactory("Multisig");
    multisig = await Factory.deploy(signers.map((s) => s.address), THRESHOLD);
    await multisig.waitForDeployment();

    // Fund the multisig so it can pay out ETH
    await signers[0].sendTransaction({ to: await multisig.getAddress(), value: ethers.parseEther("10") });
  });

  describe("Deployment", () => {
    it("stores signers and threshold", async () => {
      const stored = await multisig.getSigners();
      expect(stored).to.deep.equal(signers.map((s) => s.address));
      expect(await multisig.threshold()).to.equal(THRESHOLD);
    });

    it("marks each signer in isSigner mapping", async () => {
      for (const s of signers) {
        expect(await multisig.isSigner(s.address)).to.equal(true);
      }
      expect(await multisig.isSigner(nonSigner.address)).to.equal(false);
    });

    it("reverts with empty signers", async () => {
      const Factory = await ethers.getContractFactory("Multisig");
      await expect(Factory.deploy([], 1)).to.be.revertedWithCustomError(multisig, "EmptySigners");
    });

    it("reverts with threshold = 0", async () => {
      const Factory = await ethers.getContractFactory("Multisig");
      await expect(Factory.deploy(signers.map((s) => s.address), 0)).to.be.revertedWithCustomError(
        multisig,
        "InvalidThreshold",
      );
    });

    it("reverts with threshold > signers.length", async () => {
      const Factory = await ethers.getContractFactory("Multisig");
      await expect(
        Factory.deploy(signers.map((s) => s.address), NUM_SIGNERS + 1),
      ).to.be.revertedWithCustomError(multisig, "InvalidThreshold");
    });

    it("reverts with duplicate signers", async () => {
      const Factory = await ethers.getContractFactory("Multisig");
      await expect(
        Factory.deploy([signers[0].address, signers[0].address], 1),
      ).to.be.revertedWithCustomError(multisig, "DuplicateSigner");
    });

    it("reverts with zero address signer", async () => {
      const Factory = await ethers.getContractFactory("Multisig");
      await expect(
        Factory.deploy([signers[0].address, ethers.ZeroAddress], 1),
      ).to.be.revertedWithCustomError(multisig, "ZeroAddress");
    });
  });

  describe("propose", () => {
    it("creates a proposal and emits ProposalCreated", async () => {
      await expect(multisig.connect(signers[0]).propose(recipient.address, 0, "0x"))
        .to.emit(multisig, "ProposalCreated")
        .withArgs(0, signers[0].address, recipient.address, 0, "0x");

      const p = await multisig.getProposal(0);
      expect(p.target).to.equal(recipient.address);
      expect(p.proposer).to.equal(signers[0].address);
      expect(p.executed).to.equal(false);
      expect(await multisig.proposalCount()).to.equal(1);
    });

    it("reverts when called by non-signer", async () => {
      await expect(
        multisig.connect(nonSigner).propose(recipient.address, 0, "0x"),
      ).to.be.revertedWithCustomError(multisig, "NotSigner");
    });
  });

  describe("approve", () => {
    beforeEach(async () => {
      await multisig.connect(signers[0]).propose(recipient.address, 0, "0x");
    });

    it("allows signers to approve and increments count", async () => {
      await expect(multisig.connect(signers[0]).approve(0))
        .to.emit(multisig, "ProposalApproved")
        .withArgs(0, signers[0].address);

      expect(await multisig.hasApproved(0, signers[0].address)).to.equal(true);

      await multisig.connect(signers[1]).approve(0);
      const p = await multisig.getProposal(0);
      expect(p.approvalCount).to.equal(2);
    });

    it("rejects double approval from same signer", async () => {
      await multisig.connect(signers[0]).approve(0);
      await expect(
        multisig.connect(signers[0]).approve(0),
      ).to.be.revertedWithCustomError(multisig, "AlreadyApproved");
    });

    it("reverts when called by non-signer", async () => {
      await expect(
        multisig.connect(nonSigner).approve(0),
      ).to.be.revertedWithCustomError(multisig, "NotSigner");
    });
  });

  describe("execute", () => {
    beforeEach(async () => {
      await multisig.connect(signers[0]).propose(recipient.address, ethers.parseEther("1"), "0x");
    });

    it("reverts before threshold is met", async () => {
      await expect(
        multisig.connect(signers[0]).execute(0),
      ).to.be.revertedWithCustomError(multisig, "ThresholdNotMet");
    });

    it("executes and transfers ETH when threshold met", async () => {
      await multisig.connect(signers[0]).approve(0);
      await multisig.connect(signers[1]).approve(0);

      const before = await ethers.provider.getBalance(recipient.address);
      await expect(multisig.connect(signers[2]).execute(0)).to.emit(multisig, "ProposalExecuted");
      const after = await ethers.provider.getBalance(recipient.address);

      expect(after - before).to.equal(ethers.parseEther("1"));
      const p = await multisig.getProposal(0);
      expect(p.executed).to.equal(true);
    });

    it("reverts on second execution", async () => {
      await multisig.connect(signers[0]).approve(0);
      await multisig.connect(signers[1]).approve(0);
      await multisig.connect(signers[0]).execute(0);
      await expect(
        multisig.connect(signers[0]).execute(0),
      ).to.be.revertedWithCustomError(multisig, "AlreadyExecuted");
    });

    it("reverts when called by non-signer", async () => {
      await multisig.connect(signers[0]).approve(0);
      await multisig.connect(signers[1]).approve(0);
      await expect(
        multisig.connect(nonSigner).execute(0),
      ).to.be.revertedWithCustomError(multisig, "NotSigner");
    });
  });

  describe("cancel", () => {
    beforeEach(async () => {
      await multisig.connect(signers[0]).propose(recipient.address, 0, "0x");
    });

    it("allows proposer to cancel", async () => {
      await expect(multisig.connect(signers[0]).cancel(0)).to.emit(multisig, "ProposalCancelled");
      const p = await multisig.getProposal(0);
      expect(p.cancelled).to.equal(true);
    });

    it("reverts when called by a non-proposer signer", async () => {
      await expect(
        multisig.connect(signers[1]).cancel(0),
      ).to.be.revertedWithCustomError(multisig, "NotProposer");
    });

    it("blocks approve on cancelled proposal", async () => {
      await multisig.connect(signers[0]).cancel(0);
      await expect(
        multisig.connect(signers[1]).approve(0),
      ).to.be.revertedWithCustomError(multisig, "AlreadyCancelled");
    });

    it("blocks execute on cancelled proposal", async () => {
      await multisig.connect(signers[0]).cancel(0);
      await expect(
        multisig.connect(signers[0]).execute(0),
      ).to.be.revertedWithCustomError(multisig, "AlreadyCancelled");
    });
  });

  describe("dynamic signer management via self-call", () => {
    it("adds a new signer through the multisig flow", async () => {
      const data = ENCODED_ADD_SIGNER(nonSigner.address);
      await multisig.connect(signers[0]).propose(await multisig.getAddress(), 0, data);
      await multisig.connect(signers[0]).approve(0);
      await multisig.connect(signers[1]).approve(0);
      await expect(multisig.connect(signers[2]).execute(0)).to.emit(multisig, "SignerAdded");

      expect(await multisig.isSigner(nonSigner.address)).to.equal(true);
      expect(await multisig.getSigners()).to.have.lengthOf(NUM_SIGNERS + 1);
    });

    it("reverts addSigner when called directly (not via multisig)", async () => {
      await expect(
        multisig.connect(signers[0]).addSigner(nonSigner.address),
      ).to.be.revertedWithCustomError(multisig, "OnlyMultisig");
    });

    it("removes a signer through the multisig flow", async () => {
      const data = ENCODED_REMOVE_SIGNER(signers[2].address);
      await multisig.connect(signers[0]).propose(await multisig.getAddress(), 0, data);
      await multisig.connect(signers[0]).approve(0);
      await multisig.connect(signers[1]).approve(0);
      await multisig.connect(signers[2]).execute(0);

      expect(await multisig.isSigner(signers[2].address)).to.equal(false);
      expect(await multisig.getSigners()).to.have.lengthOf(NUM_SIGNERS - 1);
    });

    it("reverts removeSigner when it would break threshold", async () => {
      // Remove one of 3 signers, threshold is 2, so it should pass.
      // But removing again would leave 1 signer < threshold 2.
      const data1 = ENCODED_REMOVE_SIGNER(signers[2].address);
      await multisig.connect(signers[0]).propose(await multisig.getAddress(), 0, data1);
      await multisig.connect(signers[0]).approve(0);
      await multisig.connect(signers[1]).approve(0);
      await multisig.connect(signers[2]).execute(0);

      const data2 = ENCODED_REMOVE_SIGNER(signers[1].address);
      await multisig.connect(signers[0]).propose(await multisig.getAddress(), 0, data2);
      await multisig.connect(signers[0]).approve(1);
      await multisig.connect(signers[1]).approve(1);
      // The inner removeSigner reverts with InvalidThreshold (would leave 1 signer < threshold 2),
      // which the outer execute wraps as ExecutionFailed. Either error is a valid signal.
      await expect(multisig.connect(signers[0]).execute(1)).to.be.reverted;
    });

    it("changes threshold through the multisig flow", async () => {
      const data = ENCODED_CHANGE_THRESHOLD(1);
      await multisig.connect(signers[0]).propose(await multisig.getAddress(), 0, data);
      await multisig.connect(signers[0]).approve(0);
      await multisig.connect(signers[1]).approve(0);
      await multisig.connect(signers[2]).execute(0);

      expect(await multisig.threshold()).to.equal(1);
    });
  });

  describe("receive", () => {
    it("accepts ETH and emits Deposit", async () => {
      await expect(
        signers[0].sendTransaction({ to: await multisig.getAddress(), value: ethers.parseEther("0.5") }),
      ).to.emit(multisig, "Deposit");
    });
  });
});
