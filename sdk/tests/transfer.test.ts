import { SalClient } from '../src/sal/client';
import { SalHost } from '../src/sal/host';
import { IMessageTransport } from '../src/types/index';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as util from 'util';

// For detailed message logging
const DEBUG = true;

function logMessage(prefix: string, message: any) {
  if (DEBUG) {
    console.log(`${prefix}: ${typeof message === 'string' ? message : util.inspect(message, { depth: null })}`);
  }
}

// Create a message hub to route messages between client and host
class TestMessageHub {
  private hostTransport: TestTransport;
  private clientTransport: TestTransport;
  private messageCount = 0;

  constructor() {
    this.hostTransport = new TestTransport('host', this);
    this.clientTransport = new TestTransport('client', this);
  }

  getHostTransport(): TestTransport {
    return this.hostTransport;
  }

  getClientTransport(): TestTransport {
    return this.clientTransport;
  }

  routeMessage(source: string, message: string): void {
    this.messageCount++;

    try {
      // Parse message to determine appropriate routing
      const msgObj = JSON.parse(message);

      if (source === 'client') {
        logMessage(`[${this.messageCount}] CLIENT -> HOST`, msgObj);

        // Forward client message to host
        setTimeout(() => {
          this.hostTransport.receiveMessage(message);
        }, 10);
      } else if (source === 'host') {
        logMessage(`[${this.messageCount}] HOST -> CLIENT`, msgObj);

        // Forward host message to client
        setTimeout(() => {
          this.clientTransport.receiveMessage(message);
        }, 10);
      }
    } catch (error) {
      console.error(`Message routing error: ${error}`);
    }
  }
}

// Transport implementation for testing
class TestTransport implements IMessageTransport {
  private messageHandler: ((message: string) => void) | null = null;
  private sourceName: string;
  private hub: TestMessageHub;
  private isListening = false;

  constructor(sourceName: string, hub: TestMessageHub) {
    this.sourceName = sourceName;
    this.hub = hub;
  }

  async connect(): Promise<void> {
    // No-op for testing
  }

  async disconnect(): Promise<void> {
    // No-op for testing
  }

  async startListening(): Promise<boolean> {
    this.isListening = true;
    return true;
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
  }

  onMessage(handler: (message: string) => void): void {
    this.messageHandler = handler;
  }

  async sendMessage(message: string): Promise<void> {
    // Route message through hub
    this.hub.routeMessage(this.sourceName, message);
  }

  // Called by the hub to deliver a message to this transport
  receiveMessage(message: string): void {
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }
}

// Generate hardcoded keypairs (NEVER use these in production!)
function createTestKeypair(index: number): Keypair {
  if (index === 1) {
    // Client keypair: AxBA2GAB6QYcZLxApihFnbKpZqtpL3r7senqrBV7Bhob
    return Keypair.fromSecretKey(
      bs58.decode('4F547k4HhYkfbdCm2rNckqYxqBPgVQGsMNZ82RTPjic41Hi6c7Nv18FJz7rskWKFjLRs6CsatVGXYzkQUfARWdq7')
    );
  } else if (index === 2) {
    // Host keypair: 67AkYVgJkV6AWAn56y77UXpECsRCBmkEvRWWrqiMrXsA
    return Keypair.fromSecretKey(
      bs58.decode('3bxAJkxYddrqkSfv9E5StJegBnakSFvctWCLCUD48LZ22yb2ZMi3wfc3aNkWi6ffW5owjaME8MgWtGNW1PjCLjZE')
    );
  }

  // Fallback to deterministic generation if index not recognized
  const seed = new Uint8Array(32).fill(index);
  return Keypair.fromSeed(seed);
}

async function runTest() {
  console.log("Starting SAL transaction test...");

  // Create keypairs for client and host
  const clientKeypair = createTestKeypair(1);
  const hostKeypair = createTestKeypair(2);

  console.log('Client Public Key:', clientKeypair.publicKey.toString());
  console.log('Client Private Key:', bs58.encode(clientKeypair.secretKey));
  console.log('Host Public Key:', hostKeypair.publicKey.toString());
  console.log('Host Private Key:', bs58.encode(hostKeypair.secretKey));

  // Create message hub for communication
  const hub = new TestMessageHub();

  // Create host with test keypair
  const host = new SalHost({
    cluster: 'https://api.devnet.solana.com',
    phoneNumber: '+15555555555', // Dummy phone number for testing
    host: hostKeypair.publicKey.toString(),
    keyPair: hostKeypair
  }, hub.getHostTransport());
  // Start the host
  await host.run();
  console.log('Host is running');

  // Create client with test keypair
  const client = new SalClient({
    cluster: 'https://api.devnet.solana.com',
    keyPair: clientKeypair,
    testMode: true
  }, hub.getClientTransport());

  // Connect to host
  client
    .connect(hostKeypair.publicKey.toString())
    .onSuccess(() => {
      console.log('Client connected to host successfully');
      runTransaction();
    })
    .onFailure((error) => {
      console.error('Client connection failed:', error);
    });

  // Execute transaction after connection
  async function runTransaction() {
    try {
      console.log('Creating transaction...');

      // Create a transaction: 0.01 SOL with memo "Test payment"
      const serializedTx = await client.createSolTransaction(
        0.01,
        'Test payment',
        hostKeypair.publicKey.toString()
      );

      console.log('Serialized transaction:', serializedTx);
      console.log('Transaction created, sending to host...');

      // Send transaction to host for processing
      const signature = await client.sendTransaction(serializedTx);

      console.log('Transaction sent successfully!');
      console.log('Transaction signature:', signature);

      // Clean up
      await client.close();
      await host.stop();

    } catch (error) {
      console.error('Transaction error:', error);
    }
  }
}

// Run the test
runTest().catch(err => {
  console.error('Test failed:', err);
}); 