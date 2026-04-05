#!/usr/bin/env node

// Initialize Instana collector FIRST - must be before any other imports
import '@instana/collector';

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
      stderrLevels: ['error', 'warn'],
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      )
    })
  ]
});

const originalInfo = logger.info.bind(logger);
const originalWarn = logger.warn.bind(logger);
const originalError = logger.error.bind(logger);

logger.info = ((message: any, ...meta: any[]) => {
  console.log(typeof message === 'string' ? message : JSON.stringify(message));
  if (meta.length > 0) {
    console.log(JSON.stringify(meta.length === 1 ? meta[0] : meta, null, 2));
  }
  return originalInfo(message, ...meta);
}) as typeof logger.info;

logger.warn = ((message: any, ...meta: any[]) => {
  console.warn(typeof message === 'string' ? message : JSON.stringify(message));
  if (meta.length > 0) {
    console.warn(JSON.stringify(meta.length === 1 ? meta[0] : meta, null, 2));
  }
  return originalWarn(message, ...meta);
}) as typeof logger.warn;

logger.error = ((message: any, ...meta: any[]) => {
  console.error(typeof message === 'string' ? message : JSON.stringify(message));
  if (meta.length > 0) {
    console.error(JSON.stringify(meta.length === 1 ? meta[0] : meta, null, 2));
  }
  return originalError(message, ...meta);
}) as typeof logger.error;

// Configuration
const config_vars = {
  port: parseInt(process.env.BOB_WEBHOOK_PORT || process.env.PORT || '3000'),
  webhookSecret: process.env.BOB_WEBHOOK_SECRET || 'change_this_secret',
  instanaBaseUrl: process.env.INSTANA_BASE_URL || '',
  instanaApiToken: process.env.INSTANA_API_TOKEN || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  githubRepoOwner: process.env.GITHUB_REPO_OWNER || process.env.GITHUB_OWNER || '',
  githubRepoName: process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO || '',
  ocpApiUrl: process.env.OCP_API_URL || process.env.OPENSHIFT_API_URL || '',
  ocpToken: process.env.OCP_TOKEN || process.env.OPENSHIFT_TOKEN || ''
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
    // DEBUG: Log complete request details
    logger.info('=== WEBHOOK REQUEST DEBUG START ===');
    logger.info('Request Headers:', {
      headers: JSON.stringify(req.headers, null, 2)
    });
    logger.info('Request Body (raw):', {
      body: JSON.stringify(req.body, null, 2),
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body || {}),
      bodyLength: JSON.stringify(req.body).length
    });
    logger.info('=== WEBHOOK REQUEST DEBUG END ===');

    // Verify webhook secret
    const providedSecret = req.headers['x-webhook-secret'];
    if (providedSecret !== config_vars.webhookSecret) {
      logger.warn('Invalid webhook secret received', {
        providedSecret,
        expectedSecret: config_vars.webhookSecret
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const issue = req.body?.issue || {};
    const normalizedAlert = req.body?.issue ? {
      id: issue.id,
      severity: issue.severity >= 5 ? 'critical' : 'warning',
      type: issue.metricName || issue.type || 'instana-issue',
      title: issue.text || issue.metricName || 'Instana Issue',
      description: issue.suggestion || issue.text || 'Instana issue received',
      timestamp: issue.start || Date.now(),
      application: {
        name: issue.entityLabel || issue.entity || 'unknown',
        id: issue.id
      },
      metrics: issue.metricName ? [{
        name: issue.metricName,
        value: parseFloat(issue.metricValue || '0'),
        threshold: parseFloat(String(issue.memoryUsedPercentage || '').match(/\d+\.\d+\s*%?\s*>?=\s*(\d+\.\d+)/)?.[1] || '0')
      }] : [],
      metadata: {
        link: issue.link,
        entityType: issue.entityType,
        zone: issue.zone,
        fqdn: issue.fqdn,
        service: issue.service,
        relatedEntities: issue.relatedEntities,
        rawIssue: issue
      },
      rawIssue: issue
    } : req.body;

    logger.info('Received Instana alert webhook', {
      alertId: normalizedAlert.id,
      severity: normalizedAlert.severity,
      type: normalizedAlert.type,
      fullPayload: req.body,
      normalizedAlert
    });

    // Acknowledge receipt immediately
    res.status(202).json({
      status: 'accepted',
      message: 'Alert received and processing started',
      alertId: normalizedAlert.id
    });

    // Process alert asynchronously
    alertHandler.handleAlert(normalizedAlert).catch(error => {
      logger.error('Error processing alert', {
        error: error.message,
        stack: error.stack,
        alertId: normalizedAlert.id
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
