/**
 * ASSET IDENTITY — the one rule every MARCOVAULT subsystem uses to decide
 * whether two provider records refer to the same asset.
 *
 *   assetKey(chainId, address) = `${chain}:${canonicalAddressForKey(address)}`
 *
 * Address canonicalisation is decided by the address's own SYNTAX, never by
 * the chain name:
 *
 *   - EVM-style hex (`0x` + hex digits) is case-insensitive — mixed case is
 *     only an EIP-55 checksum — so it is lowercased: `0xAbCd…` ≡ `0xabcd…`.
 *   - Anything else (Solana/Base58 and every other format) is case-sensitive
 *     and kept exactly as the provider sent it: `46vV3Z…` ≠ `46vv3z…`.
 *
 * The chain id is a provider slug (e.g. "solana", "base") and is lowercased.
 *
 * Keys are for lookup and deduplication only. Anything shown to the user,
 * copied, or put in a link must use the provider's original address — never
 * an address reconstructed from a key.
 */

const EVM_HEX_ADDRESS = /^0x[0-9a-f]+$/i;

/** True for `0x`-prefixed hex addresses, whose case carries no identity. */
export function isEvmHexAddress(address: string): boolean {
  return EVM_HEX_ADDRESS.test(address);
}

/** The form of `address` used inside identity keys. */
export function canonicalAddressForKey(address: string): string {
  return isEvmHexAddress(address) ? address.toLowerCase() : address;
}

/** The single MARCOVAULT asset identity key. */
export function assetKey(chainId: string, address: string): string {
  return `${chainId.toLowerCase()}:${canonicalAddressForKey(address)}`;
}

/** Whether two addresses are the same asset address under the identity rule. */
export function sameAddress(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a == null || b == null) return false;
  return canonicalAddressForKey(a) === canonicalAddressForKey(b);
}
