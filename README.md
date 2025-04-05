# GibberLink

<img src="https://avatars.githubusercontent.com/u/206302525?s=200&v=4"/>

GibberLink is a platform for audio-based message encoding and communication, designed to enable efficient communication between AI agents.

## Project Structure

This project is set up as a monorepo with the following components:

- `sdk`: The core SDK that handles audio-based message encoding
- `demo`: A Next.js application that demonstrates the SDK's capabilities

## Key Features

- Audio-based message encoding and decoding
- Solana blockchain payment integration
- Real-time audio visualization

## Getting Started

### Installing Dependencies

```bash
# Install SDK dependencies
cd sdk
yarn install

# Build the SDK
yarn build

# Install frontend demo dependencies
cd demo
yarn install
```

### Running the Demo

```bash
cd demo
yarn serve
```

Then open http://localhost:3003 in your browser.

### Running the Token Transfer Test (Client -> Server)

```bash
cd sdk
npx ts-node tests/transfer.test.ts
```

## SDK Usage

The dDecipher SDK supports two distinct roles:

1. **Client Role** - For applications that need to connect to a host and send/receive messages (e.g. Personal Assistant, etc.)
2. **Host Role** - For applications that accept connections from clients and process messages (e.g. Hotel, Restaurant, etc.)

### Client Example

```typescript
import { SalClient } from "ddecipher-sdk";
import { AudioMessageTransport } from "ddecipher-sdk";
import { Keypair } from "@solana/web3.js";

// Create keypair for secure communication
const keypair = Keypair.generate();

// Create message transport
const transport = new AudioMessageTransport();

// Create a new client instance
const client = new SalClient(
  {
    cluster: "https://api.devnet.solana.com",
    keyPair: keypair,
  },
  transport
);

// Connect to a host
client
  .connect("host-identifier")
  .onSuccess(() => {
    console.log("Connected successfully");
  })
  .onFailure((error) => {
    console.error("Connection failed:", error);
  });

// Start listening for incoming messages
await transport.startListening();

// Send a message
await client.send("Hello, world!");

// Close the connection when done
await client.close();
```

### Host Example

```typescript
import { SalHost } from "ddecipher-sdk";
import { AudioMessageTransport } from "ddecipher-sdk";
import { Keypair } from "@solana/web3.js";

// Create keypair for secure communication
const keypair = Keypair.generate();

// Create message transport
const transport = new AudioMessageTransport();

// Create a new host instance
const host = new SalHost(
  {
    cluster: "https://api.devnet.solana.com",
    phoneNumber: "+1234567890",
    host: "my-host-id",
    keyPair: keypair,
  },
  transport
);

// Register message and transaction handlers
host.register({
  messageHandler: async (message, sender) => {
    console.log(`Received message from ${sender}: ${message}`);
    // Process the message here
  },
  txHandler: async (transaction) => {
    // Process transactions if needed
    return "transaction-id";
  },
});

// Start the host
await host.run();

// Stop the host when done
await host.stop();
```

## License

MIT
