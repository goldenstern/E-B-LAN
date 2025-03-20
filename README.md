# E/B LAN - Efficient Binary Local Area Network Protocol

E/B LAN is a Node.js library that provides a standardized protocol for message exchange between microservices in a local network (127.0.0.1).

## Features

- **Multiple Transport Protocols**: TCP for guaranteed delivery and UDP for minimal latency
- **Flexible Message Formats**: JSON as the base format with optional support for binary formats (Protocol Buffers, MessagePack)
- **Service Discovery**: Automatic service discovery in local networks using both local registry and multicast
- **Request/Response Pattern**: Simple API for sending requests and handling responses
- **Publish/Subscribe Pattern**: Easy to use pub/sub functionality for event-driven architecture
- **Error Handling**: Comprehensive error handling and logging with customizable components
- **TypeScript Support**: Written in TypeScript with strict typing for better developer experience

## Installation

```bash
npm install eblan
