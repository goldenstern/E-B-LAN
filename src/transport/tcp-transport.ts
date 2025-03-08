import * as net from 'net';
import { Transport } from '../types';
import { EblanError, StatusCode } from '../types';
import { EventEmitter } from 'events';

/**
 * TCP transport implementation
 */
export class TcpTransport implements Transport {
  private server: net.Server | null = null;
  private connections: Map<string, net.Socket> = new Map();
  private events = new EventEmitter();
  private host: string;
  private port: number;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  /**
   * Start listening for incoming messages
   */
  async listen(callback: (message: Buffer) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = net.createServer((socket) => {
          const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
          
          // Store connection for later use
          this.connections.set(clientId, socket);
          
          // Handle data
          socket.on('data', (data) => {
            // Process the message
            callback(data);
          });
          
          // Handle connection close
          socket.on('close', () => {
            this.connections.delete(clientId);
          });
          
          // Handle errors
          socket.on('error', (err) => {
            this.events.emit('error', err);
          });
        });
        
        // Handle server errors
        this.server.on('error', (err) => {
          this.events.emit('error', err);
          reject(err);
        });
        
        // Start listening
        this.server.listen(this.port, this.host, () => {
          resolve();
        });
      } catch (error) {
        reject(new EblanError(
          `Failed to start TCP server: ${(error as Error).message}`,
          StatusCode.INTERNAL_ERROR
        ));
      }
    });
  }

  /**
   * Send message to target
   */
  async send(target: string, message: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if we already have a connection to the target
        const existingConnection = this.connections.get(target);
        
        if (existingConnection && !existingConnection.destroyed) {
          // Use existing connection
          existingConnection.write(message, (err) => {
            if (err) {
              reject(new EblanError(
                `Failed to send message: ${err.message}`,
                StatusCode.INTERNAL_ERROR
              ));
            } else {
              resolve();
            }
          });
        } else {
          // Create new connection
          const [host, portStr] = target.split(':');
          const port = parseInt(portStr, 10);
          
          const socket = net.createConnection({ host, port }, () => {
            // Send the message
            socket.write(message, (err) => {
              if (err) {
                reject(new EblanError(
                  `Failed to send message: ${err.message}`,
                  StatusCode.INTERNAL_ERROR
                ));
              } else {
                resolve();
              }
            });
          });
          
          // Handle connection errors
          socket.on('error', (err) => {
            reject(new EblanError(
              `Connection error: ${err.message}`,
              StatusCode.INTERNAL_ERROR
            ));
          });
          
          // Store the connection for future use
          this.connections.set(target, socket);
        }
      } catch (error) {
        reject(new EblanError(
          `Failed to send message: ${(error as Error).message}`,
          StatusCode.INTERNAL_ERROR
        ));
      }
    });
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      // Close all connections
      for (const socket of this.connections.values()) {
        socket.destroy();
      }
      this.connections.clear();
      
      // Close the server if it exists
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Subscribe to transport events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }
}
