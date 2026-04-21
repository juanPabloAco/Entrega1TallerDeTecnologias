import { ConnectButton } from '@rainbow-me/rainbowkit'

export function ConnectSection() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '20px'
    }}>
      <h1>🎓 Entrega 1 - Taller de Tecnologías</h1>
      <p>Por favor, conecta tu billetera para interactuar con la dApp en Sepolia.</p>
      <ConnectButton />
    </div>
  )
}