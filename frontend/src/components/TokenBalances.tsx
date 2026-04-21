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
      border: '1px solid #444',
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: '#222',
      marginBottom: '10px'
    }}>
      <h3 style={{ marginTop: 0 }}>{name} ({symbol})</h3>
      <p style={{ margin: '8px 0', fontSize: '1.2em' }}>
        <strong>{formattedBalance}</strong> {symbol}
      </p>
    </div>
  )
}

export function TokenBalances() {
  return (
    <div style={{
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '24px',
      backgroundColor: '#1a1a1a',
      color: '#fff'
    }}>
      <h2>Saldos de Tokens (ERC-20) en Sepolia</h2>
      <hr style={{ borderColor: '#333', marginBottom: '20px' }} />
      {TOKENS.map((token) => (
         <TokenItem key={token.address} tokenAddress={token.address} />
      ))}
    </div>
  )
}