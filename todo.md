# Plan de Implementación: dApp Web3 en Sepolia

Este documento detalla las tareas específicas, ordenadas por prioridad de ejecución, para cumplir con todos los requerimientos de la entrega.

## FASE 1: Migración a TypeScript y Entorno (Prioridad: ALTA)
- [ ] **1.1.** Instalar dependencias de TypeScript: `npm install -D typescript @types/react @types/react-dom @types/node`.
- [ ] **1.2.** Crear archivo `tsconfig.json` y `tsconfig.node.json` configurados en modo estricto (`"noEmit": true`, `"strict": true`).
- [ ] **1.3.** Renombrar extensiones:
  - Cambiar `src/main.jsx` a `src/main.tsx`.
  - Cambiar `src/App.jsx` a `src/App.tsx`.
- [ ] **1.4.** Actualizar `index.html` para que apunte a `/src/main.tsx`.
- [ ] **1.5.** Añadir script `"typecheck": "tsc -noEmit"` en el `package.json`.
- [ ] **1.6.** Verificar que el proyecto compile correctamente corriendo `npm run dev` y `npm run typecheck`.

## FASE 2: Instalación y Configuración Web3 (Prioridad: ALTA)
- [ ] **2.1.** Instalar stack estipulado: `npm install wagmi viem @tanstack/react-query @rainbow-me/rainbowkit`.
- [ ] **2.2.** Crear archivo `src/config/wagmi.ts` y configurar Wagmi apuntando *exclusivamente* a la red `sepolia`.
- [ ] **2.3.** Crear componente `src/providers/Web3Provider.tsx`:
  - Envolver con `WagmiProvider`, `QueryClientProvider` y `RainbowKitProvider`.
- [ ] **2.4.** Aplicar `Web3Provider` en `src/main.tsx` o alrededor de `App` asegurando que los estilos de RainbowKit (`@rainbow-me/rainbowkit/styles.css`) sean importados.

## FASE 3: Lógica Web3 - Custom Hooks (Prioridad: MEDIA)
*(Regla estricta: Ningún archivo supera las ~200 líneas)*
- [ ] **3.1.** Definir direcciones de 2 tokens estables en Sepolia (ej. USDC, LINK o equivalentes de testnet) y sus ABIs (mínimo `name`, `symbol`, `decimals`, `balanceOf`).
- [ ] **3.2.** Crear hook `src/hooks/useNetworkStatus.ts`:
  - Implementar uso de `useBlockNumber` (wagmi) para escuchar cambios de bloque en tiempo real.
- [ ] **3.3.** Crear hook `src/hooks/useTokenData.ts`:
  - Implementar lógica con `useReadContracts` o `useReadContract` para obtener saldo, decimales, nombre y símbolo de un token dinámicamente. Tipar los retornos explícitamente.

## FASE 4: Componentes de Interfaz de Usuario (Prioridad: MEDIA)
*(Regla estricta: UI separada de lógica densa, archivos pequeños)*
- [ ] **4.1.** Crear `src/components/ConnectSection.tsx`:
  - Renderizar el botón destacado de conexión de RainbowKit customizado (o por defecto) para cuando no hay wallet conectada.
- [ ] **4.2.** Crear `src/components/AccountPanel.tsx`:
  - Usar `useAccount` y `useBalance` (wagmi).
  - Mostrar ENS o Address abreviada (`slice` del string).
  - Mostrar saldo nativo (ETH) formateado a exactamente 4 decimales.
  - Mostrar dinámicamente el número de bloque actual usando el hook `useNetworkStatus`.
- [ ] **4.3.** Crear `src/components/TokenBalances.tsx`:
  - Componente que reciba la address como prop o la obtenga del context.
  - Iterar por las 2 direcciones de tokens elegidos y renderizar sus saldos haciendo uso de `useTokenData`. Formatear los valores obtenidos con `formatUnits(balance, decimals)`.

## FASE 5: Integración Principal y Lógica de Ruteo Condicional (Prioridad: ALTA)
- [ ] **5.1.** Editar `src/App.tsx`:
  - Importar `useAccount` para leer `isConnected`.
  - **Estado Desconectado**: Mostrar solo `ConnectSection`.
  - **Estado Conectado**: Mostrar `<ConnectButton />` para permitir desconexión/cambio de red, e integrar `<AccountPanel />` y `<TokenBalances />`.
- [ ] **5.2.** Correr inspección final tipada (`npm run typecheck`) y linting para asegurar limpieza.

## FASE 6: Documentación y Entrega (Prioridad: MEDIA)
- [ ] **6.1.** Actualizar o crear `README.md` en el directorio raíz.
- [ ] **6.2.** Agregar instrucciones detalladas para ejecutar el proyecto localmente (`npm install` -> `npm run dev`).
- [ ] **6.3.** Documentar explícitamente las 2 direcciones de contrato de los tokens en Sepolia que se consultaron en la app.
- [ ] **6.4.** Validar requerimientos y reglas del Obligatorio (ej. confirmación de que no hay archivos con más de 200 líneas y no existe tipo `any`).