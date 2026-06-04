export function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function isValidHexData(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "0x") return true;
  return /^0x[0-9a-fA-F]*$/.test(trimmed) && (trimmed.length - 2) % 2 === 0;
}

export function normalizeHexData(value: string): `0x${string}` {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "0x") return "0x";
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
}
