# GibberLink SDK

A modular SDK for audio-based message encoding and transmission using GL MODE with secure Solana transaction support.

## Features

- Audio-based message encoding and decoding
- Secure messaging with encryption and signature verification
- Solana transaction support for agent-to-agent payments
- Agent directory service integration
- Support for visualization with AnalyserNode
- Pre-signed transaction requests (invoices)

## Installation

```bash
yarn add gibberlink-sdk
```

## Usage

### Basic Usage

```typescript
import { GibberLink } from 'gibberlink-sdk';

// Create a new GibberLink instance
const gibberlink = new GibberLink({ autoInit: true });

// Listen for messages
gibberlink.onMessage((message) => {
  console.log(`Received message: ${message.message} from ${message.source}`);
});

// Start listening for audio messages
await gibberlink.startListening();

// Send a message
await gibberlink.sendMessage('Hello, world!');

// Stop listening when done
await gibberlink.stopListening();
```

### Secure Messaging

```typescript
import { 
  GibberLink, 
  SecureMessaging, 
  DirectoryService,
  SolanaClient,
  AgentIdentity 
} from 'gibberlink-sdk';

// Set up agent identity for this client
const myIdentity: AgentIdentity = {
  id: 'agent-123',
  publicKey: 'solana-public-key-here',
  name: 'Agent Smith',
  phoneNumber: '+1-555-123-4567'
};

// Create a GibberLink instance
const gibberlink = new GibberLink({ autoInit: true });

// Set up the directory service for agent discovery
const directoryService = new DirectoryService({
  serviceUrl: 'https://agent-directory.example.com/api'
});

// Create a Solana client
const solanaClient = new SolanaClient({
  rpcEndpoint: 'https://api.devnet.solana.com',
  agentIdentity: myIdentity,
  directoryService
});

// Create the secure messaging layer
const secureMessaging = new SecureMessaging({
  gibberlink,
  solanaClient,
  directoryService,
  agentIdentity: myIdentity
});

// Start secure messaging
await secureMessaging.start();

// Add a listener for secure messages
secureMessaging.addMessageListener((event) => {
  console.log(`Received ${event.type} from ${event.sender}: ${event.content}`);
});

// Send a secure text message
await secureMessaging.sendSecureTextMessage('recipient-agent-id', 'Hello securely!');
```

### Solana Transactions

```typescript
import { 
  SecureMessaging, 
  MessageType, 
  TransactionPayload 
} from 'gibberlink-sdk';

// Assuming secureMessaging is already set up as in the previous example

// Listen for transaction requests
secureMessaging.addMessageListener((event) => {
  if (event.type === MessageType.TRANSACTION_REQUEST) {
    const request = event.content;
    console.log(`Received payment request for ${request.payload.amount} lamports`);
    
    // Verify and respond to the transaction
    if (verifyTransaction(request)) {
      // Approve and execute the transaction
      solanaClient.sendTransaction(request).then(response => {
        // Send the response back to the requester
        secureMessaging.sendTransactionResponse(event.sender, response);
      });
    } else {
      // Reject the transaction
      secureMessaging.sendTransactionResponse(event.sender, {
        status: 'rejected',
        error: 'Transaction verification failed'
      });
    }
  }
});

// Create and send a transaction request (like an invoice)
const transactionPayload: TransactionPayload = {
  amount: 1000000, // 0.001 SOL in lamports
  memo: 'Payment for services',
  reference: 'INV-2023-001'
};

// Send the transaction request
await secureMessaging.sendTransactionRequest('recipient-agent-id', transactionPayload);
```

### Audio Visualization

```typescript
import { GibberLink } from 'gibberlink-sdk';
import AudioMotionAnalyzer from 'audiomotion-analyzer';

const gibberlink = new GibberLink({ autoInit: true });

// Create an analyser node
const analyserNode = gibberlink.createAnalyserNode();

// Initialize AudioMotion-Analyzer
const container = document.getElementById('visualization');
const audioMotion = new AudioMotionAnalyzer(container, {
  source: analyserNode,
  height: 300,
  mode: 6, // Oscilloscope mode
  fillAlpha: 0.7,
  lineWidth: 2,
});

// Start listening
await gibberlink.startListening();
```

## API Reference

The SDK provides several key components:

### GibberLink
The core audio communication layer for GL MODE encoding/decoding.

### SecureMessaging
A higher-level messaging layer with encryption, signatures, and Solana integration.

### SolanaClient
Handles Solana blockchain transactions, signatures, and verification.

### DirectoryService
Provides a registry of AI agents with their identities and public keys.

See the TypeScript declarations for full API details.

## Security Features

- Message encryption using AES-GCM
- Digital signatures for message authentication
- Nonce generation for transaction uniqueness
- Block time and timestamp verification
- Transaction expiration for time-limited validity
- Checksums for data integrity validation

## License

MIT 