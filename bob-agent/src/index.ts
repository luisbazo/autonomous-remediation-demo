#!/usr/bin/env node

import express, { Request, Response } from 'express';
import { config } from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { InstanaAlertHandler } from './handlers/instana-alert-handler.js';
import { CodeAnalyzer } from './analyzers/code-analyzer.js';
import { FixGenerator } from './generators/fix-generator.js';
import { GitHubIntegration } from './integrations/github-integration.js';
import { MCPClient } from './clients/mcp-client.js';

// Load environment variables
config();

// Configure logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'bob-agent-error.log', level: 'error' }),
    new transports.File({ filename: 'bob-agent-combined.log' })
  ]
});

// Configuration
const config_vars = {
  port: parseInt(process.env.BOB_WEBHOOK_PORT || '3000'),
  webhookSecret: process.env.BOB_WEBHOOK_SECRET || 'change_this_secret',
  instanaBaseUrl: process.env.INSTANA_BASE_URL || '',
  instanaApiToken: process.env.INSTANA_API_TOKEN || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  githubRepoOwner: process.env.GITHUB_REPO_OWNER || '',
  githubRepoName: process.env.GITHUB_REPO_NAME || '',
  ocpApiUrl: process.env.OCP_API_URL || '',
  ocpToken: process.env.OCP_TOKEN || ''
};

// Initialize components
const mcpClient = new MCPClient(logger);
const codeAnalyzer = new CodeAnalyzer(logger, mcpClient);
const fixGenerator = new FixGenerator(logger);
const githubIntegration = new GitHubIntegration(
  config_vars.githubToken,
  config_vars.githubRepoOwner,
  config_vars.githubRepoName,
  logger
);
const alertHandler = new InstanaAlertHandler(
  logger,
  mcpClient,
  codeAnalyzer,
  fixGenerator,
  githubIntegration
);

// Create Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'bob-ai-agent',
    version: '1.0.0'
  });
});

// Instana webhook endpoint
app.post('/webhook/instana', async (req: Request, res: Response) => {
  try {
    // Verify webhook secret
    const providedSecret = req.headers['x-webhook-secret'];
    if (providedSecret !== config_vars.webhookSecret) {
      logger.warn('Invalid webhook secret received');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Received Instana alert webhook', {
      alertId: req.body.id,
      severity: req.body.severity,
      type: req.body.type
    });

    // Acknowledge receipt immediately
    res.status(202).json({
      status: 'accepted',
      message: 'Alert received and processing started',
      alertId: req.body.id
    });

    // Process alert asynchronously
    alertHandler.handleAlert(req.body).catch(error => {
      logger.error('Error processing alert', {
        error: error.message,
        stack: error.stack,
        alertId: req.body.id
      });
    });

  } catch (error: any) {
    logger.error('Error in webhook endpoint', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual trigger endpoint for testing
app.post('/trigger/analyze', async (req: Request, res: Response) => {
  try {
    const { filePath, repository } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    logger.info('Manual analysis triggered', { filePath, repository });

    // Fetch file content from GitHub
    const fileContent = await githubIntegration.getFileContent(filePath);
    
    // Analyze code
    const analysis = await codeAnalyzer.analyzeCode(fileContent, filePath);
    
    // Generate fix if issues found
    let fix = null;
    if (analysis.issues.length > 0) {
      fix = await fixGenerator.generateFix(analysis, fileContent);
    }

    res.json({
      status: 'completed',
      analysis,
      fix
    });

  } catch (error: any) {
    logger.error('Error in manual trigger', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  }
});

// Status endpoint
app.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      service: 'bob-ai-agent',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      connections: {
        instana: !!config_vars.instanaApiToken,
        github: !!config_vars.githubToken,
        openshift: !!config_vars.ocpToken
      },
      stats: alertHandler.getStats()
    };

    res.json(status);
  } catch (error: any) {
    logger.error('Error getting status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(config_vars.port, () => {
  logger.info(`Bob AI Agent started on port ${config_vars.port}`, {
    environment: process.env.NODE_ENV || 'development',
    config: {
      instanaConfigured: !!config_vars.instanaApiToken,
      githubConfigured: !!config_vars.githubToken,
      ocpConfigured: !!config_vars.ocpToken
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason,
    promise
  });
});

export default app;

// Made with Bob
