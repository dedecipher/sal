# SSAL - Solana Secure Agents Layer

<img src="https://avatars.githubusercontent.com/u/206302525?s=200&v=4"/>

SSAL (Solana Secure Agents Layer) is a protocol and framework that enables secure autonomous agents on the Solana blockchain. It allows programs(agents) to manage wallets and sign transactions on behalf of users in a trust-minimized way. SSAL combines an on-chain Certificate Tree with a SSAL-SDK to ensure that only registered, staked agents can act, and their actions are cryptographically verified. In SSAL, agents must stake a dedicated asset (the Secure Token) to register, which incentivizes proper behavior and enables slashing (penalization) for misconduct. All token transactions (for example, using USDC) are handled with precise integer amounts (BigInt) to avoid any decimal precision issues.

This repository is set up as a monorepo with the following components:

- `sdk`: The core SDK that provide SSAL toolkit for AI Agent developer
- `demo`: A Next.js application that demonstrates the SDK's capabilities

---

## SSAL SDK

The SSAL-SDK is a collection of functions and protocols that agents use to securely communicate and perform transactions. It handles cryptographic operations like message encryption (capsulation) and decryption (decapsulation), data encoding/decoding, and transaction creation/signing. Key functions of the SSAL-SDK include following features

- Audio-based message encoding and decoding
- Solana blockchain payment integration
- Real-time audio visualization

### Getting Started

#### Installing Dependencies

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

#### Running the Demo

```bash
cd demo
yarn serve
```

Then open http://localhost:3003 in your browser.

#### Running the Token Transfer Test (Client -> Server)

```bash
cd sdk
npx ts-node tests/transfer.test.ts
```

### SDK Usage

The dDecipher SDK supports two distinct roles:

1. **Client Role** - For applications that need to connect to a host and send/receive messages (e.g. Personal Assistant, etc.)
2. **Host Role** - For applications that accept connections from clients and process messages (e.g. Hotel, Restaurant, etc.)

#### Client Example

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

#### Host Example

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

---

## Certificate Tree

While the SSAL-SDK handles peer-to-peer security, the Certificate Tree provides a global directory service to discover and verify agent identities. It acts as a decentralized “phonebook” or certificate authority (CA) layer, maintained by the Node Consensus Network (NCN) of validators. This structure ensures every agent’s identity is staked, verified, and recorded on-chain at regular intervals, preventing fraudulent or spam registrations.
The Certificate Tree is essentially a distributed, Merkle-tree-based registry of agent identity information (e.g., email, phone, IP, name) mapped to the agent’s public key. Each leaf in the Merkle tree represents a unique agent entry. Periodically, the Merkle root (a single 32-byte hash) is anchored on-chain, making the entire record set tamper-evident and publicly verifiable.

### Decentralization and the NCN

Instead of a single server controlling the directory, SSAL employs a Node Consensus Network (NCN) – a cluster of validator nodes that collectively manage the Certificate Tree. These validators:

1. Validate new identity proposals.
2. Reach consensus on updates.
3. Ensure the Merkle tree accurately reflects all registered agents at each epoch.

This system is analogous to certificate transparency logs in traditional Web PKI, but fully decentralized. It prevents fraudulent identity registrations and ensures a “ground truth” list of agents that anyone can verify.

### Registration of Identities

When a new AI agent wants to join SSAL’s trusted network (for example, a hotel booking agent wanting verifiable proof of its identity), it registers in the Certificate Tree through these steps:

1. Proposal Submission:
    - The agent submits a proposal containing contact info (name, domain, email, phone, IP) and its public key, alongside a certain amount of Secure Token locked as stake. This proposal is broadcast to the NCN validators.
2. Validator Challenge:
    - The NCN issues a nonce-based signature challenge. The agent must sign the nonce with the private key corresponding to the submitted public key, proving ownership. Optionally, validators may do additional checks like sending a verification code to the provided email or phone. The crucial check is cryptographic proof that the agent controls the key.
3. Voting:
    - After verification, each validator votes on whether to accept the new registration. If a majority (>50%) of validators approve it, the agent’s entry is provisionally accepted into the directory. (In a production system, a higher threshold may be used for better security.)
4. Provisional Acceptance:
    - Once approved by quorum, the agent’s data is added to the in-memory Merkle tree of pending entries. The agent is considered “registered” for practical purposes, but final on-chain confirmation occurs at the next epoch snapshot. If the proposal is rejected, the agent’s stake may be slashed or partially refunded, depending on the reason for rejection.

Requiring agents to lock up Secure Token for each registration provides effective Sybil resistance: creating many fake identities becomes economically unfeasible. Honest participants can eventually retrieve their stake upon deregistration, but attackers risk losing it to slashing if they attempt fraudulent registrations.

### Merkle Tree and Epoch Snapshots

The Certificate Tree collects new registrations, updates, and removals continuously. To finalize these changes trustlessly, SSAL operates in discrete epochs (for instance, weekly). At the end of each epoch, a snapshot of the entire directory is taken and committed on-chain:
- Merkle Tree Structure: All active agent entries exist as leaves in a Merkle tree. Each leaf is a hash of the agent’s identity record. By publishing just the tree’s Merkle root, the network captures the entire state in a single 32-byte hash. Anyone can verify that a particular identity is included by obtaining a Merkle proof (sibling hashes along the path to the root), eliminating the need to store the full dataset on-chain.
- Leader Selection: At each epoch, one validator (selected by rotation or stake-weight) becomes the Leader. This Leader aggregates all accepted changes (registrations, deregistrations, updates) into the Merkle tree, forming an updated root.
- Epoch Snapshot Proposal: The Leader publishes the new Merkle root along with a “digest of changes” to fellow validators, effectively proposing “this is the official directory state for epoch X.”
- Validator Confirmation: Other NCN validators cross-check the proposed root by reconstructing the tree. If it matches and all entries are valid (i.e., no rejected or malicious data), they vote to confirm. A majority vote finalizes the snapshot.
- On-Chain Finalization: Once confirmed, the Leader (or a designated node) posts a transaction to Solana (or another base chain) with the final Merkle root and epoch index. This record is immutable – future queries can verify any agent’s membership or absence in that epoch using a Merkle proof.
- Auditability: Storing the root on-chain means any attempt to remove, insert, or alter agent entries without consensus is detectable. If the published root doesn’t match a validator’s local copy, that discrepancy triggers an alarm and potential slashing of any dishonest validators. Agents themselves can query the on-chain root to confirm their own inclusion.

In essence, the Certificate Tree functions as a decentralized PKI directory, with the Merkle root anchored on Solana each epoch. An agent’s public key is “certified” by the NCN, removing the need for centralized authorities.

### Deregistration and Updates

Over time, agents may update their info or leave the SSAL network:
- Updates: If an agent’s contact info changes (like IP or phone), it submits an update proposal following the same challenge-response and voting process. Once approved, the agent’s updated data is included in the next epoch snapshot, preserving continuity without forcing a full remove-and-re-register cycle.
- Deregistration: Agents can voluntarily exit the network by requesting removal from the tree. This request must be signed by the agent’s key and undergo validator voting to prevent impostors from deregistering others. Upon approval, the agent’s record is flagged for removal in the upcoming epoch. After finalization, the stake is returned to the agent (provided there was no misconduct).
- Spam Prevention via Exponential Stake: The stake required for new registrations increases exponentially with the total number of agents. For example, if N agents are already registered, a new agent might need to lock an amount proportional to 2^N. This ensures that as the system grows, it becomes increasingly expensive for a single adversary to flood the directory with fake identities.

### Validator Incentives and Security

The NCN validators are essential for maintaining the Certificate Tree’s integrity:
- Staking and Rewards: Validators must also stake Secure Token to join the NCN, guaranteeing they have something to lose if they act dishonestly. They may earn rewards (like token distributions or a share of fees) for diligently verifying proposals and finalizing epoch snapshots.
- Slashing: Validators who approve fraudulent entries, push incorrect Merkle roots, or otherwise misbehave can be slashed – losing part or all of their stake. This incentivizes them to follow the protocol rules and thoroughly validate agent submissions.
- Majority Trust Assumption: A majority (>50%) of honest validators is assumed. While some blockchains use higher thresholds (e.g., two-thirds), SSAL’s design expects rational actors with significant stake at risk to behave correctly. In real deployments, thresholds can be tuned, or supermajority voting might be required for extra security.

Because SSAL doesn’t introduce a brand-new token, it relies on an existing token (the “Secure Token”) for staking, ensuring the system is simple to adopt and not prone to speculative token fluctuations. This design mirrors standard Proof-of-Stake economics, applied specifically to agent identity validation and network security.

### Economic Model and Security Analysis

- No New Token: By leveraging a stable or widely recognized asset for staking, SSAL reduces friction for participants. They can stake this “Secure Token” (e.g., SOL or another base asset) without having to acquire a specialized coin just for SSAL.
- Sybil-Resistance: Requiring a non-trivial stake per agent, plus exponentially increasing costs, makes mass identity creation prohibitively expensive. Malicious actors are further discouraged by the risk of slashing if caught submitting fake or duplicate registrations.
- Layered Trust: Each agent’s trustworthiness depends on:
    1. Certificate Tree Registration (on-chain verified identity + staked collateral).
    2. Ownership Proof via cryptographic handshake (no one can fake the private key).

An attacker would need to compromise both the majority of validators and an agent’s private key to impersonate that agent, which is economically and technically unfeasible.

- Comparison to Traditional PKI: Instead of relying on a single CA, SSAL’s Certificate Tree is maintained by multiple validators with economic incentives to remain honest. Periodic epoch Merkle roots deliver transparency similar to certificate-transparency logs, letting anyone audit the entire identity list for anomalies.
- Performance: Because only the Merkle root is stored on-chain, SSAL’s global directory scales efficiently. The NCN handles the heavy lifting (validating proposals, building the Merkle tree) off-chain. Agents can query identity data from replicated validator nodes or caches, verifying membership with a lightweight Merkle proof.


---

## Example Scenario

Situation: Agent B requests Agent A to send 100 USDC to a specific wallet address (denoted as b) that is managed by B. Both agents want an on-chain record of the agreed terms in the transaction’s memo field, legally binding them to fulfill a specific contract condition.

1.	Initial Handshake
    - Agent B initiates contact by sending a secure request to Agent A.
	- This request states: “Please send 100 USDC to b (my secondary wallet) under these conditions.”
	- If A and B have not already established trust, they run the gm handshake process. A verifies B’s identity against the Certificate Tree to confirm that B is a legitimate staked agent.
2.	Secure Communication
	- Agent A receives B’s request in an encoded capsule.
	- A decapsulates the capsule and verifies it came from B.
	- Confirming B is valid, A reviews the request to send 100 USDC to b. A also reviews the proposed condition or agreement text (e.g., “For consulting services—B must provide monthly updates”).
3.	Transaction Construction
	- Agent A builds a Solana transaction that transfers 100 USDC to b.
	- While creating the transaction, A attaches a memo instruction containing the contract condition. For example, “Payment for consulting—B must provide monthly updates or face potential dispute.”
	- The memo ensures there is an on-chain record of the agreement. Both parties will later reference it if any dispute arises.
4.	Partial Signing / Coordination
	- Because B also needs to sign or acknowledge, A can opt to sign the transaction first.
	- A encapsulates the partially signed transaction.
	- A sends this transaction to B, asking B to sign as proof of agreement to the memo terms.
5.	Agent B Signs and Broadcasts
	- Agent B decapsulates the incoming transaction.
	- B sees the memo instruction clearly stating the condition. B signs the transaction, indicating agreement to the on-chain terms.
	- B may also add its own data to the memo if needed (e.g., clarifications on the service to be provided).
6.	On-Chain Execution
	- Agent B submits the fully signed transaction to the Solana network.
	- The network processes the 100 USDC transfer, recording the memo in the transaction’s logs. This serves as an immutable reference to the agreement.
	- Both A and B can confirm on-chain that the transaction succeeded and that 100 USDC is now in B’s b address.
7.	Post-Interaction Assurance
	- The SSAL framework ensures both A and B have acted under verified identities (by referencing the Certificate Tree). All messages were exchanged securely via capsulation and decapsulation.
	- If B fails to honor the memo’s condition (e.g., not providing monthly updates), A can reference the on-chain memo as evidence of the agreed terms, potentially using it for dispute resolution.
	- The threat of slashing remains if either party tries to create fraudulent transactions or misrepresent the agreement.
	- No external trust was required: the entire process—identity verification, transaction signing, and memo-based agreement—relies on SSAL’s staking and certificate model to enforce honesty.

---

## License

MIT
