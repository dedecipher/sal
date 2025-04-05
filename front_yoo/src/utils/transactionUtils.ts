import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

export const sendSol = async (amount: number, fromPrivateKey: string, toPublicKey: string) => {
  try {
    console.log('Setting up Solana connection...');
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    console.log('Creating sender keypair...');
    const decodedPrivateKey = bs58.decode(fromPrivateKey);
    console.log('Private key decoded successfully');
    
    const fromKeypair = Keypair.fromSecretKey(decodedPrivateKey);
    console.log('Sender public key:', fromKeypair.publicKey.toString());
    
    console.log('Creating recipient public key...');
    const toPublicKeyObj = new PublicKey(toPublicKey);
    console.log('Recipient public key:', toPublicKeyObj.toString());
    
    // 잔액 확인
    const balance = await connection.getBalance(fromKeypair.publicKey);
    console.log('Current balance:', balance / LAMPORTS_PER_SOL, 'SOL');
    
    if (balance < amount * LAMPORTS_PER_SOL) {
      throw new Error(`Insufficient balance. Required: ${amount} SOL, Available: ${balance / LAMPORTS_PER_SOL} SOL`);
    }
    
    console.log('Creating transaction...');
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKeyObj,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );
    
    console.log('Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;
    
    console.log('Signing and sending transaction...');
    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    console.log('Transaction sent. Signature:', signature);
    
    console.log('Confirming transaction...');
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    console.log('Transaction confirmed successfully!');
    return signature;
  } catch (error) {
    console.error('Transaction failed with error:');
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    throw error;
  }
}; 