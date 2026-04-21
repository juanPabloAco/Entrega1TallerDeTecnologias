# [cite_start]Contexto y Requerimientos: Entrega 1 - Panel con Conexión de Wallet [cite: 1]

## 🤖 Comandos e Instrucciones para el Agente IA (System Prompt)

**Rol del Asistente:** Eres un desarrollador Frontend Web3 Senior experto en React, TypeScript y el ecosistema Ethereum.
**Objetivo Principal:** Asistir al usuario en la construcción de una dApp que cumpla estrictamente con los requerimientos detallados abajo, asegurando las mejores prácticas, código limpio y modularización.

**Reglas de Ejecución Críticas para la IA:**
1. [cite_start]**TypeScript Estricto:** El uso del tipo `any` está prohibido[cite: 19]. [cite_start]Todo el código debe compilar sin errores al ejecutar `tsc -noEmit`[cite: 24]. Debes tipar explícitamente los retornos de los hooks de `wagmi` y las respuestas de los contratos.
2. [cite_start]**Límites de Archivo:** Ningún archivo (componente, hook, utilidad) debe superar las ~200 líneas de código[cite: 25, 26]. Divide la lógica de UI y la lógica de Web3 (hooks personalizados) de manera coherente.
3. [cite_start]**Stack Tecnológico Intocable:** Solo puedes generar código usando React, `wagmi v2`, `viem` (o `ethers`), y RainbowKit (o ConnectKit)[cite: 19].
4. [cite_start]**Enfoque de Red:** Todas las interacciones, lecturas de contratos y configuraciones deben apuntar obligatoriamente a la testnet **Sepolia**[cite: 3, 14, 23].
5. **Sin Contratos:** No sugieras ni escribas código de contratos inteligentes (Solidity). [cite_start]El alcance de la entrega es exclusivamente de frontend[cite: 4, 5].

---

## 📝 Letra del Obligatorio (Especificaciones del Proyecto)

### Objetivo General
[cite_start]Construir una pequeña aplicación React de página única que se conecte a una wallet Ethereum real y lea datos en vivo desde la Blockchain (testnet)[cite: 3, 7].

### Flujo de Conexión y UI Principal
* [cite_start]**Estado Desconectado:** Cuando no haya billetera conectada, la UI debe ocultar el contenido y mostrar *únicamente* un botón de conexión destacado[cite: 17].
* [cite_start]**Estado Conectado:** El usuario debe poder desconectar y reconectar su billetera a voluntad[cite: 17]. [cite_start]La conexión debe funcionar correctamente mediante la UI de conexión elegida[cite: 21].
* [cite_start]Al estar conectado, se revelan dos secciones en la página[cite: 7]:

#### [cite_start]1. Panel de Cuenta [cite: 8]
[cite_start]Mostrar la siguiente información de la billetera conectada[cite: 9]:
* [cite_start]**Identificador:** El nombre ENS (si está disponible) o la dirección de la billetera de forma abreviada[cite: 10].
* [cite_start]**Saldo de ETH:** El saldo de ETH nativo de la cuenta, formateado a exactamente 4 decimales[cite: 11]. [cite_start]Este valor debe ser un dato en vivo[cite: 22].
* **Red:** El número de bloque actual. [cite_start]Este dato debe actualizarse en tiempo real (o mediante un intervalo corto de actualización) y no ser un valor estático[cite: 12, 22].

#### [cite_start]2. Saldos de Tokens ERC-20 [cite: 13]
[cite_start]Integrar la lectura de dos (2) tokens ERC-20 elegidos que ya estén desplegados en la red Sepolia (ej. USDC, LINK)[cite: 14, 23]. Para cada token, la aplicación debe consultar y mostrar:
* [cite_start]**Información del contrato:** El nombre y el símbolo, leídos mediante `name()` y `symbol()`[cite: 15, 23].
* [cite_start]**Saldo del Usuario:** El saldo de la billetera conectada en ese token específico, consultado mediante `balanceOf(address)`[cite: 15, 23].
* [cite_start]**Formateo:** Ambos valores numéricos deben mostrarse correctamente formateados utilizando la función `decimals()` del token[cite: 16].

### [cite_start]Formato de Entrega [cite: 27]
[cite_start]El código debe alojarse en un repositorio de GitHub[cite: 28]. [cite_start]Es obligatorio incluir un archivo `README.md` [cite: 28] en la raíz del proyecto que contenga:
1. [cite_start]Las instrucciones necesarias para ejecutar el proyecto localmente[cite: 29].
2. [cite_start]Las direcciones (contract addresses) exactas de los dos tokens en Sepolia que se utilizaron[cite: 30].