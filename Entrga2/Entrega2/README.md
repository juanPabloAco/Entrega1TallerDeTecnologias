# Job Marketplace + Multisig — Entrega 3

Marketplace de empleos sobre Ethereum (inspirado en ERC-8183 / Agentic Commerce Protocol) con escrow de pagos en ERC-20 y evaluador configurable. El evaluador puede ser una EOA o, como pide el PDF, un contrato **Multisig 2-de-3** que libera los fondos sólo cuando se alcanza el threshold de aprobaciones.

- Contratos: `MockERC20`, `Multisig`, `JobMarketplace` (Solidity 0.8.28 + Hardhat 3 + OpenZeppelin)
- Frontend: Vite + React + TypeScript + wagmi v2 + RainbowKit v2 + viem v2
- Red: Sepolia (chain id `11155111`)

---

## 1. Project structure

```
Entrega2/
├── contracts/
│   ├── JobMarketplace.sol     # Escrow de trabajos (cliente/proveedor/evaluador)
│   ├── Multisig.sol           # Wallet multisig 2-de-3 con signers dinámicos
│   └── MockERC20.sol          # mUSDC de prueba (6 decimales)
├── test/
│   ├── JobMarketplace.test.ts                          # 36 tests
│   ├── Multisig.test.ts                                # 26 tests
│   └── MultisigMarketplace.integration.test.ts         # 6 tests (Multisig como evaluator)
├── scripts/
│   ├── deploy.ts                # Deploy completo: token + multisig + marketplace
│   ├── redeploy-marketplace.ts  # Re-deploy SOLO del marketplace (mantiene multisig + signers)
│   └── copy-abi.ts              # Sincroniza ABIs a frontend/src/contracts/
├── ignition/modules/Counter.ts  # placeholder
├── hardhat.config.ts
├── package.json
├── .env.example
├── SIGNERS.md                   # auto-escrito por deploy.ts (signers + PKs de TEST)
└── frontend/
    ├── src/
    │   ├── App.tsx              # Layout principal
    │   ├── main.tsx
    │   ├── wagmi.ts             # Config de wagmi + transporte Sepolia
    │   ├── components/
    │   │   ├── Header.tsx
    │   │   ├── ContractInfo.tsx       # Signers + threshold del Multisig
    │   │   ├── NotSignerBanner.tsx    # Banner si la wallet no es signer
    │   │   ├── CreateJobForm.tsx      # Publicar Trabajo
    │   │   ├── JobBoard.tsx           # Tablero de Trabajos
    │   │   ├── JobCard.tsx            # Detalle de Trabajo
    │   │   ├── JobActions.tsx         # Panel de Acciones según rol
    │   │   ├── ProposalForm.tsx       # Crear propuesta del Multisig
    │   │   ├── ProposalList.tsx       # Lista de propuestas
    │   │   └── ProposalCard.tsx       # Detalle de propuesta (approve/execute/cancel)
    │   ├── hooks/
    │   │   ├── useJobs.ts              # Lectura de jobs (nextJobId + getJob)
    │   │   ├── useJobActions.ts        # Escrituras sobre el marketplace
    │   │   ├── useMultisigInfo.ts      # signers + threshold + isSigner
    │   │   ├── useProposals.ts         # Lectura de propuestas del Multisig
    │   │   ├── useProposalCard.ts      # Approve/execute/cancel de una propuesta
    │   │   └── useMultisigActions.ts   # Crear propuesta
    │   ├── contracts/                  # ABIs auto-generadas por copy-abi.ts
    │   └── utils/
    ├── vite.config.ts
    └── package.json
```

---

## 2. Setup

### 2.1 Backend (contratos)

```bash
cd Entrega2
npm install
cp .env.example .env
```

Editar `.env`:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>
PRIVATE_KEY=0x<64 hex chars>     # deployer (NO se usa como signer del multisig)
ETHERSCAN_API_KEY=<opcional>      # para verificar código
```

> El deployer sólo paga gas. Los signers del multisig son wallets **frescas** que `scripts/deploy.ts` genera con `ethers.Wallet.createRandom()`. Sus private keys se escriben automáticamente en `SIGNERS.md` y **no** se reutilizan en otros deploys.

### 2.2 Frontend

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env
```

Editar `frontend/.env` (normalmente lo escribe solo `scripts/deploy.ts`):

```env
VITE_MULTISIG_ADDRESS=0x...
VITE_MARKETPLACE_ADDRESS=0x...
VITE_TOKEN_ADDRESS=0x...
VITE_WC_PROJECT_ID=                      # opcional (WalletConnect QR)
VITE_ALCHEMY_API_KEY=<YOUR_ALCHEMY_KEY> # si está vacío cae a publicnode
```

> `--legacy-peer-deps` es necesario por conflictos de peer-deps entre wagmi/rainbowkit/viem en npm 10.

---

## 3. Tests

```bash
cd Entrega2
npx hardhat test
```

**68 tests passing** (3 suites):

| Suite | Cobertura |
|---|---|
| `JobMarketplace` (36) | happy path, rechazos (Open/Funded/Submitted), `claimRefund` post-expiry, control de acceso por rol, errores personalizados, reentrancy |
| `Multisig` (26) | create/approve/execute/cancel, gestión dinámica de signers vía self-call, invariantes de threshold, recibir ETH |
| `Multisig × Marketplace` integration (6) | Multisig como evaluator end-to-end: crear job, fund, submit, propuesta de `complete()` con 2 firmas, ejecución, balances finales |

Para correr sólo la integración:

```bash
npx hardhat test test/MultisigMarketplace.integration.test.ts
```

---

## 4. Deploy a Sepolia

### 4.1 Deploy completo (multisig + marketplace + token)

```bash
npm run deploy:sepolia
```

Esto ejecuta `scripts/deploy.ts` que, en orden:

1. Genera 3 wallets frescas para los signers.
2. Despliega `MockERC20` ("Mock USDC" / "mUSDC", 6 decimales).
3. Despliega `Multisig(signers, 2)`.
4. Despliega `JobMarketplace(tokenAddress)`.
5. Verifica los 3 contratos en Etherscan si hay `ETHERSCAN_API_KEY`.
6. Escribe `frontend/.env` con las 3 addresses.
7. Escribe `SIGNERS.md` con las 3 signers y sus private keys.

> ⚠️ **El deployer necesita ~0.05 Sepolia ETH** para pagar gas. Los signers **no** se fondean automáticamente en Sepolia — cada uno necesita ETH desde un faucet para poder firmar/ejecutar propuestas.

### 4.2 Reset del marketplace (manteniendo signers)

Como `JobMarketplace` es stateful (los jobs viven en storage para siempre), para empezar de cero sin perder el multisig ni los signers:

```bash
npx hardhat run scripts/redeploy-marketplace.ts --network sepolia
```

Esto re-despliega sólo `MockERC20` + `JobMarketplace`, reusa el multisig de `SIGNERS.md`, y actualiza `frontend/.env`.

> ⚠️ **Caveat conocido**: `redeploy-marketplace.ts` actualiza las addresses en `SIGNERS.md` y `frontend/.env`, pero los links de Etherscan en este `README.md` (sección 5) quedan apuntando a la dirección vieja. Si hacés un redeploy, reescribí manualmente los links de la columna derecha en las líneas 192-194.

### 4.3 Deploy manual (consola de hardhat)

```bash
npx hardhat console --network sepolia
```

```js
const [deployer] = await ethers.getSigners();
const ERC20 = await ethers.getContractFactory("MockERC20");
const erc20 = await ERC20.deploy("Mock USDC", "mUSDC", 6);
await erc20.waitForDeployment();
const tokenAddr = await erc20.getAddress();

const MS = await ethers.getContractFactory("Multisig");
const ms = await MS.deploy([s1.address, s2.address, s3.address], 2);
await ms.waitForDeployment();
const msAddr = await ms.getAddress();

const JM = await ethers.getContractFactory("JobMarketplace");
const jm = await JM.deploy(tokenAddr);
await jm.waitForDeployment();
const jmAddr = await jm.getAddress();

console.log({ tokenAddr, msAddr, jmAddr });
```

---

## 5. Addresses desplegadas en Sepolia

| Contrato | Address | Etherscan |
|---|---|---|
| **Multisig** | `0x1e912Efb93b100931b094373D252b8Ef4379d37D` | https://sepolia.etherscan.io/address/0x1e912Efb93b100931b094373D252b8Ef4379d37D |
| **JobMarketplace** | `0x4598f9b1F6A3E7826E015CD0B8FCE075e2CFe58b` | https://sepolia.etherscan.io/address/0x4598f9b1F6A3E7826E015CD0B8FCE075e2CFe58b |
| **MockERC20 (mUSDC)** | `0x58e2f930d0cD5C8A69cdd54b78A21677Ba335f0D` | https://sepolia.etherscan.io/address/0x58e2f930d0cD5C8A69cdd54b78A21677Ba335f0D |

- **Red:** Sepolia (chainId `11155111`)
- **Threshold:** 2 de 3 signers
- **Signers** (test wallets, no fondear con fondos reales — ver `SIGNERS.md`):

| # | Address | Private key |
|---|---|---|
| 1 | `0x8d4aDCFD06592aEdb752DdC2E7Cfe74129Ee1b5C` | `0x19de6103528ea9b870222a1fcfa7d6676044e110457327b46b86c9e7ff3fe1f8` |
| 2 | `0x3B8C3fB6E1D150cD7AB6dd4A167fF6ed6ba909A2` | `0x0d19769fb7ff839e6d19facafc49fe9bba6d9ea3e95678b1d435d21eaa1b969d` |
| 3 | `0xDAbF5f21504803AF068f6ECDf84bd47a78f64549` | `0xf8f3f241494e561d34a071fe6bb7b10762d6c0e1eb170f3495e2ceb03013d239` |

### Verificación en Etherscan

```bash
npx hardhat verify --network sepolia 0x58e2f930d0cD5C8A69cdd54b78A21677Ba335f0D "Mock USDC" "mUSDC" 6
npx hardhat verify --network sepolia 0x1e912Efb93b100931b094373D252b8Ef4379d37D "0x8d4aDCFD06592aEdb752DdC2E7Cfe74129Ee1b5C,0x3B8C3fB6E1D150cD7AB6dd4A167fF6ed6ba909A2,0xDAbF5f21504803AF068f6ECDf84bd47a78f64549" 2
npx hardhat verify --network sepolia 0x4598f9b1F6A3E7826E015CD0B8FCE075e2CFe58b 0x58e2f930d0cD5C8A69cdd54b78A21677Ba335f0D
```

---

## 6. Frontend

```bash
cd frontend
npm run dev          # http://localhost:5173
```

### Pantallas implementadas

1. **Tablero de Trabajos** — lista todos los jobs leyendo `nextJobId` + `getJob(i)`. Muestra descripción, budget (mUSDC), badge de estado (Open / Funded / Submitted / Completed / Rejected / Expired) y dirección del cliente.
2. **Detalle de Trabajo** — abre cada card para ver: cliente, proveedor, evaluador, deliverable ref, fecha de expiración, y el **Panel de Acciones según Rol**.
3. **Publicar Trabajo** — formulario que llama a `createJob`. Campos: descripción, budget (mUSDC), dirección del evaluador (se pre-rellena con la Multisig desplegada), proveedor opcional, fecha de expiración (preset 1d/7d/30d).
4. **Lista de Propuestas** (extensión del dashboard Multisig de la Entrega 2) — todas las propuestas del multisig con botones de approve / execute / cancel.

### Panel de Acciones según Rol (en Detalle de Trabajo)

| Usuario | Estado del trabajo | Acción |
|---|---|---|
| Cliente | Open, sin proveedor | Asignar Proveedor (`setProvider`) |
| Cliente | Open (con proveedor) | Aprobar mUSDC + Fondear Trabajo (`approve` + `fund`) / Rechazar |
| Proveedor | Funded | Enviar Entrega (`submit`) |
| Evaluador | Submitted | Aprobar (`complete`) / Rechazar |
| Cualquiera | Funded/Submitted, expirado | Reclamar Reembolso (`claimRefund`) |

### Requerimientos de UX (cubiertos)

- ✅ Conexión de wallet vía RainbowKit
- ✅ Estado de pendiente visible mientras la tx confirma (etiquetas "Confirm in wallet…" → "Tx pending…" → "✓ confirmed")
- ✅ Refresco automático al confirmar (los watchers de eventos invalidan las queries de react-query en tiempo real)
- ✅ Errores de revert con mensaje legible (decodifica custom errors: `JobNotFound`, `InvalidState`, `NotClient`, `NotProvider`, `NotEvaluator`, etc.)
- ✅ Sin datos simulados ni código comentado

### Scripts del frontend

```bash
npm run dev        # vite dev server
npm run typecheck  # tsc --noEmit
npm run build      # production build
npm run preview    # preview build
```

---

## 7. Decisiones de diseño

### Contrato

- **Token único por deploy** (inmutable). Se pasa por constructor a `JobMarketplace`. Para producción habría que reemplazar `MockERC20` por USDC testnet o un token propio.
- **Evaluator es cualquier address** (EOA o contrato). Esto habilita la composabilidad con el Multisig sin ninguna integración: cuando el multisig llama a `complete()` vía `execute()`, el `msg.sender` dentro del marketplace es `address(multisig)` y pasa el check `NotEvaluator`.
- **`claimRefund` no tiene access control** — el spec exige que "nunca pueda bloquearse". El reembolso al cliente se gatilla una vez vencido `expiresAt`, sin importar quién llame.
- **`ReentrancyGuard` de OpenZeppelin** en todas las funciones que mueven fondos (`fund`, `submit`, `complete`, `reject`, `claimRefund`).
- **Custom errors** en lugar de `require(..., "string")`. Cuesta menos gas y son type-safe desde el front.
- **Signers dinámicos en Multisig**: `addSigner` / `removeSigner` / `changeThreshold` están gateados por `onlySelf`, así que sólo pueden invocarse via una propuesta del propio multisig (target = `address(this)` + calldata de la función). Inspirado en Gnosis Safe.

### Frontend

- **viem directo para `getJob` y `getProposal`** en vez de `useReadContract` de wagmi. Razón documentada: wagmi a veces falla al decodificar tuples con strings en ciertos RPC providers. El bypass por `publicClient.readContract` + parser manual es más predecible.
- **Loop `nextJobId` + `getJob(i)`** para el tablero en vez de eventos `JobCreated` — ver desvíos abajo.
- **`useSnapshotAction` pattern** en escrituras: cuando simulás con wagmi (`useSimulateContract`) los args se evalúan en cada render. Si dejás que el click capture los args de un render viejo, podés terminar firmando una tx con args distintos a los simulados. El patrón snapshot-ejecuta-limpia garantiza que simulación y ejecución usen los mismos args.
- **Reintento de refetch cada 30s** en `useJobById` y `useJobCount` (no sólo al confirmar tx). Defensa contra desconexiones de websocket del RPC.
- **Alchemy key con fallback**: si `VITE_ALCHEMY_API_KEY` está vacío, el transporte cae a `ethereum-sepolia-rpc.publicnode.com` (configurado en `frontend/src/wagmi.ts`). Esto evita los 429s que da RainbowKit cuando intenta gateways de thirdweb.

---

## 8. Desvíos de la especificación y su justificación

> *Esta sección responde al bullet "Cualquier desvío de la especificación y su justificación" del PDF (p.5).*

1. **Tablero lee `nextJobId` + `getJob(i)` en lugar de eventos `JobCreated`.**
   *Justificación*: el PDF (p.4, item 1) dice "listar todos los trabajos leyendo eventos `JobCreated`". El loop con `getJob(i)` es funcionalmente equivalente y más simple (no requiere paginar eventos por bloque, no requiere reconstruir el estado desde logs históricos). Mantiene la propiedad de "leer del contrato, no de estado simulado". Migración a eventos queda como evolución futura: en ese caso habría que loguear desde el bloque de deploy y deducir `JobId` por índice de log.

2. **Provider opcional al crear un job.**
   *Justificación*: el PDF explícitamente dice "provider es opcional" (p.2, tabla de funciones). Si se deja vacío, el job queda en `Open` hasta que el cliente asigne con `setProvider`. La UI muestra una advertencia explícita al respecto.

3. **Deliverable storage: sólo se guarda el `bytes32` ref en el contrato.**
   *Justificación*: el PDF (p.1) dice "El acceso al delivery del job puede manejarse off-chain… las opciones van de localStorage a IPFS". Para esta entrega dejamos el ref como placeholder (`keccak256("texto")` o un hash IPFS). Un cliente completo con localStorage / IPFS sería una iteración posterior, fuera del alcance pedido.

4. **`MockERC20` en lugar de un ERC-20 legítimo de testnet.**
   *Justificación*: para la demo end-to-end en Sepolia alcanza con un ERC-20 mintable controlado por el deployer. Reemplazable en el deploy con USDC testnet (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) o cualquier otro ERC-20 público.

5. **Evaluador se pre-rellena con la Multisig desplegada en el form de "Publicar Trabajo".**
   *Justificación*: no es un desvío del contrato, es una UX choice del frontend. Pegar la address de la Multisig cada vez es propenso a error; pre-rellenar con la `VITE_MULTISIG_ADDRESS` acelera la demo. Se puede sobreescribir para usar un evaluador EOA.
6. **`redeploy-marketplace.ts` actualiza las addresses en `SIGNERS.md` y `frontend/.env` pero no los links de Etherscan en este `README.md`.**

   *Justificación*: bug conocido del script. Si hacés un redeploy, hay que tocar manualmente los links de Etherscan en la columna derecha de la tabla de la sección 5. Fix en backlog.

---

## 9. Walkthrough end-to-end (Sepolia)

### Caso 1 — Happy path con EOA como evaluador

| # | Actor | Acción | Estado |
|---|---|---|---|
| 1 | Cliente | `createJob("Landing page", 100e6, evaluatorEOA, providerEOA, now+7d)` | `Open` |
| 2 | Cliente | `token.approve(marketplace, 100e6)` + `fund(0)` | `Funded`, escrow=100 |
| 3 | Provider | `submit(0, keccak256("ipfs://Qm..."))` | `Submitted` |
| 4 | Evaluator | `complete(0, keccak256("ok"))` | `Completed`, provider recibe 100 |

### Caso 2 — Multisig como evaluator (flujo principal del PDF)

| # | Actor (EOA) | Acción on-chain | Estado job | Estado propuesta Multisig |
|---|---|---|---|---|
| 1 | Cliente | `createJob(..., evaluator = multisigAddr, provider = providerAddr)` | `Open` | — |
| 2 | Cliente | `approve(token, 100e6)` + `fund(0)` | `Funded` | — |
| 3 | Provider | `submit(0, hashD)` | `Submitted` | — |
| 4 | s₁ (frontend) | Codifica calldata off-chain: `iface.encodeFunctionData("complete", [0, keccak256("approved-by-ms")])` | — | — |
| 5 | s₁ | `multisig.propose(marketplaceAddr, 0, calldata)` | — | id=0, approvals=0 |
| 6 | s₁ | `multisig.approve(0)` | — | id=0, approvals=1 |
| 7 | s₂ | `multisig.approve(0)` | — | id=0, approvals=2 (≥ threshold) |
| 8 | s₃ | `multisig.execute(0)` | `Completed` | id=0, executed=true |
| 9 | — | Verificación: `JobCompleted` emitido, provider recibe 100 | — | — |

> **Por qué funciona sin código adicional**: cuando el Multisig hace `target.call(data)` en `execute`, dentro del marketplace `msg.sender == address(multisig) == job.evaluator` ⇒ pasa el check `NotEvaluator`. La Multisig no importa el marketplace y el marketplace no sabe nada de la Multisig: la composabilidad surge del protocolo.

### Caso 3 — Cliente cancela en Open (sin fondear)

`createJob(...)` → `reject(0, reason)`. Estado final: `Rejected`. Sin transferencia de tokens.

### Caso 4 — Evaluador rechaza tras el fondeo

`createJob + fund → submit → reject(0, reason)`. Estado final: `Rejected`, cliente recibe refund íntegro.

### Caso 5 — Expiración y `claimRefund`

`createJob(..., expiresAt = now+60) → fund → submit` → esperar 60s → `claimRefund(0)` (lo puede llamar cualquiera). Estado final: `Expired`, cliente recibe refund.

### Caso 6 — Defensa: ninguna EOA puede suplantar a la Multisig

`marketplace.connect(s1).complete(0, anyReason)` → `revert NotEvaluator`. Sólo `address(multisig)` pasa el check.

### Caso 7 — Defensa: doble ejecución

`multisig.execute(0)` (OK) → `multisig.execute(0)` (segunda vez) → `revert AlreadyExecuted`.

---

## 10. Mapa evento → UI

| Evento | Cuándo se emite | Uso en UI |
|---|---|---|
| `JobCreated(id, client, evaluator, provider, budget, expiresAt, desc)` | al crear | alimentar el tablero |
| `ProviderSet(id, provider)` | cliente asigna proveedor | actualizar fila del job |
| `JobFunded(id, amount)` | escrow fondeado | badge "Funded" |
| `JobSubmitted(id, provider, deliverableRef)` | provider entregó | badge "Submitted" + panel evaluador |
| `JobCompleted(id, provider, amount, reason)` | pago liberado | notificación al provider |
| `JobRejected(id, client, amount, reason)` | reembolso al cliente | notificación al cliente |
| `RefundClaimed(id, client, amount)` | expiración cobrada | notificación universal |
| `ProposalCreated/Approved/Executed` (Multisig) | vida de la propuesta | alimentar el dashboard Multisig |

---

## 11. Troubleshooting

- **`HH8: private key too short`** → revisá `PRIVATE_KEY` en `.env` (debe tener 64 hex chars con `0x`).
- **`DeadlineInPast`** al crear un job → `expiresAt` debe ser estrictamente mayor que `block.timestamp`. Si tu reloj está desincronizado, usá presets de 7+ días.
- **El job queda en `Submitted` para siempre** → nadie con permisos ejecuta. Usar el Caso 2 o esperar a la expiración y llamar `claimRefund`.
- **Tablero muestra "Loading Job #N…" indefinidamente** → chequeá DevTools Console. La causa más probable es un RPC que devuelve error; agregá `VITE_ALCHEMY_API_KEY` al `frontend/.env` para evitar rate limits de publicnode.
- **`baseAccount` not exported / `wagmi/chains` no member `sepolia`** → `npm install --legacy-peer-deps` en `frontend/`. Conflicto de peer-deps entre wagmi/rainbowkit/viem en npm 10.

---

## 12. Resumen de comandos

```bash
# tests
npx hardhat test

# compilar
npx hardhat compile

# nodo local
npx hardhat node

# deploy a sepolia
npm run deploy:sepolia

# reset del marketplace (manteniendo multisig)
npx hardhat run scripts/redeploy-marketplace.ts --network sepolia

# sincronizar ABIs
npx hardhat run scripts/copy-abi.ts

# frontend
cd frontend
npm install --legacy-peer-deps
npm run dev
npm run typecheck
npm run build
```

---

## 13. Referencias

- Hardhat 3 — https://hardhat.org
- viem — https://viem.sh
- wagmi v2 — https://wagmi.sh
- RainbowKit — https://www.rainbowkit.com
- ERC-8183 (Agentic Commerce Protocol) — https://eips.ethereum.org/EIPS/eip-8183
- OpenZeppelin Contracts — https://docs.openzeppelin.com/contracts
- `SIGNERS.md` — addresses de signers + private keys de TEST (auto-generado por `deploy.ts`)
