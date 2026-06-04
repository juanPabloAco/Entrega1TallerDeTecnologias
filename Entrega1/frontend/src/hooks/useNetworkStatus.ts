import { useBlockNumber } from 'wagmi'

export function useNetworkStatus() {
  const { data: blockNumber, isError, isLoading } = useBlockNumber({
    watch: true, // Escucha actualizaciones de bloques en tiempo real
  })

  return {
    blockNumber: blockNumber ? Number(blockNumber) : null,
    isError,
    isLoading
  }
}