# Entrega 1 - dApp en Sepolia (Taller de Tecnologías)

Esta es una aplicación React de página única construida con Vite, TypeScript, wagmi, viem y RainbowKit, cumpliendo estrictamente con los requerimientos entregables.

## Requisitos Previos

- Asegúrate de tener instalado **Node.js (versión 18+ o LTS)**.

## Instrucciones para Ejecutar Localmente

1. Navega hacia la carpeta `frontend`:
   ```bash
   cd frontend
   ```

2. Instala las dependencias del proyecto:
   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo local:
   ```bash
   npm run dev
   ```

4. Abre en tu navegador.

## Tokens de Prueba y Red

La dApp interactúa **exclusivamente con la Testnet de Sepolia**.
A continuación, están las direcciones (Contract Addresses) de los dos tokens ERC-20 elegidos para consultar balance, nombre y símbolo:

- **USDC (Testnet Sepolia):** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **LINK (Testnet Sepolia):** `0x779877A7B0D9E8603169DdbD7836e478b4624789`

## Notas y Principios de Arquitectura Cumplidos
- **TypeScript Estricto:** La aplicación corre con `tsc -noEmit` limpio y no se usó el tipo `any`.
- **Archivos Modulares:** La lógica Web3 está separada en *Custom Hooks* (`/src/hooks`) de manera modular.
- **Ruteo Condicional:** El panel de información permanece oculto si la wallet está desconectada. Muestra identificador, saldo `ETH` (4 decimales) en vivo, número de bloque actualizado y estado de 2 tokens.
