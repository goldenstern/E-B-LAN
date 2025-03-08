/**
 * Message type enum
 */
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event'
}

/**
 * Status codes for responses
 */
export enum StatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  INTERNAL_ERROR = 500
}

/**
 * Transport type enum
 */
export enum TransportType {
  TCP = 'tcp',
  UDP = 'udp'
}

/**
 * Message format enum
 */
export enum MessageFormat {
  JSON = 'json',
  PROTOBUF = 'protobuf',
  MSGPACK = 'msgpack'
}

/**
 * Message header interface
 */
export interface MessageHeader {
  id: string;
  type: MessageType;
  status?: StatusCode;
  timestamp: number;
  service: string;
  target?: string;
}

/**
 * Message interface
 */
export interface Message<T = unknown> {
  header: MessageHeader;
  payload: T;
}

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  name: string;
  port: number;
  host?: string;
  transport?: TransportType;
  format?: MessageFormat;
  timeout?: number;
  retries?: number;
}

/**
 * Transport interface
 */
export interface Transport {
  listen(callback: (message: Buffer) => void): Promise<void>;
  send(target: string, message: Buffer): Promise<void>;
  close(): Promise<void>;
}

/**
 * Protocol interface
 */
export interface Protocol {
  serialize<T>(message: Message<T>): Buffer;
  deserialize<T>(data: Buffer): Message<T>;
}

/**
 * Service discovery interface
 */
export interface ServiceDiscovery {
  register(service: ServiceConfig): Promise<void>;
  discover(serviceName: string): Promise<ServiceConfig | null>;
  listServices(): Promise<ServiceConfig[]>;
  close(): Promise<void>;
}

/**
 * Error with status code
 */
export class EblanError extends Error {
  statusCode: StatusCode;

  constructor(message: string, statusCode: StatusCode = StatusCode.INTERNAL_ERROR) {
    super(message);
    this.name = 'EblanError';
    this.statusCode = statusCode;
  }
}
