import { useAccount, useBalance, useEnsName } from 'wagmi'
import { formatEther } from 'viem'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function AccountPanel() {
  const { address } = useAccount()
  const { data: ensName } = useEnsName({ address })
  const { data: balance } = useBalance({ 
    address,
    query: { refetchInterval: 5000 } // Refresca el saldo de ETH cada 5 segundos
  })
  const { blockNumber } = useNetworkStatus()

  // Formateo del balance a exactamente 4 decimales
  const renderBalance = () => {
    if (!balance) return '0.0000'
    const formatted = formatEther(balance.value)
    const floatValue = parseFloat(formatted)
    return floatValue.toFixed(4)
  }

  // Cortar la direccion si no hay ens
  const identifier = ensName ?? (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Desconocido')

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '20px',
      backgroundColor: 'var(--code-bg)',
      color: 'var(--text)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--text-h)' }}>Perfil de Billetera</h2>
        <ConnectButton />
      </div>
      <hr style={{ borderColor: 'var(--border)' }} />
      <p><strong>Identificador:</strong> {identifier}</p>
      <p><strong>Saldo (Sepolia ETH):</strong> {renderBalance()} ETH</p>
      <p><strong>Bloque Actual:</strong> {blockNumber ?? 'Sincronizando...'}</p>
    </div>
  )
}