import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'

export const config = getDefaultConfig({
  appName: 'Entrega 1 - Taller de Tecnologias',
  projectId: 'c0f7bdfce78a1a36270dd14e45c479fb', // Hex string de 32 caracteres exigido por WalletConnect/RainbowKit
  chains: [sepolia],
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  ssr: false, // Es una app sencilla de React
})