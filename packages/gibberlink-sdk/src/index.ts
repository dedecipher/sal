// Export the core modules
export { GibberLink, GibberLinkOptions, MessageHandler } from './core/gibberlink';
export { AudioEncoder, AudioEncoderOptions, AudioMessage, AudioEncoderEvents } from './core/audioEncoder';
export { 
  SecureMessaging, 
  SecureMessagingOptions, 
  MessageType,
  SecureMessageEvent 
} from './core/secureMessaging';

// Export Solana-related modules
export { SolanaClient, SolanaClientOptions } from './solana/solanaClient';
export { DirectoryService, DirectoryServiceConfig } from './solana/directoryService';

// Export type definitions
export {
  AgentIdentity,
  TransactionHeader,
  TransactionPayload,
  TransactionRequest,
  TransactionResponse,
  DirectoryServiceRequest,
  DirectoryServiceResponse,
  GLModeData,
  EncryptionParams,
  SecureMessage
} from './solana/types'; 