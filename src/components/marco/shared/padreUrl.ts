import type { BoostToken, AdToken } from './types';

const chainMap: Record<string, string> = {
  SOL: 'solana',
  sol: 'solana',
  ETH: 'ethereum',
  eth: 'ethereum',
  BASE: 'base',
  base: 'base',
  BNB: 'bsc',
  bnb: 'bsc',
};

export function getPadreUrl(token: Pick<BoostToken | AdToken, 'chain' | 'tokenAddress'>): string {
  const chain = chainMap[token.chain] || token.chain.toLowerCase();
  return `https://trade.padre.gg/trade/${chain}/${token.tokenAddress}?rk=dexmultichain`;
}
