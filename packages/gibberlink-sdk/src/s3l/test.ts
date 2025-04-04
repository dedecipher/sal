import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import { S3lClient } from './client';
import { S3lHost } from './host';
import { Modality } from './types';

// Solana devnet endpoint
const SOLANA_ENDPOINT = "https://api.devnet.solana.com";

async function main() {
  console.log('S3L SDK Test with JSON Protocol and Voice Modality');
  
  // Generate keypairs for testing
  const hostKeypair = web3.Keypair.generate();
  const clientKeypair = web3.Keypair.generate();
  
  console.log(`Host public key: ${hostKeypair.publicKey.toString()}`);
  console.log(`Client public key: ${clientKeypair.publicKey.toString()}`);
  
  // Set up Solana connection
  const connection = new web3.Connection(SOLANA_ENDPOINT);
  
  // Fund test accounts with SOL
  try {
    console.log('\n--- Funding Test Accounts ---');
    // Fund client account
    console.log('Requesting airdrop for client account...');
    const clientAirdropSignature = await connection.requestAirdrop(
      clientKeypair.publicKey,
      web3.LAMPORTS_PER_SOL  // 1 SOL
    );
    await connection.confirmTransaction(clientAirdropSignature);
    console.log('Client account funded with 1 SOL');
    
    // Fund host account
    console.log('Requesting airdrop for host account...');
    const hostAirdropSignature = await connection.requestAirdrop(
      hostKeypair.publicKey,
      web3.LAMPORTS_PER_SOL  // 1 SOL
    );
    await connection.confirmTransaction(hostAirdropSignature);
    console.log('Host account funded with 1 SOL');
  } catch (error) {
    console.error('Error funding accounts:', error);
    console.log('Continuing with test anyway...');
  }
  
  // Initialize host
  console.log('\n--- Initializing Host with Voice Modality ---');
  const host = new S3lHost({
    cluster: SOLANA_ENDPOINT,
    host: 'hackathon.seoulana.kr',
    phoneNumber: '01012345678',
    privateKey: bs58.encode(Buffer.from(hostKeypair.secretKey)),
    modality: Modality.VOICE
  });
  
  // Set up host message handlers
  host.register({
    messageHandler: async (message, sender) => {
      console.log(`Host received message from ${sender}: ${message}`);
      return;
    },
    txHandler: async (tx) => {
      console.log('Host processing transaction:', {
        feePayer: tx.feePayer?.toString(),
        instructions: tx.instructions.length,
        signatures: tx.signatures.length
      });
      
      // In a real implementation, we would validate the transaction here
      // For this test, we'll sign and submit the transaction to devnet
      try {
        // Add host signature
        tx.partialSign(hostKeypair);
        
        // Submit to Solana network
        const connection = new web3.Connection(SOLANA_ENDPOINT);
        const signature = await connection.sendRawTransaction(tx.serialize());
        
        console.log('Transaction submitted to Solana devnet, signature:', signature);
        
        // Wait for confirmation
        console.log('Waiting for confirmation...');
        await connection.confirmTransaction(signature);
        console.log('Transaction confirmed!');
        
        return signature;
      } catch (error) {
        console.error('Error processing transaction:', error);
        throw error;
      }
    }
  });
  
  // Initialize host
  await host.init();
  
  // Start host
  console.log('\n--- Starting Host Voice Server ---');
  await host.run();
  
  console.log('\n--- Open the browser and navigate to http://localhost:3000/audio-test to test the Voice Modality ---');
  console.log('The test requires a modern browser with microphone and speaker access.');
  console.log('The browser test page will connect to the host and allow sending messages via audio.');
  
  // Initialize client
  console.log('\n--- Initializing Client ---');
  const client = new S3lClient({
    cluster: SOLANA_ENDPOINT,
    privateKey: bs58.encode(Buffer.from(clientKeypair.secretKey)),
    modality: Modality.VOICE
  });
  
  // Connect to host
  console.log('Connecting to host...');
  await new Promise<void>((resolve, reject) => {
    client
      .connect('hackathon.seoulana.kr')
      .onSuccess(() => {
        console.log('Client connected to host successfully');
        resolve();
      })
      .onFailure((error) => {
        console.error('Client failed to connect to host:', error);
        reject(error);
      });
  });
  
  // 메시지 테스트 실행
  await testMessages(client);
  
  // Transaction Test
  // ... existing code ...

  // ... rest of the code ...
}

// Run the test if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// 테스트 함수에 메시지 테스트 부분 수정
async function testMessages(client: S3lClient) {
  console.log('\n--- Testing Message Sending ---');
  
  // 텍스트 메시지 송신
  console.log('Sending text message to host...');
  await client.send('Hello from S3L client!');
  
  // JSON 메시지 송신
  console.log('Sending JSON message to host...');
  await client.send(JSON.stringify({
    type: 'test',
    content: 'This is a JSON message',
    timestamp: Date.now()
  }));
  
  // Voice 모달리티 테스트를 위한 추가 메시지 (오디오 파일 생성용)
  console.log('Sending special voice test message (for audio file generation)...');
  await client.send('This is a special voice test message that will be encoded to audio!');
  
  console.log('All messages sent successfully');
} 