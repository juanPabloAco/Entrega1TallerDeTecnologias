import { useReadContracts } from 'wagmi'
import { ERC20_ABI } from '../constants/contracts'

type TokenDataResult = {
  name: string | null
  symbol: string | null
  decimals: number | null
  balance: bigint | null
}

export function useTokenData(tokenAddress: `0x${string}`, userAddress?: `0x${string}`): TokenDataResult & { isLoading: boolean, isError: boolean } {
  const tokenContractConfig = {
    address: tokenAddress,
    abi: ERC20_ABI,
  }

  const { data, isError, isLoading } = useReadContracts({
    contracts: [
      {
        ...tokenContractConfig,
        functionName: 'name',
      },
      {
        ...tokenContractConfig,
        functionName: 'symbol',
      },
      {
        ...tokenContractConfig,
        functionName: 'decimals',
      },
      {
        ...tokenContractConfig,
        functionName: 'balanceOf',
        args: userAddress ? [userAddress] : undefined,
      },
    ],
    query: {
      enabled: Boolean(userAddress && tokenAddress),
      refetchInterval: 5000,
    }
  })

  // Parsear resultados (useReadContracts devuelve [{ result, status }, ...])
  const name = data?.[0]?.result as string | undefined ?? null
  const symbol = data?.[1]?.result as string | undefined ?? null
  const decimals = data?.[2]?.result as number | undefined ?? null
  const balance = data?.[3]?.result as bigint | undefined ?? null

  return {
    name,
    symbol,
    decimals,
    balance,
    isLoading,
    isError,
  }
}