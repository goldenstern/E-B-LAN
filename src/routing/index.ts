import { EventEmitter } from 'events';
import { Message, MessageType, ServiceConfig, ServiceDiscovery } from '../types';
import { EblanError, StatusCode } from '../types';

/**
 * Message handler type
 */
export type MessageHandler<T = unknown, R = unknown> = (
  message: Message<T>
) => Promise<R> | R;

/**
 * Router interface
 */
export interface Router {
  register<T = unknown, R = unknown>(
    route: string,
    handler: MessageHandler<T, R>
  ): void;
  
  unregister(route: string): void;
  
  route<T = unknown, R = unknown>(
    message: Message<T>
  ): Promise<R | null>;
  
  subscribe<T = unknown>(
    topic: string,
    handler: MessageHandler<T, void>
  ): void;
  
  unsubscribe(topic: string, handler?: MessageHandler): void;
  
  publish<T = unknown>(topic: string, payload: T): Promise<void>;
}

/**
 * Router implementation
 */
export class RouterImpl implements Router {
  private routes: Map<string, MessageHandler> = new Map();
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private events = new EventEmitter();
  private discovery: ServiceDiscovery;

  constructor(discovery: ServiceDiscovery) {
    this.discovery = discovery;
  }

  /**
   * Register a route handler
   */
  register<T = unknown, R = unknown>(
    route: string,
    handler: MessageHandler<T, R>
  ): void {
    this.routes.set(route, handler as MessageHandler);
  }

  /**
   * Unregister a route handler
   */
  unregister(route: string): void {
    this.routes.delete(route);
  }

  /**
   * Route a message to the appropriate handler
   */
  async route<T = unknown, R = unknown>(
    message: Message<T>
  ): Promise<R | null> {
    // Check if this is a request or an event
    if (message.header.type === MessageType.REQUEST) {
      // Get the route from the target field
      const route = message.header.target;
      
      if (!route) {
        throw new EblanError('Missing target in request message', StatusCode.BAD_REQUEST);
      }
      
      // Find the handler
      const handler = this.routes.get(route);
      
      if (!handler) {
        throw new EblanError(`No handler registered for route: ${route}`, StatusCode.NOT_FOUND);
      }
      
      // Call the handler
      try {
        return await handler(message) as R;
      } catch (error) {
        throw new EblanError(
          `Error handling message: ${(error as Error).message}`,
          StatusCode.INTERNAL_ERROR
        );
      }
    } else if (message.header.type === MessageType.EVENT) {
      // Get the topic from the target field
      const topic = message.header.target;
      
      if (!topic) {
        throw new EblanError('Missing target in event message', StatusCode.BAD_REQUEST);
      }
      
      // Find subscribers
      const subscribers = this.subscriptions.get(topic);
      
      if (subscribers) {
        // Call all subscribers
        for (const handler of subscribers) {
          try {
            await handler(message);
          } catch (error) {
            this.events.emit('error', new EblanError(
              `Error handling event: ${(error as Error).message}`,
              StatusCode.INTERNAL_ERROR
            ));
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Subscribe to a topic
   */
  subscribe<T = unknown>(
    topic: string,
    handler: MessageHandler<T, void>
  ): void {
    let subscribers = this.subscriptions.get(topic);
    
    if (!subscribers) {
      subscribers = new Set();
      this.subscriptions.set(topic, subscribers);
    }
    
    subscribers.add(handler as MessageHandler);
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string, handler?: MessageHandler): void {
    const subscribers = this.subscriptions.get(topic);
    
    if (!subscribers) {
      return;
    }
    
    if (handler) {
      subscribers.delete(handler);
    } else {
      this.subscriptions.delete(topic);
    }
  }

  /**
   * Publish a message to a topic
   */
  async publish<T = unknown>(topic: string, payload: T): Promise<void> {
    const subscribers = this.subscriptions.get(topic);
    
    if (!subscribers || subscribers.size === 0) {
      return;
    }
    
    const message: Message<T> = {
      header: {
        id: crypto.randomUUID(),
        type: MessageType.EVENT,
        timestamp: Date.now(),
        service: 'publisher',
        target: topic
      },
      payload
    };
    
    // Call all subscribers
    for (const handler of subscribers) {
      try {
        await handler(message);
      } catch (error) {
        this.events.emit('error', new EblanError(
          `Error publishing to topic ${topic}: ${(error as Error).message}`,
          StatusCode.INTERNAL_ERROR
        ));
      }
    }
  }

  /**
   * Subscribe to router events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }
}
;
