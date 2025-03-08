import { ServiceDiscovery, ServiceConfig } from '../types';
import { EblanError, StatusCode } from '../types';

/**
 * Local service discovery implementation
 * This implementation stores service information in memory
 */
export class LocalDiscovery implements ServiceDiscovery {
  private services: Map<string, ServiceConfig> = new Map();

  /**
   * Register a service
   */
  async register(service: ServiceConfig): Promise<void> {
    if (!service.name) {
      throw new EblanError('Service name is required', StatusCode.BAD_REQUEST);
    }
    
    this.services.set(service.name, service);
  }

  /**
   * Discover a service by name
   */
  async discover(serviceName: string): Promise<ServiceConfig | null> {
    const service = this.services.get(serviceName);
    return service || null;
  }

  /**
   * List all registered services
   */
  async listServices(): Promise<ServiceConfig[]> {
    return Array.from(this.services.values());
  }

  /**
   * Close the discovery service
   */
  async close(): Promise<void> {
    this.services.clear();
  }
}
