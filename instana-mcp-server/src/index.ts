#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

// Instana API configuration
const INSTANA_BASE_URL = process.env.INSTANA_BASE_URL || "";
const INSTANA_API_TOKEN = process.env.INSTANA_API_TOKEN || "";

interface InstanaConfig {
  baseUrl: string;
  apiToken: string;
}

class InstanaClient {
  private client: AxiosInstance;
  private config: InstanaConfig;

  constructor(config: InstanaConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `apiToken ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  async getApplications(): Promise<any> {
    const response = await this.client.get("/api/application-monitoring/applications");
    return response.data;
  }

  async getServices(): Promise<any> {
    const response = await this.client.get("/api/application-monitoring/catalog/services");
    return response.data;
  }

  async getInfrastructure(): Promise<any> {
    const response = await this.client.get("/api/infrastructure-monitoring/snapshots");
    return response.data;
  }

  async getEvents(params?: { windowSize?: number; from?: number; to?: number }): Promise<any> {
    const response = await this.client.get("/api/events", { params });
    return response.data;
  }

  async getAlerts(): Promise<any> {
    const response = await this.client.get("/api/events?eventTypeFilters=alert");
    return response.data;
  }

  async getMetrics(params: {
    metric: string;
    timeFrame?: { windowSize?: number; to?: number };
    rollup?: number;
    tagFilters?: any[];
  }): Promise<any> {
    const response = await this.client.post("/api/infrastructure-monitoring/metrics", params);
    return response.data;
  }

  async getTraces(params?: {
    windowSize?: number;
    from?: number;
    to?: number;
    tagFilters?: any[];
  }): Promise<any> {
    const response = await this.client.get("/api/application-monitoring/analyze/traces", {
      params,
    });
    return response.data;
  }

  async getCallGroups(params?: { windowSize?: number }): Promise<any> {
    const response = await this.client.get("/api/application-monitoring/analyze/call-groups", {
      params,
    });
    return response.data;
  }

  async getApplicationMetrics(applicationId: string, params?: {
    windowSize?: number;
    metrics?: string[];
  }): Promise<any> {
    const windowSize = params?.windowSize || 3600000;
    const to = Date.now();
    const response = await this.client.get(
      `/api/application-monitoring/applications;id=${applicationId}/services`,
      {
        params: {
          to,
          windowSize,
        }
      }
    );
    return response.data;
  }

  async getHealthStatus(): Promise<any> {
    const response = await this.client.get("/api/instana/health");
    return response.data;
  }
}

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "get_applications",
    description:
      "Get all monitored applications from Instana. Returns a list of applications with their metadata, services, and endpoints.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_services",
    description:
      "Get all monitored services from Instana. Returns a catalog of services with their details and dependencies.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_infrastructure",
    description:
      "Get infrastructure snapshots from Instana. Returns information about hosts, containers, and other infrastructure components.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_events",
    description:
      "Get events from Instana within a specified time window. Events include incidents, changes, and other notable occurrences.",
    inputSchema: {
      type: "object",
      properties: {
        windowSize: {
          type: "number",
          description: "Time window in milliseconds (default: 3600000 for 1 hour)",
        },
        from: {
          type: "number",
          description: "Start timestamp in milliseconds",
        },
        to: {
          type: "number",
          description: "End timestamp in milliseconds",
        },
      },
    },
  },
  {
    name: "get_alerts",
    description:
      "Get active alerts from Instana. Returns all current alerts and their severity levels.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_metrics",
    description:
      "Query specific metrics from Instana infrastructure monitoring. Allows filtering by tags and time ranges.",
    inputSchema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Metric name to query (e.g., 'cpu.used', 'memory.used')",
        },
        windowSize: {
          type: "number",
          description: "Time window in milliseconds",
        },
        rollup: {
          type: "number",
          description: "Aggregation interval in seconds",
        },
        tagFilters: {
          type: "array",
          description: "Array of tag filters to apply",
        },
      },
      required: ["metric"],
    },
  },
  {
    name: "get_traces",
    description:
      "Get distributed traces from Instana. Returns trace data for analyzing application performance and dependencies.",
    inputSchema: {
      type: "object",
      properties: {
        windowSize: {
          type: "number",
          description: "Time window in milliseconds (default: 3600000 for 1 hour)",
        },
        from: {
          type: "number",
          description: "Start timestamp in milliseconds",
        },
        to: {
          type: "number",
          description: "End timestamp in milliseconds",
        },
        tagFilters: {
          type: "array",
          description: "Array of tag filters to apply",
        },
      },
    },
  },
  {
    name: "get_call_groups",
    description:
      "Get call groups (aggregated service calls) from Instana. Useful for analyzing service-to-service communication patterns.",
    inputSchema: {
      type: "object",
      properties: {
        windowSize: {
          type: "number",
          description: "Time window in milliseconds (default: 3600000 for 1 hour)",
        },
      },
    },
  },
  {
    name: "get_health_status",
    description:
      "Get the health status of the Instana backend. Returns information about the Instana system's operational status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_application_metrics",
    description:
      "Get performance metrics for a specific application including latency, error rates, and throughput. Returns detailed service-level metrics.",
    inputSchema: {
      type: "object",
      properties: {
        applicationId: {
          type: "string",
          description: "The ID of the application to query metrics for",
        },
        windowSize: {
          type: "number",
          description: "Time window in milliseconds (default: 3600000 for 1 hour)",
        },
      },
      required: ["applicationId"],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "instana-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize Instana client
const instanaClient = new InstanaClient({
  baseUrl: INSTANA_BASE_URL,
  apiToken: INSTANA_API_TOKEN,
});

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_applications": {
        const data = await instanaClient.getApplications();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_services": {
        const data = await instanaClient.getServices();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_infrastructure": {
        const data = await instanaClient.getInfrastructure();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_events": {
        const params = args as { windowSize?: number; from?: number; to?: number };
        const data = await instanaClient.getEvents(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_alerts": {
        const data = await instanaClient.getAlerts();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_metrics": {
        const params = args as {
          metric: string;
          windowSize?: number;
          rollup?: number;
          tagFilters?: any[];
        };
        const data = await instanaClient.getMetrics({
          metric: params.metric,
          timeFrame: params.windowSize ? { windowSize: params.windowSize } : undefined,
          rollup: params.rollup,
          tagFilters: params.tagFilters,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_traces": {
        const params = args as {
          windowSize?: number;
          from?: number;
          to?: number;
          tagFilters?: any[];
        };
        const data = await instanaClient.getTraces(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_call_groups": {
        const params = args as { windowSize?: number };
        const data = await instanaClient.getCallGroups(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_health_status": {
        const data = await instanaClient.getHealthStatus();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_application_metrics": {
        const params = args as {
          applicationId: string;
          windowSize?: number;
        };
        const data = await instanaClient.getApplicationMetrics(params.applicationId, {
          windowSize: params.windowSize,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Instana MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Made with Bob
