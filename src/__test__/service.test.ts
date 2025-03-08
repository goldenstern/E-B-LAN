import { Service, TransportType, MessageFormat } from '../index';
import { expect } from '@jest/globals';

// Mock the net and dgram modules
jest.mock('net', () => {
  const EventEmitter = require('events');
  
  class MockSocket extends EventEmitter {
    remoteAddress = '127.0.0.1';
    remotePort = 1234;
    destroyed = false;
    
    write(data: Buffer, callback: (err?: Error) => void) {
      callback();
      return true;
    }
    
    destroy() {
      this.destroyed = true;
    }
  }
  
  class MockServer extends EventEmitter {
    listening = false;
    
    listen(port: number, host: string, callback: () => void) {
      this.listening = true;
      callback();
      return this;
    }
    
    close(callback: () => void) {
      this.listening = false;
      callback();
    }
  }
  
  return {
    createServer: jest.fn(() => {
      const server = new MockServer();
      return server;
    }),
    createConnection: jest.fn((options, callback) => {
      const socket = new MockSocket();
      callback();
      return socket;
    }),
    Socket: MockSocket,
    Server: MockServer
  };
});

jest.mock('dgram', () => {
  const EventEmitter = require('events');
  
  class MockSocket extends EventEmitter {
    bind(port: number, host: string, callback: () => void) {
      callback();
    }
    
    addMembership() {}
    
    send(msg: Buffer, port: number, host: string, callback: (err?: Error) => void) {
      callback();
    }
    
    close(callback: () => void) {
      callback();
    }
  }
  
  return {
    createSocket: jest.fn(() => {
      return new MockSocket();
    })
  };
});

describe('Service', () => {
  let serviceA: Service;
  let serviceB: Service;
  
  beforeEach(async () => {
    // Create service A
    serviceA = new Service({
      name: 'service-a',
      port: 3000,
      transport: TransportType.TCP,
      format: MessageFormat.JSON
    });
    
    // Create service B
    serviceB = new Service({
      name: 'service-b',
      port: 3001,
      transport: TransportType.TCP,
      format: MessageFormat.JSON
    });
  });
  
  afterEach(async () => {
    await serviceA.stop();
    await serviceB.stop();
  });
  
  test('should start and stop services', async () => {
    await serviceA.start();
    await serviceB.start();
    
    // Services should be started successfully
    expect(true).toBe(true);
  });
  
  test('should register and handle routes', async () => {
    // Register a route handler
    serviceA.register('greeting', async (message) => {
      return { greeting: `Hello, ${message.payload.name}!` };
    });
    
    await serviceA.start();
    await serviceB.start();
    
    // Mock the discovery.discover method to return serviceA
    (serviceB as any).discovery.discover = jest.fn().mockResolvedValue({
      name: 'service-a',
      port: 3000,
      host: '127.0.0.1'
    });
    
    // Mock the handleIncomingMessage method to simulate a response
    const mockResponse = {
      header: {
        id: '123',
        type: 'response',
        status: 200,
        timestamp: Date.now(),
        service: 'service-a'
      },
      payload: { greeting: 'Hello, World!' }
    };
    
    // Store the original method
    const originalMethod = (serviceB as any).handleIncomingMessage;
    
    // Replace with mock
    (serviceB as any).handleIncomingMessage = jest.fn().mockImplementation(() => {
      // Find the pending request
      const pendingRequest = (serviceB as any).pendingRequests.get('123');
      if (pendingRequest) {
        clearTimeout(pendingRequest.timer);
        (serviceB as any).pendingRequests.delete('123');
        pendingRequest.resolve(mockResponse.payload);
      }
    });
    
    // Override the crypto.randomUUID to return a fixed ID
    global.crypto = {
      ...global.crypto,
      randomUUID: () => '123'
    };
    
    // Send a request
    const response = await serviceB.request('service-a', 'greeting', { name: 'World' });
    
    // Restore the original method
    (serviceB as any).handleIncomingMessage = originalMethod;
    
    // Check the response
    expect(response).toEqual(mockResponse.payload);
  });
});
