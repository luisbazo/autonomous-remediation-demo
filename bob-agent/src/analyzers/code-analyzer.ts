import { Logger } from 'winston';
import { MCPClient } from '../clients/mcp-client.js';

export interface CodeIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
}

export interface CodeAnalysis {
  filePath: string;
  issues: CodeIssue[];
  summary: string;
  hasMemoryLeak: boolean;
}

export class CodeAnalyzer {
  constructor(
    private logger: Logger,
    private mcpClient: MCPClient
  ) {}

  async analyzeCode(code: string, filePath: string): Promise<CodeAnalysis> {
    this.logger.info('Analyzing code for memory leaks', { filePath });

    const issues: CodeIssue[] = [];

    // Pattern 1: Static collections that grow indefinitely
    const staticCollectionPattern = /private\s+static\s+final\s+(?:Map|List|Set|Collection)<[^>]+>\s+(\w+)\s*=\s*new/g;
    let match;
    
    while ((match = staticCollectionPattern.exec(code)) !== null) {
      const lineNumber = this.getLineNumber(code, match.index);
      const variableName = match[1];
      
      // Check if this collection is ever cleared
      const clearPattern = new RegExp(`${variableName}\\.clear\\(\\)`, 'g');
      const removePattern = new RegExp(`${variableName}\\.remove\\(`, 'g');
      
      if (!clearPattern.test(code) && !removePattern.test(code)) {
        issues.push({
          type: 'static-collection-memory-leak',
          severity: 'critical',
          line: lineNumber,
          message: `Static collection '${variableName}' is never cleared, causing a memory leak`,
          suggestion: `Remove 'static' modifier or implement proper cleanup mechanism`,
          codeSnippet: this.getCodeSnippet(code, lineNumber)
        });
      }
    }

    // Pattern 2: Large object allocations without cleanup
    const largeAllocationPattern = /new\s+byte\s*\[\s*\d+\s*\*\s*1024\s*\*\s*1024\s*\]/g;
    while ((match = largeAllocationPattern.exec(code)) !== null) {
      const lineNumber = this.getLineNumber(code, match.index);
      issues.push({
        type: 'large-allocation',
        severity: 'high',
        line: lineNumber,
        message: 'Large memory allocation detected',
        suggestion: 'Ensure proper cleanup and consider using smaller allocations',
        codeSnippet: this.getCodeSnippet(code, lineNumber)
      });
    }

    // Pattern 3: Collections added to but never removed from
    const addWithoutRemovePattern = /(\w+)\.(?:add|put)\([^)]+\)/g;
    const collectionsWithAdds = new Set<string>();
    
    while ((match = addWithoutRemovePattern.exec(code)) !== null) {
      collectionsWithAdds.add(match[1]);
    }

    for (const collectionName of collectionsWithAdds) {
      const removePattern = new RegExp(`${collectionName}\\.(?:remove|clear)\\(`, 'g');
      if (!removePattern.test(code)) {
        const addMatch = code.match(new RegExp(`${collectionName}\\.(?:add|put)\\([^)]+\\)`));
        if (addMatch) {
          const lineNumber = this.getLineNumber(code, code.indexOf(addMatch[0]));
          issues.push({
            type: 'collection-growth-without-cleanup',
            severity: 'medium',
            line: lineNumber,
            message: `Collection '${collectionName}' grows without cleanup`,
            suggestion: 'Implement size limits or periodic cleanup',
            codeSnippet: this.getCodeSnippet(code, lineNumber)
          });
        }
      }
    }

    // Pattern 4: Missing try-with-resources for closeable objects
    const closeablePattern = /(?:InputStream|OutputStream|Reader|Writer|Connection|Statement|ResultSet)\s+(\w+)\s*=\s*new/g;
    while ((match = closeablePattern.exec(code)) !== null) {
      const variableName = match[1];
      const lineNumber = this.getLineNumber(code, match.index);
      
      // Check if it's in a try-with-resources
      const tryWithResourcesPattern = new RegExp(`try\\s*\\([^)]*${variableName}[^)]*\\)`, 'g');
      const closePattern = new RegExp(`${variableName}\\.close\\(\\)`, 'g');
      
      if (!tryWithResourcesPattern.test(code) && !closePattern.test(code)) {
        issues.push({
          type: 'resource-leak',
          severity: 'high',
          line: lineNumber,
          message: `Resource '${variableName}' may not be properly closed`,
          suggestion: 'Use try-with-resources or ensure close() is called in finally block',
          codeSnippet: this.getCodeSnippet(code, lineNumber)
        });
      }
    }

    const hasMemoryLeak = issues.some(issue => 
      issue.type === 'static-collection-memory-leak' || 
      issue.severity === 'critical'
    );

    const summary = this.generateSummary(issues, hasMemoryLeak);

    this.logger.info('Code analysis complete', {
      filePath,
      issuesFound: issues.length,
      hasMemoryLeak
    });

    return {
      filePath,
      issues,
      summary,
      hasMemoryLeak
    };
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  private getCodeSnippet(code: string, lineNumber: number, context: number = 2): string {
    const lines = code.split('\n');
    const start = Math.max(0, lineNumber - context - 1);
    const end = Math.min(lines.length, lineNumber + context);
    
    return lines
      .slice(start, end)
      .map((line, index) => {
        const actualLineNumber = start + index + 1;
        const marker = actualLineNumber === lineNumber ? '>' : ' ';
        return `${marker} ${actualLineNumber} | ${line}`;
      })
      .join('\n');
  }

  private generateSummary(issues: CodeIssue[], hasMemoryLeak: boolean): string {
    if (issues.length === 0) {
      return 'No memory leak issues detected';
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;

    let summary = `Found ${issues.length} potential issue(s): `;
    const parts = [];
    
    if (criticalCount > 0) parts.push(`${criticalCount} critical`);
    if (highCount > 0) parts.push(`${highCount} high`);
    if (mediumCount > 0) parts.push(`${mediumCount} medium`);
    
    summary += parts.join(', ');

    if (hasMemoryLeak) {
      summary += '. MEMORY LEAK DETECTED - immediate action required.';
    }

    return summary;
  }
}

// Made with Bob
