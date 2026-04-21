import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { TOKENS } from '../constants/contracts'
import { useTokenData } from '../hooks/useTokenData'

function TokenItem({ tokenAddress }: { tokenAddress: `0x${string}` }) {
  const { address } = useAccount()
  const { name, symbol, decimals, balance, isLoading } = useTokenData(tokenAddress, address)

  if (isLoading) return <div style={{ color: '#aaa', margin: '10px 0' }}>Cargando datos del token {tokenAddress.slice(0, 6)}...</div>

  if (!name || decimals === null || balance === null) {
    return <div style={{ color: '#aaa', margin: '10px 0' }}>Falló la consulta al token en la red conectada.</div>
  }

  const formattedBalance = formatUnits(balance, decimals)

  return (
    <div style={{
      border: '1px solid var(--accent-border)',
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: 'var(--accent-bg)',
      marginBottom: '10px'
    }}>
      <h3 style={{ marginTop: 0, color: 'var(--text-h)' }}>{name} ({symbol})</h3>
      <p style={{ margin: '8px 0', fontSize: '1.2em' }}>
        <strong>{formattedBalance}</strong> {symbol}
      </p>
    </div>
  )
}

export function TokenBalances() {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '24px',
      backgroundColor: 'var(--code-bg)',
      color: 'var(--text)'
    }}>
      <h2 style={{ margin: 0, color: 'var(--text-h)' }}>Saldos de Tokens (ERC-20) en Sepolia</h2>
      <hr style={{ borderColor: 'var(--border)', margin: '20px 0' }} />
      {TOKENS.map((token) => (
         <TokenItem key={token.address} tokenAddress={token.address} />
      ))}
    </div>
  )
}