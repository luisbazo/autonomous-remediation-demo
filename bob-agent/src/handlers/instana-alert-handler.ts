import { Logger } from 'winston';
import { MCPClient } from '../clients/mcp-client.js';
import { CodeAnalyzer } from '../analyzers/code-analyzer.js';
import { FixGenerator } from '../generators/fix-generator.js';
import { GitHubIntegration } from '../integrations/github-integration.js';

export interface InstanaAlert {
  id: string;
  severity: 'warning' | 'critical' | string;
  type: string;
  title: string;
  description: string;
  timestamp: number;
  application?: {
    name: string;
    id?: string;
  };
  metrics?: {
    name: string;
    value: number;
    threshold?: number;
  }[];
  metadata?: Record<string, any>;
  rawIssue?: Record<string, any>;
}

export interface AlertStats {
  totalAlertsReceived: number;
  alertsProcessed: number;
  fixesGenerated: number;
  fixesCommitted: number;
  errors: number;
  lastAlertTimestamp?: number;
}

export class InstanaAlertHandler {
  private stats: AlertStats = {
    totalAlertsReceived: 0,
    alertsProcessed: 0,
    fixesGenerated: 0,
    fixesCommitted: 0,
    errors: 0
  };

  constructor(
    private logger: Logger,
    private mcpClient: MCPClient,
    private codeAnalyzer: CodeAnalyzer,
    private fixGenerator: FixGenerator,
    private githubIntegration: GitHubIntegration
  ) {}

  async handleAlert(alert: InstanaAlert): Promise<void> {
    this.stats.totalAlertsReceived++;
    this.stats.lastAlertTimestamp = Date.now();

    // Log the complete payload for debugging
    //this.logger.info('=== INSTANA ALERT HANDLER - FULL PAYLOAD ===');
    //this.logger.info('Complete Alert Payload:', {
    //  fullPayload: JSON.stringify(alert, null, 2)
    //});
    //console.log('\n========================================');
    //console.log('INSTANA ALERT - FULL PAYLOAD RECEIVED');
    //console.log('========================================');
    //console.log(JSON.stringify(alert, null, 2));
    //console.log('========================================\n');

    this.logger.info('Processing Instana alert', {
      alertId: alert.id,
      severity: alert.severity,
      type: alert.type,
      application: alert.application?.name
    });

    try {
      // Step 1: Analyze alert to determine if it's a memory leak
      if (!this.isMemoryLeakAlert(alert)) {
        this.logger.info('Alert is not a memory leak, skipping', {
          alertId: alert.id,
          type: alert.type
        });
        return;
      }

      // Step 2: Get additional context from Instana via MCP
      const instanaContext = await this.getInstanaContext(alert);

      // Step 3: Identify the affected application and files
      const affectedFiles = await this.identifyAffectedFiles(alert, instanaContext);

      if (affectedFiles.length === 0) {
        this.logger.warn('No affected files identified', { alertId: alert.id });
        return;
      }

      // Step 4: Fetch source code from GitHub
      const sourceFiles = await this.fetchSourceFiles(affectedFiles);

      // Step 5: Analyze code for memory leaks
      const analyses = await Promise.all(
        sourceFiles.map(file =>
          this.codeAnalyzer.analyzeCode(file.content, file.path)
        )
      );

      // Step 6: Generate fixes for identified issues
      const fixes = await Promise.all(
        analyses
          .filter(analysis => analysis.issues.length > 0)
          .map((analysis, index) =>
            this.fixGenerator.generateFix(analysis, sourceFiles[index].content)
          )
      );

      if (fixes.length === 0) {
        this.logger.warn('No fixes generated', { alertId: alert.id });
        return;
      }

      this.stats.fixesGenerated += fixes.length;

      // Step 7: Create a branch and commit fixes
      const branchName = `fix/memory-leak-${alert.id}-${Date.now()}`;
      await this.githubIntegration.createBranch(branchName);

      for (let i = 0; i < fixes.length; i++) {
        const fix = fixes[i];
        const file = sourceFiles[i];
        
        await this.githubIntegration.commitFile(
          file.path,
          fix.fixedCode,
          `Fix memory leak in ${file.path}\n\n${fix.explanation}\n\nAlert ID: ${alert.id}`,
          branchName
        );
      }

      this.stats.fixesCommitted += fixes.length;

      // Step 8: Create pull request
      const prDescription = this.generatePRDescription(alert, analyses, fixes);
      const pr = await this.githubIntegration.createPullRequest(
        branchName,
        'main',
        `[Auto-Fix] Memory Leak - Alert ${alert.id}`,
        prDescription
      );

      this.logger.info('Pull request created successfully', {
        alertId: alert.id,
        prNumber: pr.number,
        prUrl: pr.html_url,
        fixesApplied: fixes.length
      });

      this.stats.alertsProcessed++;

    } catch (error: any) {
      this.stats.errors++;
      this.logger.error('Error handling alert', {
        alertId: alert.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private isMemoryLeakAlert(alert: InstanaAlert): boolean {
    const memoryKeywords = ['memory', 'heap', 'leak', 'oom', 'outofmemory', 'usedpercentage'];
    const metricName = alert.metrics?.map(metric => metric.name).join(' ') || '';
    const alertText = `${alert.type} ${alert.title} ${alert.description} ${metricName}`.toLowerCase();

    return memoryKeywords.some(keyword => alertText.includes(keyword));
  }

  private async getInstanaContext(alert: InstanaAlert): Promise<any> {
    try {
      // Use MCP to get additional metrics and traces
      const metrics = await this.mcpClient.callTool('instana', 'get_metrics', {
        metric: 'jvm.memory.heap.used',
        windowSize: 3600000 // Last hour
      });

      const traces = await this.mcpClient.callTool('instana', 'get_traces', {
        windowSize: 3600000
      });

      return {
        metrics,
        traces
      };
    } catch (error: any) {
      this.logger.warn('Failed to get Instana context', {
        error: error.message
      });
      return {};
    }
  }

  private async identifyAffectedFiles(
    alert: InstanaAlert,
    context: any
  ): Promise<string[]> {
    const relatedEntities = String(alert.metadata?.relatedEntities || '').toLowerCase();
    const applicationName = String(alert.application?.name || '').toLowerCase();

    // For this demo, map the provided Instana issue payload to the known leaking service
    const files =
      relatedEntities.includes('quarkus-memory-leak-app') || applicationName.includes('quarkus')
        ? ['quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java']
        : ['quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java'];

    this.logger.info('Identified affected files', {
      alertId: alert.id,
      files
    });

    return files;
  }

  private async fetchSourceFiles(
    filePaths: string[]
  ): Promise<Array<{ path: string; content: string }>> {
    const files = await Promise.all(
      filePaths.map(async path => ({
        path,
        content: await this.githubIntegration.getFileContent(path)
      }))
    );

    return files;
  }

  private generatePRDescription(
    alert: InstanaAlert,
    analyses: any[],
    fixes: any[]
  ): string {
    let description = `## Automated Fix for Memory Leak\n\n`;
    description += `**Alert ID:** ${alert.id}\n`;
    description += `**Severity:** ${alert.severity}\n`;
    description += `**Timestamp:** ${new Date(alert.timestamp).toISOString()}\n\n`;
    
    description += `### Alert Details\n`;
    description += `${alert.description}\n\n`;
    
    description += `### Issues Identified\n`;
    analyses.forEach((analysis, index) => {
      description += `\n#### File: ${analysis.filePath}\n`;
      analysis.issues.forEach((issue: any) => {
        description += `- **${issue.type}** (Line ${issue.line}): ${issue.message}\n`;
      });
    });

    description += `\n### Fixes Applied\n`;
    fixes.forEach((fix, index) => {
      description += `\n#### ${fix.filePath}\n`;
      description += `${fix.explanation}\n`;
    });

    description += `\n### Testing\n`;
    description += `- [ ] Unit tests pass\n`;
    description += `- [ ] Integration tests pass\n`;
    description += `- [ ] Memory leak resolved\n`;
    description += `- [ ] No new issues introduced\n\n`;

    description += `---\n`;
    description += `*This PR was automatically generated by Bob AI Agent*\n`;

    return description;
  }

  getStats(): AlertStats {
    return { ...this.stats };
  }
}

// Made with Bob

