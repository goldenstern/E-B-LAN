import { Message, Protocol } from '../types';
import { EblanError, StatusCode } from '../types';

/**
 * JSON protocol implementation
 */
export class JsonProtocol implements Protocol {
  /**
   * Serialize message to Buffer
   */
  serialize<T>(message: Message<T>): Buffer {
    try {
      const jsonString = JSON.stringify(message);
      return Buffer.from(jsonString);
    } catch (error) {
      throw new EblanError(
        `Failed to serialize message: ${(error as Error).message}`,
        StatusCode.BAD_REQUEST
      );
    }
  }

  /**
   * Deserialize buffer to message
   */
  deserialize<T>(data: Buffer): Message<T> {
    try {
      const jsonString = data.toString('utf-8');
      const message = JSON.parse(jsonString) as Message<T>;
      
      // Validate message structure
      if (!message.header || !message.header.id || !message.header.type || !message.header.service) {
        throw new EblanError('Invalid message format: missing required header fields', StatusCode.BAD_REQUEST);
      }
      
      return message;
    } catch (error) {
      if (error instanceof EblanError) {
        throw error;
      }
      throw new EblanError(
        `Failed to deserialize message: ${(error as Error).message}`,
        StatusCode.BAD_REQUEST
      );
    }
  }
}
