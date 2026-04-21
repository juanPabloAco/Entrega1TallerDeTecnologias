import { useAccount, useBalance, useEnsName } from 'wagmi'
import { formatEther } from 'viem'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function AccountPanel() {
  const { address } = useAccount()
  const { data: ensName } = useEnsName({ address })
  const { data: balance } = useBalance({ address })
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
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '20px',
      backgroundColor: '#1a1a1a',
      color: '#fff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Perfil de Billetera</h2>
        <ConnectButton />
      </div>
      <hr style={{ borderColor: '#333' }} />
      <p><strong>Identificador:</strong> {identifier}</p>
      <p><strong>Saldo (Sepolia ETH):</strong> {renderBalance()} ETH</p>
      <p><strong>Bloque Actual:</strong> {blockNumber ?? 'Sincronizando...'}</p>
    </div>
  )
}