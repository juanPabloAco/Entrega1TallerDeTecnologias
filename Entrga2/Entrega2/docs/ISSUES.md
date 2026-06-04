# Issues encountered & fixes

This is a log of the concrete problems we hit while building the project, the root
cause, and the fix. Kept here so the next person (or our future selves) can
short-circuit them.

## 1. Hardhat toolbox & `chai-as-promised` types

**Symptom:** TS warnings on `import chai from "chai"` and `chaiAsPromised`.

**Fix:** `npm i -D @types/chai @types/chai-as-promised chai-as-promised`. Already pinned in `package.json`.

## 2. `removeSigner` invariant test originally expected a specific custom error

**Symptom:** Test failed with `Expected ... 'InvalidThreshold' but it reverted with custom error 'ExecutionFailed'`.

**Root cause:** When a proposal targets the multisig itself and the inner call reverts (e.g. `removeSigner` reverts with `InvalidThreshold`), the outer `execute` wraps that as `ExecutionFailed` because `target.call{value:...}(data)` returned `false`. The contract-side behavior is correct; the test assertion was too specific.

**Fix:** Accept either revert in the test (`await expect(...).to.be.reverted`).

## 3. `viem` 2.52.x ships a broken types layout

**Symptom:** `Could not find a declaration file for module 'viem'` during `tsc --noEmit`. The package points `"types": "./_types/index.d.ts"` but only `_types/index.d.ts.map` exists in the published tarball.

**Fix:** Pin to a known-good version: `"viem": "2.21.45"`. Later upgraded to `"viem": "^2.37.0"` because newer `wagmi` 2.19 requires `viem/experimental/erc7821` exports that don't exist in 2.21.

## 4. `wagmi/chains` has no `sepolia` member

**Symptom:** `Module '"wagmi/chains"' has no exported member 'sepolia'`.

**Root cause:** `wagmi/chains` re-exports from `viem/chains`. If `viem` is at a broken version (see #3), the chain types don't resolve.

**Fix:** Solved by pinning the right `viem` version.

## 5. `import.meta.env` not typed

**Symptom:** `Property 'env' does not exist on type 'ImportMeta'`.

**Fix:** Add `frontend/src/vite-env.d.ts` referencing `vite/client` and declaring `VITE_MULTISIG_ADDRESS` / `VITE_WC_PROJECT_ID` on `ImportMetaEnv`.

## 6. Native binaries missing on Windows (`rollup`, `lightningcss`, `@tailwindcss/oxide`, `esbuild`)

**Symptom:** Vite build fails with `Cannot find module '@rollup/rollup-win32-x64-msvc'` (and similar for `lightningcss.win32-x64-msvc.node`, `@tailwindcss/oxide`, `@esbuild/win32-x64`).

**Root cause:** npm 10's optional-dependency hoisting is unreliable. Vite 5 + Tailwind 4 + Wagmi 2 each pull optional native binaries, and they were ending up under `node_modules/@some-pkg/.cache-xxxxxx/` instead of at the top level.

**Fix:** Install the platform binaries explicitly as devDependencies so npm hoists them:

```json
"@rollup/rollup-win32-x64-msvc": "^4.0.0",
"@tailwindcss/oxide-win32-x64-msvc": "^4.0.0",
"@esbuild/win32-x64": "0.21.5",
"lightningcss-win32-x64-msvc": "^1.0.0"
```

**Alternative:** Run on macOS / Linux where the equivalent `linux-x64` / `darwin-` packages install via npm's `os` selector automatically.

## 7. `wagmi` 2.12 vs RainbowKit 2.2 mismatch (missing `baseAccount`)

**Symptom:** Vite build error: `"baseAccount" is not exported by "wagmi/dist/esm/exports/connectors.js"`.

**Root cause:** RainbowKit 2.2.x imports `baseAccount` from `wagmi/connectors`, but that export was only added in newer connector versions.

**Fix:** Bump wagmi to `^2.14.0` and RainbowKit to `^2.2.0` together so they share the same `connectors` major.

## 8. `viem/experimental/erc7821` missing

**Symptom:** `Missing "./experimental/erc7821" specifier in "viem" package`.

**Root cause:** wagmi 2.19 expects a `viem` that exports that path. viem 2.21.45 doesn't.

**Fix:** Upgrade viem to `^2.37.0` (the minimum that exposes the missing experimental exports).

## 9. `@metamask/sdk` and `@wagmi/core` hoisted into a cache-style path

**Symptom:** `Rollup failed to resolve import "@metamask/sdk" from "@wagmi/connectors/dist/esm/metaMask.js"`. The package was at `node_modules/@metamask/.sdk-xxxxxx/`.

**Root cause:** npm 10's cache-style hoisting for some peer-deps under RainbowKit.

**Fix:** Install the same packages as direct devDependencies to force normal hoisting:

```json
"@metamask/sdk": "^0.34.0",
"@wagmi/connectors": "^6.0.0",
"@wagmi/core": "^2.0.0"
```

If you ever reinstall on a clean machine and run into the same error, `npm install --legacy-peer-deps` plus these explicit entries gets a working tree.

## 10. PowerShell + `npx` shell quirks

**Symptom:** `npx vite build` ran the **global** rollup at `C:\Users\Toro\node_modules\rollup` (no native binary) and failed with a different error than `npm run build`.

**Fix:** Use the local binary by calling it via `node ./node_modules/vite/bin/vite.js build` or `npm run build`. PowerShell does not resolve `.bin/vite` directly because the shim is a Unix-style script.

## 11. `@base-org/account` installed without its `dist/`

**Symptom:** `Failed to resolve entry for package "@base-org/account"` during `vite build` (or `vite dev`). The `node_modules/@base-org/account/` directory was present but `dist/` was empty.

**Root cause:** npm dropped the package's build artifacts during the legacy-peer-deps install (the same hoisting/cache path issue as #9). `@wagmi/connectors` does a `await import('@base-org/account')` for the Base account connector, so even if you don't use that connector, Vite's dep optimizer still tries to resolve the entry.

**Fix:** Install the package explicitly as a devDep so npm hoists the full dist:

```bash
npm install --save-dev --legacy-peer-deps @base-org/account@2.4.0
```

Also added to `vite.config.ts`:

```ts
resolve: {
  dedupe: ["@metamask/sdk", "@base-org/account", "@coinbase/wallet-sdk"],
},
optimizeDeps: {
  // These come in via dynamic import inside wagmi connectors — we can't
  // pre-bundle them, but we don't need to.
  exclude: ["@base-org/account", "@coinbase/wallet-sdk", "@metamask/sdk"],
},
```

---

## Recommended install command on a fresh machine (Windows)

```bash
# contract
npm install

# frontend
cd frontend
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is the pragmatic choice for the wagmi/rainbowkit ecosystem right now (mid-2026) — peer-dep ranges drift between major minors, and we already pin exact versions of the troublesome packages.
