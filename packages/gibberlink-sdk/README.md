# GibberLink SDK

A modular SDK for audio-based message encoding and transmission using GL MODE.

## Features

- Audio-based message encoding and decoding
- Event-based message handling
- Support for visualization with AnalyserNode
- Extensible architecture with pluggable components
- Solana blockchain integration (placeholder)

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

### Solana Integration

```typescript
import { GibberLink, SolanaClient } from 'gibberlink-sdk';

// Create a new GibberLink instance
const gibberlink = new GibberLink();

// Create and initialize Solana client
const solanaClient = new SolanaClient({
  rpcEndpoint: 'https://api.devnet.solana.com'
});
await solanaClient.initialize();

// Now you can use both together
gibberlink.onMessage(async (message) => {
  // Process message and interact with Solana
  const response = `Processed: ${message.message}`;
  await gibberlink.sendMessage(response);
});

await gibberlink.startListening();
```

## API Reference

See the TypeScript declarations for full API details.

## License

MIT 