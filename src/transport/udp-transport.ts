import * as dgram from 'dgram';
import { Transport } from '../types';
import { EblanError, StatusCode } from '../types';
import { EventEmitter } from 'events';

/**
 * UDP transport implementation
 */
export class UdpTransport implements Transport {
  private socket: dgram.Socket | null = null;
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
        // Create UDP socket
        this.socket = dgram.createSocket('udp4');
        
        // Handle incoming messages
        this.socket.on('message', (msg, rinfo) => {
          callback(msg);
        });
        
        // Handle errors
        this.socket.on('error', (err) => {
          this.events.emit('error', err);
          reject(err);
        });
        
        // Start listening
        this.socket.bind(this.port, this.host, () => {
          resolve();
        });
      } catch (error) {
        reject(new EblanError(
          `Failed to start UDP server: ${(error as Error).message}`,
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
        if (!this.socket) {
          this.socket = dgram.createSocket('udp4');
          
          // Handle errors
          this.socket.on('error', (err) => {
            this.events.emit('error', err);
          });
        }
        
        // Parse target
        const [host, portStr] = target.split(':');
        const port = parseInt(portStr, 10);
        
        // Send message
        this.socket.send(message, port, host, (err) => {
          if (err) {
            reject(new EblanError(
              `Failed to send message: ${err.message}`,
              StatusCode.INTERNAL_ERROR
            ));
          } else {
            resolve();
          }
        });
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
      if (this.socket) {
        this.socket.close(() => {
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
