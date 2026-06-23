# GUÍA — Setup y verificación end-to-end

Esta guía recorre, en orden, todo lo que tenés que hacer para:
1. Levantar el proyecto de cero
2. Correr la suite automatizada (cubre los criterios de evaluación de las 3 entregas)
3. Probar manualmente cada requerimiento contra el deploy de Sepolia ya hecho

> **TL;DR** — Si ya tenés `node_modules` y `frontend/.env` configurado:
> ```bash
> # Backend
> cd Entrega2 && npx hardhat test          # 68/68 passing
> # Frontend
> cd frontend && npm run dev                # http://localhost:5173
> ```

---

## 0. Prereq

| Herramienta | Versión | Para qué |
|---|---|---|
| **Node.js** | ≥ 20 | Hardhat + Vite |
| **npm** | ≥ 10 | gestor de paquetes |
| **MetaMask** (o Rabby) | última | wallet para Sepolia |
| **Sepolia ETH** | ~0.1 por cuenta | deployer + 3 signers necesitan ETH para pagar gas |

Faucets Sepolia: [Infura](https://www.infura.io/faucet/sepolia) · [Alchemy](https://www.alchemy.com/faucets/ethereum-sepolia) · [Google Cloud Web3](https://cloud.google.com/application/web3/faucet/ethereum/sepolia).

---

## 1. Setup inicial (una sola vez)

### 1.1 Backend — contratos

```bash
cd Taller/Entrega1TallerDeTecnologias/Entrga2/Entrega2
npm install
```

Editá `.env` (si todavía no existe, copialo de `.env.example`):

```bash
cp .env.example .env
# Editar .env y completar:
#   SEPOLIA_RPC_URL  -> endpoint JSON-RPC de Sepolia (Alchemy/Infura)
#   PRIVATE_KEY      -> clave del deployer (64 hex chars con 0x)
#   ETHERSCAN_API_KEY -> opcional, para verificar contratos
```

> El deployer **NO** se usa como signer del multisig. Los signers son wallets frescas generadas por `scripts/deploy.ts`.

Compilar y verificar que todo está OK:

```bash
npx hardhat compile        # 15 archivos, sin warnings
```

### 1.2 Sincronizar ABIs al frontend

Este paso es **obligatorio** si clonaste el repo de cero o si modificaste un contrato. Copia las 3 ABIs a `frontend/src/contracts/`:

```bash
npm run sync:abi
# Output esperado:
#   ABI copied: Multisig.abi.ts (37 entries)
#   ABI copied: JobMarketplace.abi.ts (34 entries)
#   ABI copied: MockERC20.abi.ts (19 entries)
```

### 1.3 Frontend

```bash
cd frontend
npm install --legacy-peer-deps    # necesario por conflictos wagmi/rainbowkit/viem en npm 10
```

Configurá las direcciones (si están vacías):

```bash
# frontend/.env
VITE_MULTISIG_ADDRESS=0x1e912Efb93b100931b094373D252b8Ef4379d37D
VITE_MARKETPLACE_ADDRESS=0x4598f9b1F6A3E7826E015CD0B8FCE075e2CFe58b
VITE_TOKEN_ADDRESS=0x58e2f930d0cD5C8A69cdd54b78A21677Ba335f0D
VITE_WC_PROJECT_ID=               # opcional (WalletConnect QR)
VITE_ALCHEMY_API_KEY=             # opcional, evita rate limits de publicnode
```

---

## 2. Tests automatizados

```bash
cd Entrega2
npx hardhat test
```

Resultado esperado: **68 passing (1s)** distribuidos en 3 suites:

| Suite | Tests | Qué cubre (criterios del PDF) |
|---|---|---|
| `JobMarketplace` | 36 | Happy path · rechazos en Open/Funded/Submitted · `claimRefund` post-expiry desde Funded y Submitted · control de acceso por rol · custom errors · ReentrancyGuard |
| `Multisig` | 26 | Proponer/aprobar/ejecutar/cancelar · doble aprobación rechazada · ejecución antes de threshold · gestión dinámica de signers vía self-call · invariantes de threshold |
| `JobMarketplace × Multisig` (integration) | 6 | Multisig como evaluator end-to-end (proponer → 2 firmas → ejecutar → pago al provider) · defensas (EOA no puede bypasear, doble ejecución, target call falla) · Multisig como evaluator rechazando |

Tests individuales por suite:

```bash
npx hardhat test test/JobMarketplace.test.ts
npx hardhat test test/Multisig.test.ts
npx hardhat test test/MultisigMarketplace.integration.test.ts
```

> Estos tests cumplen los criterios de evaluación de las 3 entregas a nivel contrato. Para Entrega 1 (wallet panel) no hay tests automatizados — la verificación es manual con la UI (sección 4).

---

## 3. Deploy local (Hardhat node) — opcional, para iterar rápido sin Sepolia

Si querés probar todo el flujo sin gastar Sepolia ETH:

```bash
# Terminal 1
cd Entrega2
npx hardhat node              # nodo local en chainId 31337 con cuentas pre-funded
```

```bash
# Terminal 2
cd Entrega2
npm run deploy:localhost      # deploya Multisig + Marketplace + MockERC20
# Output: addresses en consola + frontend/.env + SIGNERS.md
```

```bash
# Terminal 3
cd Entrega2/frontend
npm run dev                   # http://localhost:5173
```

Configurá MetaMask para que use `Localhost 8545` (chainId `31337`) e importá las private keys de los signers que escribió `SIGNERS.md`. El deployer y los signers ya tienen 1000 ETH pre-funded por Hardhat, así que podés probar todo sin faucet.

---

## 4. Levantar frontend contra Sepolia

```bash
cd Entrega2
npm run sync:abi              # por si modificaste algún contrato
npm run deploy:sepolia        # si todavía no deployaste (opcional)
cd frontend
npm run dev
# → http://localhost:5173
```

Abrí la URL y conectá MetaMask (debe estar en la red **Sepolia**, chainId `11155111`).

### Cómo importar los 3 signers en MetaMask

1. MetaMask → ícono de cuenta → "Importar cuenta" → "Clave privada"
2. Pegá cada PK de `SIGNERS.md`:

| # | Address | Private Key |
|---|---|---|
| 1 | `0x8d4aDCFD06592aEdb752DdC2E7Cfe74129Ee1b5C` | `0x19de6103528ea9b870222a1fcfa7d6676044e110457327b46b86c9e7ff3fe1f8` |
| 2 | `0x3B8C3fB6E1D150cD7AB6dd4A167fF6ed6ba909A2` | `0x0d19769fb7ff839e6d19facafc49fe9bba6d9ea3e95678b1d435d21eaa1b969d` |
| 3 | `0xDAbF5f21504803AF068f6ECDf84bd47a78f64549` | `0xf8f3f241494e561d34a071fe6bb7b10762d6c0e1eb170f3495e2ceb03013d239` |

3. Cada signer necesita ~0.01 Sepolia ETH para pagar gas. Usá un faucet por address.
4. Renombrá las cuentas en MetaMask (ej. "S1", "S2", "S3", "Provider", "EOA no-signer") para no confundirte.

---

## 5. Probar manualmente los requerimientos

### 5.1 — Entrega 1 (Wallet panel)

> El frontend no tiene una página dedicada a "Entrega 1". El equivalente es el `Header` (wallet info) y el `ContractInfo` (lectura de signers/threshold del Multisig). Los items 1 y 2 del spec son **deliverables que se mantienen** en la entrega final (el stack de wagmi/RainbowKit/viem).

| Requerimiento PDF | Dónde se cumple | Cómo verificarlo |
|---|---|---|
| **Panel de Cuenta**: wallet conectada | `Header.tsx` (botón RainbowKit) | Click "Connect Wallet" → elegir cuenta |
| Nombre ENS / address abreviada | `Header.tsx` muestra address abreviada | Conectá y mirá el botón |
| Saldo ETH (4 decimales) | `wagmi.ts` + `useAccount` | Conectá → saldo aparece arriba a la derecha |
| Bloque actual (auto-refresh) | `useJobs.ts:99` (refetchInterval 30s) | El tablero se sincroniza cada 30s |
| **Saldos de Tokens** ERC-20 | `useJobs.ts` + `useJobActions.ts` (`useTokenBalance`) | El formulario de crear job muestra el balance de mUSDC |
| `name()`, `symbol()`, `decimals()` | `MockERC20.abi.ts` los incluye | Las cards de job muestran el símbolo ("mUSDC") |
| Desconectar / reconectar | RainbowKit `ConnectButton` | Click en la cuenta → "Disconnect" |
| Solo botón de conexión cuando desconectado | `App.tsx` + `NotSignerBanner.tsx` | Desconectá → sólo aparece el botón de connect |

> **Items no implementados explícitamente como pantalla dedicada**:
> - Lectura del ENS nombre completo (sólo se muestra address abreviada — ENS lookup se puede agregar con `useEnsName` de wagmi si lo querés)
> - Lectura de 2 tokens ERC-20 en panel propio (sólo se muestra el balance del token del marketplace)
>
> El resto del stack (wagmi v2, viem, RainbowKit, TypeScript estricto) cumple el stack requerido del PDF. Si el corrector pide ENS o pantalla de tokens explícita, podés agregar `useEnsName` y un componente `TokenBalances.tsx` con 2 tokens fijos de Sepolia.

### 5.2 — Entrega 2 (Multisig)

Conectá con **Signer 1** y verificá:

| Requerimiento PDF | Cómo verificarlo |
|---|---|
| **Panel de Propuestas** | Sección "Multisig" abajo en la UI: lista de propuestas con ID, target, value, approvals/total, estado (Pending/Executed/Cancelled) |
| Crear propuesta | Form "New proposal": target=`0x4598...` (marketplace), value=`0`, calldata=click "Encode complete(jobId, reason)" con jobId=0, reason="approved-by-multisig" → "Propose transaction" |
| Aprobar propuesta | Click "Approve" en la card de la propuesta (con Signer 1) |
| Threshold enforcement | Intentar "Execute" con sólo 1 firma → botón deshabilitado, hint "Need 1 more approval(s)" |
| Ejecutar propuesta | Cambiá a Signer 2, aprobá → threshold=2 → Signer 3 hace "Execute" → JobCompleted |
| Botón Execute deshabilitado si no sos signer | Cambiá a una cuenta NO signer → los botones Approve/Execute/Cancel desaparecen |
| Cancelar propuesta | Como proposer, "Cancel" → la card pasa a estado "Cancelled" |
| **Formulario de Nueva Propuesta** | Form arriba a la izquierda: address, value, calldata, jobId, reason con botones "Encode complete" / "Encode reject" |
| **Panel de Información del Contrato** | Sección "Contract info" arriba: address, threshold (2), lista de 3 signers con links a Etherscan |
| Mensaje claro si no sos signer | `NotSignerBanner.tsx` → banner amarillo arriba |

### 5.3 — Entrega Final (Job Marketplace)

Para probar el flujo completo necesitás **4 cuentas en MetaMask**:
- **EOA no-signer**: cualquier address que no sea cliente/proveedor/signers (para verificar acceso)
- **Cliente**: deployer `0x3E72B2acFe0518B03fD7D7aD4B8f3e825E62dB9c` (PK en `.env`)
- **Proveedor**: cualquier EOA con mUSDC (lo mintás vía la app o transferís)
- **2-3 signers**: los de `SIGNERS.md`

#### Setup previo

El deployer tiene mUSDC por el deploy local. Para Sepolia necesitás mintear. **Workaround rápido**: usá uno de los signers como cliente (importá la PK de `SIGNERS.md:14` y faucetearle ETH), y otro como provider.

#### Flujo 1 — Happy path con EOA como evaluator

| # | Actor | Acción en la UI |
|---|---|---|
| 1 | Cliente | Form "Publicar Trabajo": description="Landing page", budget="100", evaluator=tu address (EOA), provider=tu address (EOA), duración=7 días → "Publicar Trabajo" |
| 2 | Cliente | Click "Detalle" en el job creado → "Aprobar mUSDC" → firma → "Fondear Trabajo" → firma |
| 3 | Proveedor | Cambiá de cuenta al provider → click "Detalle" → completar "hash/IPFS/CID/texto" → "Enviar Entrega" |
| 4 | Evaluador (EOA) | Cambiá al evaluador → click "Detalle" → completar reason="approved" → "Aprobar" |
| 5 | — | Job pasa a `Completed`, mUSDC llega al provider, badge verde en la card |

#### Flujo 2 — Multisig como evaluator (el principal del PDF)

| # | Actor | Acción en la UI |
|---|---|---|
| 1 | Cliente | Form "Publicar Trabajo": evaluator=Multisig (`0x1e912...`), provider=address EOA → publicar |
| 2 | Cliente | "Detalle" → "Aprobar mUSDC" + "Fondear Trabajo" |
| 3 | Provider | "Detalle" → "Enviar Entrega" con hash |
| 4 | Signer 1 | Form "New proposal": target=marketplace (`0x4598...`), value=0, jobId=0, reason="approved-by-multisig" → "Encode complete" → "Propose" |
| 5 | Signer 1 | Card de la propuesta: "Approve" |
| 6 | Signer 2 | Card de la propuesta: "Approve" (threshold=2 alcanzado, hint desaparece) |
| 7 | Signer 3 | Card de la propuesta: "Execute" → dispara `JobCompleted` en el marketplace |
| 8 | — | Job pasa a `Completed`, mUSDC al provider. El provider puede ver el resultado y verificar balance |

#### Flujo 3 — Rechazos

| Escenario | Acción |
|---|---|
| Cliente rechaza en Open (sin fondear) | Crear job → como cliente, "Detalle" → "Rechazar (Open)" con reason → estado `Rejected`, sin transferir tokens |
| Evaluador (EOA o Multisig) rechaza en Funded | Crear job + fondear → como evaluator, "Detalle" → "Rechazar" con reason → estado `Rejected`, cliente recibe refund íntegro |
| Evaluador rechaza en Submitted | Crear job + fondear + entregar → como evaluator, "Rechazar" → estado `Rejected`, cliente recibe refund |

#### Flujo 4 — Expiración y `claimRefund`

1. Crear job con duración="1 day" (preservación: usar 7+ días por el clock skew, o ajustar el test con `time.increase`)
2. Fondear y entregar
3. Esperar a que pase `expiresAt` (en testnet es rápido; en local usá `evm_increaseTime`)
4. Desde **cualquier** cuenta (incluso una EOA no-signer) → "Detalle" del job → "Reclamar Reembolso"
5. Estado pasa a `Expired`, cliente recibe refund

#### Verificaciones de UX

| Requerimiento | Cómo verificarlo |
|---|---|
| Conexión RainbowKit | Botón "Connect Wallet" arriba a la derecha |
| Estado pending durante confirmación | Click cualquier acción → texto "Confirm in wallet…" → "Tx pending…" → "✓ confirmed" |
| Refresh automático sin recargar | Al confirmar una tx, el tablero se actualiza solo (los watchers invalidan queries) |
| Errores legibles al revertir | Provocar revert (ej. setProvider siendo no-client) → aparece banner rosa con el custom error en español |
| Sin datos simulados | El tablero lee `getJob(i)` on-chain en cada `refetch` (cada 30s); no hay mocks en `useJobs.ts` |

---

## 6. Comandos de troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `HH411: library @openzeppelin/contracts not installed` | `node_modules` incompleto | `rm -rf node_modules && npm install` |
| `Cannot find module './Multisig__factory'` | typechain-types desactualizado | `npx hardhat clean && npx hardhat compile` |
| Frontend muestra "Falta configurar VITE_MARKETPLACE_ADDRESS" | `frontend/.env` falta o está mal | Completar `frontend/.env` con las 3 addresses |
| Tablero muestra "Loading Job #N…" indefinido | RPC rate-limited | Agregar `VITE_ALCHEMY_API_KEY=<tu_key>` en `frontend/.env` |
| `DeadlineInPast` al crear job | Clock skew entre navegador y chain | Usar presets de 7+ días |
| `Multisig__factory` not found en typechain | Falta correr compile después de cambios | `npx hardhat clean && npx hardhat compile && npm run sync:abi` |
| `wagmi/chains no member sepolia` | Dependencias sin `--legacy-peer-deps` | `cd frontend && rm -rf node_modules && npm install --legacy-peer-deps` |

---

## 7. Resumen de comandos

```bash
# Tests (cubre criterios de las 3 entregas)
cd Entrega2 && npx hardhat test

# Sincronizar ABIs (obligatorio después de cambiar contratos)
cd Entrega2 && npm run sync:abi

# Deploy
cd Entrega2 && npm run deploy:localhost    # Hardhat node
cd Entrega2 && npm run deploy:sepolia      # Sepolia

# Frontend
cd Entrega2/frontend && npm run dev        # http://localhost:5173
cd Entrega2/frontend && npm run typecheck  # tsc --noEmit
cd Entrega2/frontend && npm run build      # producción
```
