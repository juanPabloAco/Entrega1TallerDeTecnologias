export function truncateAddress(address: string, head = 6, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function formatEther(wei: bigint | undefined, decimals = 4): string {
  if (wei === undefined) return "—";
  const ether = Number(wei) / 1e18;
  if (ether === 0) return "0";
  if (ether < 0.0001) return "<0.0001";
  return ether.toFixed(decimals).replace(/\.?0+$/, "");
}
