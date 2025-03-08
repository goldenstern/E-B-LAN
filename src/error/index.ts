import { EblanError, StatusCode } from '../types';

/**
 * Error handler interface
 */
export interface ErrorHandler {
  handle(error: Error): void;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Default logger implementation
 */
export class ConsoleLogger implements Logger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.serviceName}] [DEBUG] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${this.serviceName}] [INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.serviceName}] [WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.serviceName}] [ERROR] ${message}`, ...args);
  }
}

/**
 * Default error handler implementation
 */
export class DefaultErrorHandler implements ErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  handle(error: Error): void {
    if (error instanceof EblanError) {
      this.logger.error(`Error (${error.statusCode}): ${error.message}`);
    } else {
      this.logger.error(`Unexpected error: ${error.message}`);
    }
  }
}

export { EblanError, StatusCode };
