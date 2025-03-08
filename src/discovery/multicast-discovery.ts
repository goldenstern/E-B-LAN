import * as dgram from 'dgram';
import { ServiceDiscovery, ServiceConfig } from '../types';
import { EblanError, StatusCode } from '../types';
import { EventEmitter } from 'events';

/**
 * Multicast service discovery implementation
 * This implementation uses UDP multicast for service discovery
 */
export class MulticastDiscovery implements ServiceDiscovery {
  private services: Map<string, ServiceConfig> = new Map();
  private socket: dgram.Socket | null = null;
  private events = new EventEmitter();
  private multicastAddress = '224.0.0.1';
  private multicastPort = 4321;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private serviceInfo: ServiceConfig | null = null;

  constructor() {
    this.setupSocket();
  }

  private setupSocket(): void {
    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      
      // Handle incoming messages
      this.socket.on('message', (msg, rinfo) => {
        try {
          const message = JSON.parse(msg.toString());
          
          if (message.type === 'discovery') {
            // Respond with service info if we have it
            if (this.serviceInfo) {
              this.sendServiceInfo(rinfo.address, rinfo.port);
            }
          } else if (message.type === 'service' && message.service) {
            // Store service info
            this.services.set(message.service.name, message.service);
            this.events.emit('service-discovered', message.service);
          }
        } catch (error) {
          this.events.emit('error', new EblanError(
            `Failed to parse discovery message: ${(error as Error).message}`,
            StatusCode.BAD_REQUEST
          ));
        }
      });
      
      // Handle errors
      this.socket.on('error', (err) => {
        this.events.emit('error', err);
      });
      
      // Bind socket
      this.socket.bind(this.multicastPort, () => {
        // Join multicast group
        this.socket?.addMembership(this.multicastAddress);
      });
    } catch (error) {
      throw new EblanError(
        `Failed to setup multicast socket: ${(error as Error).message}`,
        StatusCode.INTERNAL_ERROR
      );
    }
  }

  private sendServiceInfo(address: string, port: number): void {
    if (!this.socket || !this.serviceInfo) return;
    
    const message = {
      type: 'service',
      service: this.serviceInfo
    };
    
    const buffer = Buffer.from(JSON.stringify(message));
    this.socket.send(buffer, port, address);
  }

  private broadcastDiscovery(): void {
    if (!this.socket) return;
    
    const message = {
      type: 'discovery'
    };
    
    const buffer = Buffer.from(JSON.stringify(message));
    this.socket.send(buffer, this.multicastPort, this.multicastAddress);
  }

  private startHeartbeat(): void {
    // Send heartbeat every 5 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.serviceInfo) {
        const message = {
          type: 'service',
          service: this.serviceInfo
        };
        
        const buffer = Buffer.from(JSON.stringify(message));
        if (this.socket) {
          this.socket.send(buffer, this.multicastPort, this.multicastAddress);
        }
      }
    }, 5000);
  }

  /**
   * Register a service
   */
  async register(service: ServiceConfig): Promise<void> {
    if (!service.name) {
      throw new EblanError('Service name is required', StatusCode.BAD_REQUEST);
    }
    
    this.serviceInfo = service;
    this.services.set(service.name, service);
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Broadcast service info
    if (this.socket) {
      const message = {
        type: 'service',
        service
      };
      
      const buffer = Buffer.from(JSON.stringify(message));
      this.socket.send(buffer, this.multicastPort, this.multicastAddress);
    }
  }

  /**
   * Discover a service by name
   */
  async discover(serviceName: string): Promise<ServiceConfig | null> {
    // Check if we already know about this service
    const service = this.services.get(serviceName);
    if (service) {
      return service;
    }
    
    // Broadcast discovery request
    this.broadcastDiscovery();
    
    // Wait for service to be discovered
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.events.removeListener('service-discovered', checkService);
        resolve(null);
      }, 3000);
      
      const checkService = (service: ServiceConfig) => {
        if (service.name === serviceName) {
          clearTimeout(timeout);
          this.events.removeListener('service-discovered', checkService);
          resolve(service);
        }
      };
      
      this.events.on('service-discovered', checkService);
    });
  }

  /**
   * List all registered services
   */
  async listServices(): Promise<ServiceConfig[]> {
    // Broadcast discovery request to refresh the list
    this.broadcastDiscovery();
    
    // Wait a bit for responses
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return Array.from(this.services.values());
  }

  /**
   * Close the discovery service
   */
  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.socket) {
      this.socket.close();
    }
    
    this.services.clear();
  }

  /**
   * Subscribe to discovery events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }
}
