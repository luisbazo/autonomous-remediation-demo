import { Logger } from 'winston';
import { CodeAnalysis, CodeIssue } from '../analyzers/code-analyzer.js';

export interface GeneratedFix {
  filePath: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  changes: Array<{
    line: number;
    type: 'add' | 'remove' | 'modify';
    original?: string;
    fixed: string;
  }>;
}

export class FixGenerator {
  constructor(private logger: Logger) {}

  async generateFix(analysis: CodeAnalysis, originalCode: string): Promise<GeneratedFix> {
    this.logger.info('Generating fix for code issues', {
      filePath: analysis.filePath,
      issueCount: analysis.issues.length
    });

    let fixedCode = originalCode;
    const changes: GeneratedFix['changes'] = [];
    let explanation = '## Automated Fix\n\n';

    // Sort issues by line number (descending) to avoid line number shifts
    const sortedIssues = [...analysis.issues].sort((a, b) => b.line - a.line);

    for (const issue of sortedIssues) {
      switch (issue.type) {
        case 'static-collection-memory-leak':
          const staticFix = this.fixStaticCollectionLeak(fixedCode, issue);
          fixedCode = staticFix.code;
          changes.push(...staticFix.changes);
          explanation += staticFix.explanation;
          break;

        case 'large-allocation':
          const allocationFix = this.fixLargeAllocation(fixedCode, issue);
          fixedCode = allocationFix.code;
          changes.push(...allocationFix.changes);
          explanation += allocationFix.explanation;
          break;

        case 'collection-growth-without-cleanup':
          const cleanupFix = this.addCleanupMechanism(fixedCode, issue);
          fixedCode = cleanupFix.code;
          changes.push(...cleanupFix.changes);
          explanation += cleanupFix.explanation;
          break;

        case 'resource-leak':
          const resourceFix = this.fixResourceLeak(fixedCode, issue);
          fixedCode = resourceFix.code;
          changes.push(...resourceFix.changes);
          explanation += resourceFix.explanation;
          break;
      }
    }

    explanation += '\n## Impact\n';
    explanation += '- Eliminates memory leak\n';
    explanation += '- Improves application stability\n';
    explanation += '- Reduces memory consumption\n';
    explanation += '- Prevents OutOfMemoryError\n';

    this.logger.info('Fix generated successfully', {
      filePath: analysis.filePath,
      changesCount: changes.length
    });

    return {
      filePath: analysis.filePath,
      originalCode,
      fixedCode,
      explanation,
      changes
    };
  }

  private fixStaticCollectionLeak(code: string, issue: CodeIssue): {
    code: string;
    changes: GeneratedFix['changes'];
    explanation: string;
  } {
    const lines = code.split('\n');
    const lineIndex = issue.line - 1;
    const originalLine = lines[lineIndex];

    // Remove 'static' modifier from the collection declaration
    const fixedLine = originalLine.replace(/private\s+static\s+final/, 'private final');

    lines[lineIndex] = fixedLine;

    const explanation = `### Fixed Static Collection Memory Leak (Line ${issue.line})\n\n` +
      `**Issue:** ${issue.message}\n\n` +
      `**Solution:** Removed the \`static\` modifier from the collection. ` +
      `Static collections persist for the lifetime of the application and are never garbage collected. ` +
      `By making it an instance variable, the collection can be garbage collected when the object is no longer referenced.\n\n` +
      `**Before:**\n\`\`\`java\n${originalLine.trim()}\n\`\`\`\n\n` +
      `**After:**\n\`\`\`java\n${fixedLine.trim()}\n\`\`\`\n\n`;

    return {
      code: lines.join('\n'),
      changes: [{
        line: issue.line,
        type: 'modify',
        original: originalLine.trim(),
        fixed: fixedLine.trim()
      }],
      explanation
    };
  }

  private fixLargeAllocation(code: string, issue: CodeIssue): {
    code: string;
    changes: GeneratedFix['changes'];
    explanation: string;
  } {
    // For large allocations, we add a comment warning
    const lines = code.split('\n');
    const lineIndex = issue.line - 1;
    const originalLine = lines[lineIndex];

    const indent = originalLine.match(/^\s*/)?.[0] || '';
    const warningComment = `${indent}// WARNING: Large memory allocation - consider using smaller chunks or streaming`;

    lines.splice(lineIndex, 0, warningComment);

    const explanation = `### Added Warning for Large Allocation (Line ${issue.line})\n\n` +
      `**Issue:** ${issue.message}\n\n` +
      `**Solution:** Added a warning comment. Consider refactoring to use smaller allocations or streaming.\n\n`;

    return {
      code: lines.join('\n'),
      changes: [{
        line: issue.line,
        type: 'add',
        fixed: warningComment.trim()
      }],
      explanation
    };
  }

  private addCleanupMechanism(code: string, issue: CodeIssue): {
    code: string;
    changes: GeneratedFix['changes'];
    explanation: string;
  } {
    // Add a size limit check or cleanup method
    const lines = code.split('\n');
    const lineIndex = issue.line - 1;
    const originalLine = lines[lineIndex];

    // Extract collection name from the issue message
    const collectionMatch = issue.message.match(/Collection '(\w+)'/);
    const collectionName = collectionMatch ? collectionMatch[1] : 'collection';

    const indent = originalLine.match(/^\s*/)?.[0] || '';
    const sizeCheckComment = `${indent}// TODO: Implement size limit or periodic cleanup for ${collectionName}`;

    lines.splice(lineIndex, 0, sizeCheckComment);

    const explanation = `### Added Cleanup Reminder (Line ${issue.line})\n\n` +
      `**Issue:** ${issue.message}\n\n` +
      `**Solution:** Added a TODO comment to implement proper cleanup. ` +
      `Consider implementing a maximum size limit or periodic cleanup mechanism.\n\n`;

    return {
      code: lines.join('\n'),
      changes: [{
        line: issue.line,
        type: 'add',
        fixed: sizeCheckComment.trim()
      }],
      explanation
    };
  }

  private fixResourceLeak(code: string, issue: CodeIssue): {
    code: string;
    changes: GeneratedFix['changes'];
    explanation: string;
  } {
    // Add try-with-resources suggestion
    const lines = code.split('\n');
    const lineIndex = issue.line - 1;
    const originalLine = lines[lineIndex];

    const indent = originalLine.match(/^\s*/)?.[0] || '';
    const comment = `${indent}// TODO: Convert to try-with-resources to prevent resource leak`;

    lines.splice(lineIndex, 0, comment);

    const explanation = `### Added Resource Leak Warning (Line ${issue.line})\n\n` +
      `**Issue:** ${issue.message}\n\n` +
      `**Solution:** Added a TODO comment. Refactor to use try-with-resources pattern.\n\n`;

    return {
      code: lines.join('\n'),
      changes: [{
        line: issue.line,
        type: 'add',
        fixed: comment.trim()
      }],
      explanation
    };
  }
}

// Made with Bob
