import { parseAbi } from 'viem'

// Contratos ERC-20 reales en la Testnet de Sepolia
export const TOKENS = [
  {
    symbol: 'USDC',
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
  {
    symbol: 'LINK',
    address: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
  }
] as const

// Minimal ABI para interactuar con balance y meta-info de tokens ERC-20
export const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)'
])