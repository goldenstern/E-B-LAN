import { ServiceDiscovery, ServiceConfig } from '../types';
import { LocalDiscovery } from './local-discovery';
import { MulticastDiscovery } from './multicast-discovery';

/**
 * Discovery factory to create discovery instances
 */
export class DiscoveryFactory {
  static createDiscovery(type: 'local' | 'multicast'): ServiceDiscovery {
    switch (type) {
      case 'local':
        return new LocalDiscovery();
      case 'multicast':
        return new MulticastDiscovery();
      default:
        return new LocalDiscovery();
    }
  }
}

export { LocalDiscovery, MulticastDiscovery };
