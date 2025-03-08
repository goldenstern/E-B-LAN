import { EventEmitter } from 'events';
import { 
  Message, 
  MessageType, 
  ServiceConfig, 
  StatusCode, 
  Transport, 
  Protocol, 
  TransportType, 
  MessageFormat 
} from '../types';
import { TransportFactory } from '../transport';
import { ProtocolFactory } from '../protocol';
import { DiscoveryFactory } from '../discovery';
import { Router, MessageHandler } from '../routing';
import { ConsoleLogger, DefaultErrorHandler, Logger, ErrorHandler } from '../error';
import { EblanError } from '../types';

/**
 * Service options interface
 */
export interface ServiceOptions extends ServiceConfig {
  discoveryType?: 'local' | 'multicast';
  logger?: Logger;
  errorHandler?: ErrorHandler;
}

/**
 * Request options interface
 */
export interface RequestOptions {
  timeout?: number;
  retries?: number;
}

/**
 * Service class
 */
export class Service {
  private config: ServiceConfig;
  private transport: Transport;
  private protocol: Protocol;
  private discovery: any; // Using any to avoid circular dependency
  private router: Router;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private events = new EventEmitter();
  private pendingRequests: Map<string, { 
    resolve: (value: any) => void; 
    reject: (reason: any) => void;
    timer: NodeJS.Timeout;
  }> = new Map();

  constructor(options: ServiceOptions) {
    // Set default options
    this.config = {
      name: options.name,
      port: options.port,
      host: options.host || '127.0.0.1',
      transport: options.transport || TransportType.TCP,
      format: options.format || MessageFormat.JSON,
      timeout: options.timeout || 5000,
      retries: options.retries || 3
    };
    
    // Create logger
    this.logger = options.logger || new ConsoleLogger(this.config.name);
    
    // Create error handler
    this.errorHandler = options.errorHandler || new DefaultErrorHandler(this.logger);
    
    // Create transport
    this.transport = TransportFactory.createTransport(
      this.config.transport!,
      this.config.host!,
      this.config.port
    );
    
    // Create protocol
    this.protocol = ProtocolFactory.createProtocol(this.config.format!);
    
    // Create discovery
    this.discovery = DiscoveryFactory.createDiscovery(options.discoveryType || 'local');
    
    // Create router
    this.router = new Router(this.discovery);
    
    // Handle transport errors
    this.transport.on('error', (err: Error) => {
      this.errorHandler.handle(err);
    });
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    try {
      // Register with discovery
      await this.discovery.register(this.config);
      
      // Start listening for messages
      await this.transport.listen((data: Buffer) => {
        this.handleIncomingMessage(data);
      });
      
      this.logger.info(`Service ${this.config.name} started on ${this.config.host}:${this.config.port}`);
    } catch (error) {
      this.errorHandler.handle(error as Error);
      throw error;
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    try {
      // Close transport
      await this.transport.close();
      
      // Close discovery
      await this.discovery.close();
      
      this.logger.info(`Service ${this.config.name} stopped`);
    } catch (error) {
      this.errorHandler.handle(error as Error);
      throw error;
    }
  }

  /**
   * Register a route handler
   */
  register<T = unknown, R = unknown>(
    route: string,
    handler: MessageHandler<T, R>
  ): void {
    this.router.register(route, handler);
    this.logger.debug(`Registered handler for route: ${route}`);
  }

  /**
   * Unregister a route handler
   */
  unregister(route: string): void {
    this.router.unregister(route);
    this.logger.debug(`Unregistered handler for route: ${route}`);
  }

  /**
   * Send a request to a service
   */
  async request<T = unknown, R = unknown>(
    serviceName: string,
    route: string,
    payload: T,
    options?: RequestOptions
  ): Promise<R> {
    const timeout = options?.timeout || this.config.timeout!;
    const retries = options?.retries || this.config.retries!;
    
    // Discover service
    const service = await this.discovery.discover(serviceName);
    
    if (!service) {
      throw new EblanError(`Service not found: ${serviceName}`, StatusCode.NOT_FOUND);
    }
    
    // Create message
    const message: Message<T> = {
      header: {
        id: crypto.randomUUID(),
        type: MessageType.REQUEST,
        timestamp: Date.now(),
        service: this.config.name,
        target: route
      },
      payload
    };
    
    // Serialize message
    const data = this.protocol.serialize(message);
    
    // Send message with retries
    for (let i = 0; i < retries; i++) {
      try {
        return await this.sendRequest(service, data, message.header.id, timeout);
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        
        this.logger.warn(`Request failed, retrying (${i + 1}/${retries}): ${(error as Error).message}`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }
    
    // This should never happen due to the loop above
    throw new EblanError('Request failed after retries', StatusCode.INTERNAL_ERROR);
  }

  /**
   * Subscribe to a topic
   */
  subscribe<T = unknown>(
    topic: string,
    handler: MessageHandler<T, void>
  ): void {
    this.router.subscribe(topic, handler);
    this.logger.debug(`Subscribed to topic: ${topic}`);
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string, handler?: MessageHandler): void {
    this.router.unsubscribe(topic, handler);
    this.logger.debug(`Unsubscribed from topic: ${topic}`);
  }

  /**
   * Publish a message to a topic
   */
  async publish<T = unknown>(topic: string, payload: T): Promise<void> {
    // Create message
    const message: Message<T> = {
      header: {
        id: crypto.randomUUID(),
        type: MessageType.EVENT,
        timestamp: Date.now(),
        service: this.config.name,
        target: topic
      },
      payload
    };
    
    // Serialize message
    const data = this.protocol.serialize(message);
    
    // Get all services
    const services = await this.discovery.listServices();
    
    // Send message to all services
    for (const service of services) {
      if (service.name !== this.config.name) {
        try {
          const target = `${service.host || '127.0.0.1'}:${service.port}`;
          await this.transport.send(target, data);
        } catch (error) {
          this.errorHandler.handle(error as Error);
        }
      }
    }
    
    // Also publish locally
    await this.router.publish(topic, payload);
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(data: Buffer): Promise<void> {
    try {
      // Deserialize message
      const message = this.protocol.deserialize(data);
      
      // Check if this is a response to a pending request
      if (message.header.type === MessageType.RESPONSE) {
        const requestId = message.header.id;
        const pendingRequest = this.pendingRequests.get(requestId);
        
        if (pendingRequest) {
          // Clear timeout
          clearTimeout(pendingRequest.timer);
          
          // Remove from pending requests
          this.pendingRequests.delete(requestId);
          
          // Check status
          if (message.header.status === StatusCode.OK) {
            // Resolve promise
            pendingRequest.resolve(message.payload);
          } else {
            // Reject promise
            pendingRequest.reject(new EblanError(
              `Request failed with status ${message.header.status}`,
              message.header.status || StatusCode.INTERNAL_ERROR
            ));
          }
          
          return;
        }
      }
      
      // Route message
      const result = await this.router.route(message);
      
      // If this is a request, send response
      if (message.header.type === MessageType.REQUEST) {
        // Create response message
        const response: Message = {
          header: {
            id: message.header.id,
            type: MessageType.RESPONSE,
            status: StatusCode.OK,
            timestamp: Date.now(),
            service: this.config.name,
            target: message.header.service
          },
          payload: result
        };
        
        // Serialize response
        const responseData = this.protocol.serialize(response);
        
        // Send response
        const target = `${message.header.service}:${message.header.port || this.config.port}`;
        await this.transport.send(target, responseData);
      }
    } catch (error) {
      this.errorHandler.handle(error as Error);
      
      // If this is a request and we know the sender, send error response
      try {
        const message = this.protocol.deserialize(data);
        
        if (message.header.type === MessageType.REQUEST) {
          // Create error response
          const response: Message = {
            header: {
              id: message.header.id,
              type: MessageType.RESPONSE,
              status: (error instanceof EblanError) ? error.statusCode : StatusCode.INTERNAL_ERROR,
              timestamp: Date.now(),
              service: this.config.name,
              target: message.header.service
            },
            payload: {
              error: (error as Error).message
            }
          };
          
          // Serialize response
          const responseData = this.protocol.serialize(response);
          
          // Send response
          const target = `${message.header.service}:${message.header.port || this.config.port}`;
          await this.transport.send(target, responseData);
        }
      } catch (e) {
        // Ignore errors in error handling
      }
    }
  }

  /**
   * Send a request and wait for response
   */
  private sendRequest<R = unknown>(
    service: ServiceConfig,
    data: Buffer,
    requestId: string,
    timeout: number
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      // Create timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new EblanError('Request timed out', StatusCode.INTERNAL_ERROR));
      }, timeout);
      
      // Store promise callbacks
      this.pendingRequests.set(requestId, { resolve, reject, timer });
      
      // Send request
      const target = `${service.host || '127.0.0.1'}:${service.port}`;
      this.transport.send(target, data).catch(error => {
        // Clear timeout
        clearTimeout(timer);
        
        // Remove from pending requests
        this.pendingRequests.delete(requestId);
        
        // Reject promise
        reject(error);
      });
    });
  }

  /**
   * Subscribe to service events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }
}
