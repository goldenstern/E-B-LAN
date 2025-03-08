import { Message, MessageFormat, Protocol } from '../types';
import { JsonProtocol } from './json-protocol';
import { ProtobufProtocol } from './protobuf-protocol';
import { MsgpackProtocol } from './msgpack-protocol';

/**
 * Protocol factory to create protocol instances based on format
 */
export class ProtocolFactory {
  static createProtocol(format: MessageFormat): Protocol {
    switch (format) {
      case MessageFormat.JSON:
        return new JsonProtocol();
      case MessageFormat.PROTOBUF:
        return new ProtobufProtocol();
      case MessageFormat.MSGPACK:
        return new MsgpackProtocol();
      default:
        return new JsonProtocol();
    }
  }
}

export { JsonProtocol, ProtobufProtocol, MsgpackProtocol };
