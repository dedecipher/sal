import { Keypair } from '@solana/web3.js';

export function generateKeyPair() {
  return Keypair.generate();
}
