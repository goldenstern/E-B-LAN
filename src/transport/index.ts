import { Transport, TransportType } from '../types';
import { TcpTransport } from './tcp-transport';
import { UdpTransport } from './udp-transport';

/**
 * Transport factory to create transport instances based on type
 */
export class TransportFactory {
  static createTransport(type: TransportType, host: string, port: number): Transport {
    switch (type) {
      case TransportType.TCP:
        return new TcpTransport(host, port);
      case TransportType.UDP:
        return new UdpTransport(host, port);
      default:
        return new TcpTransport(host, port);
    }
  }
}

export { TcpTransport, UdpTransport };
