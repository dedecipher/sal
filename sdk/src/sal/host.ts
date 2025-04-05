import {
    HostConfig,
    MessageHandler,
    TransactionHandler,
    Modality,
    SalRequest,
    SalMessageHeaders,
    SalResponse,
  } from '../types';
  import { EventEmitter } from 'events';
  
  /**
   * SalHost handles server-side functionality for the Sal protocol
   */
  export class SalHost extends EventEmitter {
    private cfg: HostConfig;
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
    }
    
    /**
     * Initialize the host
     */
    public async init(): Promise<void> {
      try {
        console.log(`Initializing Sal host for ${this.cfg.host}`);
        
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
        console.error('Failed to initialize Sal host:', error);
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
    }): SalHost {
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
        console.warn('Sal host is already running');
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
        console.log(`Sal host is running for ${this.cfg.host}`);
      } catch (error) {
        console.error('Failed to start Sal host:', error);
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
      console.log('Sal host stopped');
    }
    
    /**
     * Process an incoming Sal message
     */
    private async processIncomingMessage(data: string, source: string): Promise<void> {
      try {
        // Parse JSON message
        const message = JSON.parse(data) as SalRequest;
        
        // Verify the message structure
        if (!message.sig || !message.headers || message.body === undefined) {
          console.warn('Invalid Sal JSON message format, ignoring');
          return;
        }
        
        // Handle bootstrap message (GM)
        if (typeof message.body === 'string' && message.body.trim() === 'GM') {
          await this.handleBootstrap(message.headers, source);
          return;
        }
        
        // Handle regular message
        await this.handleMessage(message.headers, message.body, source);
      } catch (error) {
        console.error('Error processing incoming JSON message:', error);
      }
    }
    
    /**
     * Handle bootstrap (GM) message
     */
    private async handleBootstrap(headers: SalMessageHeaders, source: string): Promise<void> {
      console.log(`Received bootstrap message from ${source}`);
      
      // Store client information
      this.clients.set(source, {
        publicKey: headers.publicKey
      });
      
      // Send acknowledgment
      await this.sendJsonResponse(headers, "GM_ACK", source);
      
      this.emit('client_connected', source);
    }
    
    /**
     * Handle regular message
     */
    private async handleMessage(headers: SalMessageHeaders, message: any, source: string): Promise<void> {
      if (this.messageHandler) {
        try {
          await this.messageHandler(typeof message === 'string' ? message : JSON.stringify(message), source);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      }
    }
    
    /**
     * Send JSON response back to client
     */
    private async sendJsonResponse(
      headers: SalMessageHeaders, 
      body: any, 
      destination: string, 
      status: 'ok' | 'error' = 'ok'
    ): Promise<void> {
      const response: SalResponse = {
        sig: "signature-placeholder", // Would be a real signature in a complete implementation
        status,
        headers: {
          ...headers,
          host: this.cfg.host,
          publicKey: "pubkey-placeholder" // Would be a real public key in a complete implementation
        },
        body
      };
      
      // In a complete implementation, would send this to the client
      console.log(`Sending response to ${destination}:`, response);
    }
    
    /**
     * Start TCP server
     */
    private async startTcpServer(): Promise<void> {
      console.log('Starting TCP server');
      // Implementation would initialize a TCP server
    }
    
    /**
     * Start voice server
     */
    private async startVoiceServer(): Promise<void> {
      console.log('Starting voice server');
      // Implementation would initialize audio processing
    }
  }