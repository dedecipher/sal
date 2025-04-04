import {
  HostConfig,
  MessageHandler,
  S3lMessageHeaders,
  TransactionHandler,
  Modality
} from '../solana/types';
import * as web3 from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * S3lHost handles server-side functionality for the S3L protocol
 */
export class S3lHost extends EventEmitter {
  private cfg: HostConfig;
  private connection: web3.Connection;
  private keypair: web3.Keypair;
  private messageHandler: MessageHandler | null = null;
  private txHandler: TransactionHandler | null = null;
  private server: any = null; // Will be a TCP server or audio stream based on modality
  private clients: Map<string, { publicKey: string }> = new Map();
  private isRunning: boolean = false;

  constructor(config: HostConfig) {
    super();
    
    // Validate required config fields
    if (!config.cluster || !config.phoneNumber || !config.host || !config.privateKey) {
      throw new Error('Missing required configuration parameters');
    }
    
    this.cfg = {
      ...config,
      modality: config.modality || Modality.TCP // Default to TCP if not specified
    };
    
    // Initialize Solana connection
    this.connection = new web3.Connection(this.cfg.cluster);
    
    // Create keypair from private key
    const privateKeyBytes = bs58.decode(this.cfg.privateKey);
    this.keypair = web3.Keypair.fromSecretKey(privateKeyBytes);
  }
  
  /**
   * Initialize the host
   */
  public async init(): Promise<void> {
    try {
      console.log(`Initializing S3L host for ${this.cfg.host}`);
      
      // Verify connection to Solana
      const version = await this.connection.getVersion();
      console.log(`Connected to Solana network version: ${version['solana-core']}`);
      
      // Verify account exists
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      console.log(`Account balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
      
      // Initialize server based on modality
      if (this.cfg.modality === Modality.TCP) {
        // TCP initialization would happen here
        console.log('TCP server initialization');
      } else if (this.cfg.modality === Modality.VOICE) {
        // Voice/audio initialization would happen here
        console.log('Voice modality initialization');
      }
      
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize S3L host:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Register message and transaction handlers
   */
  public register(handlers: {
    messageHandler?: MessageHandler;
    txHandler?: TransactionHandler;
  }): S3lHost {
    if (handlers.messageHandler) {
      this.messageHandler = handlers.messageHandler;
    }
    
    if (handlers.txHandler) {
      this.txHandler = handlers.txHandler;
    }
    
    return this;
  }
  
  /**
   * Start the server and listen for incoming connections
   */
  public async run(): Promise<void> {
    if (this.isRunning) {
      console.warn('S3L host is already running');
      return;
    }
    
    try {
      if (this.cfg.modality === Modality.TCP) {
        await this.startTcpServer();
      } else if (this.cfg.modality === Modality.VOICE) {
        await this.startVoiceServer();
      }
      
      this.isRunning = true;
      this.emit('running');
      console.log(`S3L host is running for ${this.cfg.host}`);
    } catch (error) {
      console.error('Failed to start S3L host:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    if (this.server) {
      // Stop server based on modality
      if (this.cfg.modality === Modality.TCP) {
        // TCP server shutdown
        if (this.server.close) {
          this.server.close();
        }
      } else if (this.cfg.modality === Modality.VOICE) {
        // Voice/audio shutdown
      }
    }
    
    this.isRunning = false;
    this.emit('stopped');
    console.log('S3L host stopped');
  }
  
  /**
   * Process an incoming S3L message
   */
  private async processIncomingMessage(data: string, source: string): Promise<void> {
    try {
      // Check if it's an S3L message
      if (!data.startsWith('[S3L]')) {
        console.warn('Received non-S3L message, ignoring');
        return;
      }
      
      // Parse message structure
      const messageParts = this.parseS3LMessage(data);
      if (!messageParts) {
        console.warn('Failed to parse S3L message');
        return;
      }
      
      const { headers, signature, body, type } = messageParts;
      
      // Verify signature
      const isValid = this.verifySignature(
        headers.publicKey,
        body,
        signature
      );
      
      if (!isValid) {
        console.error('Invalid message signature, rejecting');
        return;
      }
      
      // Handle bootstrap message (GM)
      if (body.trim() === 'GM') {
        await this.handleBootstrap(headers, source);
        return;
      }
      
      // Handle transaction message
      if (type === 'TX') {
        await this.handleTransaction(headers, body, source);
        return;
      }
      
      // Handle regular message
      if (type === 'MSG') {
        await this.handleMessage(headers, body, source);
        return;
      }
    } catch (error) {
      console.error('Error processing incoming message:', error);
    }
  }
  
  /**
   * Parse an S3L message into its components
   */
  private parseS3LMessage(message: string): { 
    headers: S3lMessageHeaders,
    signature: string,
    body: string,
    type: 'MSG' | 'TX' | null
  } | null {
    try {
      // Basic format validation
      if (!message.startsWith('[S3L]') || !message.endsWith('[S3L]')) {
        return null;
      }
      
      // Extract signature
      const sigStart = message.indexOf('[SIG]');
      const sigEnd = message.indexOf('[SIG]', sigStart + 5);
      
      if (sigStart === -1 || sigEnd === -1) {
        return null;
      }
      
      const signature = message.substring(sigStart + 5, sigEnd);
      
      // Extract headers
      const headersEnd = message.indexOf('\n\n', sigEnd);
      if (headersEnd === -1) {
        return null;
      }
      
      const headersText = message.substring(sigEnd + 5, headersEnd);
      const headers: S3lMessageHeaders = {
        nonce: '',
        publicKey: '',
      };
      
      // Parse headers
      headersText.split('\n').forEach(line => {
        const [key, value] = line.split(':').map(s => s.trim());
        if (key && value) {
          if (key === 'Host') headers.host = value;
          if (key === 'Phone') headers.phone = value;
          if (key === 'Nonce') headers.nonce = value;
          if (key === 'BlockHeight') headers.blockHeight = parseInt(value, 10);
          if (key === 'PublicKey') headers.publicKey = value;
        }
      });
      
      // Determine message type
      let type: 'MSG' | 'TX' | null = null;
      let bodyStart = -1;
      let bodyEnd = -1;
      
      if (message.includes('[MSG]')) {
        type = 'MSG';
        bodyStart = message.indexOf('[MSG]') + 5;
        bodyEnd = message.lastIndexOf('[MSG]');
      } else if (message.includes('[TX]')) {
        type = 'TX';
        bodyStart = message.indexOf('[TX]') + 4;
        bodyEnd = message.lastIndexOf('[TX]');
      }
      
      if (bodyStart === -1 || bodyEnd === -1) {
        // If no specific type markers found, it might be a bootstrap message (GM)
        // In this case, body is everything after headers
        const body = message.substring(headersEnd + 2, message.lastIndexOf('[S3L]')).trim();
        return { headers, signature, body, type: null };
      }
      
      const body = message.substring(bodyStart, bodyEnd).trim();
      
      return { headers, signature, body, type };
    } catch (error) {
      console.error('Error parsing S3L message:', error);
      return null;
    }
  }
  
  /**
   * Verify the signature of a message
   */
  private verifySignature(publicKeyStr: string, data: string, signatureStr: string): boolean {
    try {
      const publicKey = new Uint8Array(Buffer.from(publicKeyStr, 'base64'));
      const message = Buffer.from(data);
      const signature = new Uint8Array(Buffer.from(signatureStr, 'base64'));
      
      return nacl.sign.detached.verify(
        message,
        signature,
        publicKey
      );
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
  
  /**
   * Handle bootstrap (GM) message
   */
  private async handleBootstrap(headers: S3lMessageHeaders, source: string): Promise<void> {
    // Record client
    this.clients.set(source, {
      publicKey: headers.publicKey
    });
    
    // Create GM response
    const responseHeaders: S3lMessageHeaders = {
      nonce: headers.nonce,
      publicKey: this.keypair.publicKey.toString()
    };
    
    const body = `GM ${headers.publicKey}`;
    await this.sendMessage(responseHeaders, body, source, 'OK');
    
    this.emit('client_connected', source, headers);
  }
  
  /**
   * Handle regular message
   */
  private async handleMessage(headers: S3lMessageHeaders, message: string, source: string): Promise<void> {
    // Call message handler if registered
    if (this.messageHandler) {
      try {
        await this.messageHandler(message, source);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    }
    
    // Create response headers
    const responseHeaders: S3lMessageHeaders = {
      nonce: headers.nonce,
      blockHeight: headers.blockHeight,
      publicKey: this.keypair.publicKey.toString()
    };
    
    // Send acknowledgment response
    await this.sendMessage(responseHeaders, 'Message received', source, 'OK');
    
    this.emit('message_received', message, source, headers);
  }
  
  /**
   * Handle transaction message
   */
  private async handleTransaction(headers: S3lMessageHeaders, transaction: string, source: string): Promise<void> {
    let signature: string = '';
    
    try {
      // Deserialize the transaction from base64 string
      const serializedTxBuffer = Buffer.from(transaction, 'base64');
      const recoveredTx = web3.Transaction.from(serializedTxBuffer);
      
      // Verify the transaction
      // Here you would implement your business rules to check if this transaction is valid
      // For example: check recipient, amount, etc.
      
      console.log('Recovered transaction:', {
        feePayer: recoveredTx.feePayer?.toString(),
        instructions: recoveredTx.instructions.length,
        recentBlockhash: recoveredTx.recentBlockhash
      });
      
      if (this.txHandler) {
        try {
          // Use the provided transaction handler or sign and submit by default
          signature = await this.txHandler(recoveredTx);
        } catch (error) {
          console.error('Error in transaction handler:', error);
          
          // Send error response
          const errorHeaders: S3lMessageHeaders = {
            nonce: headers.nonce,
            blockHeight: headers.blockHeight,
            publicKey: this.keypair.publicKey.toString()
          };
          
          await this.sendMessage(
            errorHeaders, 
            JSON.stringify({ error: 'Transaction processing failed' }), 
            source,
            'ERROR'
          );
          return;
        }
      } else {
        // No custom handler, so we'll sign and submit ourselves
        // Add our signature to the transaction
        recoveredTx.partialSign(this.keypair);
        
        try {
          // Submit the fully signed transaction to the Solana network
          signature = await this.connection.sendRawTransaction(
            recoveredTx.serialize()
          );
          
          console.log('Transaction submitted to Solana network, signature:', signature);
          
          // Optionally wait for confirmation
          // const confirmation = await this.connection.confirmTransaction(signature);
          // console.log('Transaction confirmed:', confirmation);
        } catch (error) {
          console.error('Error submitting transaction to Solana:', error);
          throw error;
        }
      }
      
      // Create response headers
      const responseHeaders: S3lMessageHeaders = {
        nonce: headers.nonce,
        blockHeight: headers.blockHeight,
        publicKey: this.keypair.publicKey.toString()
      };
      
      // Send transaction response with signature
      await this.sendMessage(responseHeaders, signature, source, 'OK', 'TX');
      
      this.emit('transaction_processed', recoveredTx, signature, source, headers);
    } catch (error) {
      console.error('Error processing transaction:', error);
      
      // Send error response
      const errorHeaders: S3lMessageHeaders = {
        nonce: headers.nonce,
        blockHeight: headers.blockHeight,
        publicKey: this.keypair.publicKey.toString()
      };
      
      await this.sendMessage(
        errorHeaders, 
        JSON.stringify({ error: 'Transaction processing failed: ' + (error instanceof Error ? error.message : String(error)) }), 
        source,
        'ERROR'
      );
    }
  }
  
  /**
   * Send a signed S3L message
   */
  private async sendMessage(
    headers: S3lMessageHeaders, 
    body: string, 
    destination: string, 
    status: 'OK' | 'ERROR' = 'OK',
    type: 'MSG' | 'TX' | null = 'MSG'
  ): Promise<void> {
    try {
      // Build headers string
      let headersStr = '';
      Object.entries(headers).forEach(([key, value]) => {
        if (value !== undefined) {
          // Convert header keys to proper format (e.g., 'publicKey' to 'PublicKey')
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          headersStr += `${formattedKey}: ${value}\n`;
        }
      });
      
      // Create message content
      let messageContent = '';
      
      if (status === 'OK') {
        messageContent = `[S3L][OK]\n`;
      } else {
        messageContent = `[S3L][ERROR]\n`;
      }
      
      // Sign the body
      const signature = this.signMessage(body);
      
      messageContent += `[SIG]${signature}[SIG]\n`;
      messageContent += headersStr + '\n';
      
      // Add body with type markers if needed
      if (type === 'MSG') {
        messageContent += `[MSG]\n${body}\n[MSG]\n`;
      } else if (type === 'TX') {
        messageContent += `[TX]\n${body}\n[TX]\n`;
      } else {
        messageContent += body + '\n';
      }
      
      messageContent += '[S3L]';
      
      // Send based on modality
      if (this.cfg.modality === Modality.TCP) {
        // TCP send implementation
        console.log(`Sending S3L message to ${destination}`);
      } else if (this.cfg.modality === Modality.VOICE) {
        // Voice/audio send implementation
        console.log(`Sending S3L voice message`);
      }
    } catch (error) {
      console.error('Error sending S3L message:', error);
      throw error;
    }
  }
  
  /**
   * Sign a message with the host's private key
   */
  private signMessage(message: string): string {
    const messageBuffer = Buffer.from(message);
    const signature = nacl.sign.detached(
      messageBuffer,
      this.keypair.secretKey
    );
    return Buffer.from(signature).toString('base64');
  }
  
  /**
   * Start a TCP server for TCP modality
   */
  private async startTcpServer(): Promise<void> {
    // TCP server implementation would go here
    console.log('TCP server started');
  }
  
  /**
   * Start a voice server for VOICE modality
   */
  private async startVoiceServer(): Promise<void> {
    // Voice server implementation would go here
    console.log('Voice server started');
  }
} 