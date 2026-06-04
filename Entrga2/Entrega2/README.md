# Multisig DApp — Entrega 2

A programmatic multisig wallet built with **Solidity + Hardhat** and a **React + TypeScript** frontend powered by **RainbowKit + Wagmi v2 + Viem**.

- Contract in `contracts/Multisig.sol`
- Tests in `test/Multisig.test.ts` (26 tests, 0 warnings on compile)
- Deploy script in `scripts/deploy.ts` (also auto-fills `frontend/.env` and writes `SIGNERS.md`)
- ABI sync script in `scripts/copy-abi.ts`
- Frontend in `frontend/`

> **Design choice — dynamic signers.** Signer set is **not** fixed at deploy. `addSigner`, `removeSigner` and `changeThreshold` are gated by a `onlySelf` modifier (i.e. only callable by the contract itself), so they can only be invoked by routing a proposal through the normal multisig flow that targets `address(this)` with the corresponding function selector. This mirrors the pattern used by Gnosis Safe.

---

## 1. Project structure

```
Entrega2/
├── contracts/Multisig.sol
├── scripts/
│   ├── deploy.ts          # deploy + 3 signers + fund + verify + write .env
│   └── copy-abi.ts        # copy ABI to frontend/src/contracts/
├── test/Multisig.test.ts
├── hardhat.config.ts
├── package.json
├── .env.example
├── SIGNERS.md             # auto-written on deploy with signer private keys
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── wagmi.ts
│   │   ├── components/    # Header, ContractInfo, ProposalForm, ProposalList, ProposalCard, NotSignerBanner
│   │   ├── hooks/         # useMultisigInfo, useProposals, useProposalCard, useMultisigActions
│   │   ├── contracts/     # Multisig.abi.ts (auto-generated)
│   │   └── utils/
│   ├── vite.config.ts
│   └── package.json
└── docs/
    └── ISSUES.md          # problems we hit and how we fixed them
```

---

## 2. Setup the contract side

```bash
# from repo root
npm install
cp .env.example .env
```

Edit `.env`:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

> The deployer is only used to deploy the contract and (on local networks) to fund test signers. It is **not** a multisig signer.

## 3. Compile and test the contract

```bash
npm run compile   # npx hardhat compile (0 warnings)
npm test          # 26 tests, all passing
```

The test suite covers:

- Deployment validation (empty signers, invalid threshold, duplicates, zero address).
- `propose` / `approve` / `execute` / `cancel` happy paths.
- Rejection of non-signers, duplicate approvals, executing before threshold, re-executing, approving/executing cancelled proposals.
- Dynamic signer management via self-call (add / remove / change threshold).
- Invariant: `removeSigner` cannot drop below the current threshold.
- Receiving ETH.

## 4. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

What the script does:

1. Generates 3 fresh `ethers.Wallet.createRandom()` signers.
2. Deploys `Multisig(signers, 2)` (2-of-3 threshold).
3. Funds the multisig with `0.5 ETH` on local networks (skip on Sepolia — send manually).
4. Verifies the source on Etherscan if `ETHERSCAN_API_KEY` is set.
5. Writes `frontend/.env` with `VITE_MULTISIG_ADDRESS`.
6. Writes `SIGNERS.md` with the 3 signer addresses and private keys.

> **Sepolia caveat.** The deployer must already have ~0.5 ETH for gas. After deployment, send a small amount of ETH to the multisig address (e.g. `0.1 ETH`) so the UI can demo `value > 0` proposals.

### Local-only quick run

```bash
npm run node                 # in one terminal — starts a local hardhat node
npm run deploy:localhost     # in another terminal — deploys + funds everything automatically
```

---

## 5. Run the frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

`frontend/.env` should look like this after deployment:

```env
VITE_MULTISIG_ADDRESS=0xYourDeployedAddress
VITE_WC_PROJECT_ID=
```

`VITE_WC_PROJECT_ID` is **optional**. Without it, RainbowKit falls back to the injected wallet (MetaMask / Rabby / etc.). Get a project ID at <https://cloud.walletconnect.com> if you want WalletConnect QR.

### Frontend scripts

```bash
npm run dev        # vite dev server
npm run typecheck  # tsc --noEmit (0 errors expected)
npm run build      # production build to dist/
npm run preview    # preview the production build
```

---

## 6. Walkthrough (Sepolia)

1. Open <http://localhost:5173> and connect MetaMask (or any injected wallet). Make sure MetaMask is on **Sepolia**.
2. Import signer 1 from `SIGNERS.md` into MetaMask (Account → Import Account → paste private key).
3. Switch to signer 1 in MetaMask. The `NotSignerBanner` should disappear.
4. Submit a new proposal: target = your own address, value = `0`, calldata = `0x`.
5. Approve the new proposal with signer 1. Approvals counter shows `1 / 2`.
6. Switch to signer 2 (also imported from `SIGNERS.md`) and click **Approve**. Counter is now `2 / 2`.
7. Back to signer 1, click **Execute**. The transaction goes through and the badge turns `Executed`.
8. Try a value-carrying proposal: send `0.01 ETH` to a recipient. Make sure the multisig itself has enough balance first.
9. Try a "self-call" proposal: target = multisig address, calldata = encoded `addSigner(0xNewAddress)`. After 2 approvals, executing it will add a new signer (visible in the info panel).
10. To cancel: as the **proposer**, click **Cancel** on any of your pending proposals.

---

## 7. Contract design recap

| Function | Caller | Effect |
|---|---|---|
| `propose(target, value, data)` | any signer | stores proposal, returns id |
| `approve(id)` | any signer (once) | bumps `approvalCount` |
| `execute(id)` | any signer, `approvals >= threshold` | calls `target.call{value}(data)` |
| `cancel(id)` | only `proposer` | marks `cancelled = true` |
| `addSigner / removeSigner / changeThreshold` | **only `address(this)`** (must be invoked via a multisig proposal) | updates signer set / threshold |

Events: `ProposalCreated`, `ProposalApproved`, `ProposalExecuted`, `ProposalCancelled`, `SignerAdded`, `SignerRemoved`, `ThresholdChanged`, `Deposit`.

Reverts use custom errors (`NotSigner`, `AlreadyApproved`, `ThresholdNotMet`, `AlreadyExecuted`, `AlreadyCancelled`, `NotProposer`, `InvalidThreshold`, `EmptySigners`, `DuplicateSigner`, `ZeroAddress`, `OnlyMultisig`, `ExecutionFailed`).

---

## 8. Deployed contract on Sepolia

> _Fill in after `npm run deploy:sepolia` succeeds._

- **Contract address:** `0x...` (see `frontend/.env` / console output)
- **Network:** Sepolia (chain id `11155111`)
- **Threshold:** 2 of 3
- **Signers & private keys:** see `SIGNERS.md` (test wallets only, do not fund with real assets)

---

## 9. Useful commands

| Command | Description |
|---|---|
| `npm run compile` | Compile contracts |
| `npm test` | Run test suite |
| `npm run node` | Local Hardhat node |
| `npm run deploy:localhost` | Deploy + fund on local node |
| `npm run deploy:sepolia` | Deploy on Sepolia |
| `npm run sync:abi` | Refresh `frontend/src/contracts/Multisig.abi.ts` |
| `cd frontend && npm run dev` | Run the Vite dev server |
| `cd frontend && npm run typecheck` | 0 TS errors check |
| `cd frontend && npm run build` | Production build |
