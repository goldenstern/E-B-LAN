import { Message, Protocol } from '../types';
import { EblanError, StatusCode } from '../types';

/**
 * MessagePack protocol implementation
 * Note: This is a placeholder. In a real implementation, you would use a proper
 * MessagePack library.
 */
export class MsgpackProtocol implements Protocol {
  serialize<T>(message: Message<T>): Buffer {
    // Placeholder implementation - in a real scenario, you would use msgpackr or similar
    try {
      // For now, we'll just use JSON as a fallback
      const jsonString = JSON.stringify(message);
      return Buffer.from(jsonString);
    } catch (error) {
      throw new EblanError(
        `Failed to serialize message with msgpack: ${(error as Error).message}`,
        StatusCode.BAD_REQUEST
      );
    }
  }

  deserialize<T>(data: Buffer): Message<T> {
    // Placeholder implementation
    try {
      const jsonString = data.toString('utf-8');
      return JSON.parse(jsonString) as Message<T>;
    } catch (error) {
      throw new EblanError(
        `Failed to deserialize message with msgpack: ${(error as Error).message}`,
        StatusCode.BAD_REQUEST
      );
    }
  }
}
