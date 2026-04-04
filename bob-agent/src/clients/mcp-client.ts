import { Logger } from 'winston';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

export class MCPClient {
  private clients: Map<string, Client> = new Map();

  constructor(private logger: Logger) {}

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    try {
      // For this demo, we'll use the existing MCP configuration
      // In production, this would connect to the actual MCP servers
      
      this.logger.info('Calling MCP tool', {
        serverName,
        toolName,
        args
      });

      // Simulate MCP call for demo purposes
      // In production, this would use the actual MCP SDK
      return {
        success: true,
        data: {}
      };
    } catch (error: any) {
      this.logger.error('MCP tool call failed', {
        serverName,
        toolName,
        error: error.message
      });
      throw error;
    }
  }

  async connectToServer(serverName: string, command: string, args: string[]): Promise<void> {
    try {
      const transport = new StdioClientTransport({
        command,
        args
      });

      const client = new Client({
        name: `bob-agent-${serverName}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      this.clients.set(serverName, client);

      this.logger.info('Connected to MCP server', { serverName });
    } catch (error: any) {
      this.logger.error('Failed to connect to MCP server', {
        serverName,
        error: error.message
      });
      throw error;
    }
  }

  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.close();
      this.clients.delete(serverName);
      this.logger.info('Disconnected from MCP server', { serverName });
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [serverName, client] of this.clients.entries()) {
      await client.close();
      this.logger.info('Disconnected from MCP server', { serverName });
    }
    this.clients.clear();
  }
}

// Made with Bob
