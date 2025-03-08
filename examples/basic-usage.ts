import { Service, TransportType, MessageFormat } from '../src';

async function main() {
  try {
    // Create service A
    const serviceA = new Service({
      name: 'service-a',
      port: 3000,
      transport: TransportType.TCP,
      format: MessageFormat.JSON
    });
    
    // Register a route handler
    serviceA.register('greeting', async (message) => {
      console.log(`Service A received: ${JSON.stringify(message.payload)}`);
      return { greeting: `Hello, ${message.payload.name}!` };
    });
    
    // Subscribe to a topic
    serviceA.subscribe('notifications', async (message) => {
      console.log(`Service A received notification: ${JSON.stringify(message.payload)}`);
    });
    
    // Start service A
    await serviceA.start();
    
    // Create service B
    const serviceB = new Service({
      name: 'service-b',
      port: 3001,
      transport: TransportType.TCP,
      format: MessageFormat.JSON
    });
    
    // Start service B
    await serviceB.start();
    
    // Send a request from service B to service A
    const response = await serviceB.request('service-a', 'greeting', { name: 'World' });
    console.log(`Service B received response: ${JSON.stringify(response)}`);
    
    // Publish a message from service B
    await serviceB.publish('notifications', { message: 'Hello from Service B!' });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Stop services
    await serviceA.stop();
    await serviceB.stop();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
