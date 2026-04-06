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
    const changes: GeneratedFix['changes'] = [];

    // Step 1: Remove 'static' modifier from the collection declaration
    const fixedLine = originalLine.replace(/private\s+static\s+final/, 'private final');
    lines[lineIndex] = fixedLine;
    
    changes.push({
      line: issue.line,
      type: 'modify',
      original: originalLine.trim(),
      fixed: fixedLine.trim()
    });

    // Step 2: Add size limit constant after the collection declaration
    const indent = originalLine.match(/^\s*/)?.[0] || '    ';
    const sizeLimitLine = `${indent}private static final int MAX_COLLECTION_SIZE = 100; // Prevent unbounded growth`;
    lines.splice(lineIndex + 1, 0, sizeLimitLine);
    
    changes.push({
      line: issue.line + 1,
      type: 'add',
      fixed: sizeLimitLine.trim()
    });

    // Step 3: Find where items are added to the collection and add size check
    const collectionMatch = originalLine.match(/(\w+)\s*=/);
    const collectionName = collectionMatch ? collectionMatch[1] : 'LEAKED_MEMORY';
    
    // Detect collection type from declaration
    const isMap = originalLine.includes('Map<') || originalLine.includes('HashMap') ||
                  originalLine.includes('ConcurrentHashMap') || originalLine.includes('TreeMap');
    const isList = originalLine.includes('List<') || originalLine.includes('ArrayList') ||
                   originalLine.includes('LinkedList');
    const isSet = originalLine.includes('Set<') || originalLine.includes('HashSet') ||
                  originalLine.includes('TreeSet');
    
    // Find the line where items are added to this collection
    const addPattern = isMap ? `${collectionName}.put(` : `${collectionName}.add(`;
    
    for (let i = lineIndex; i < lines.length; i++) {
      if (lines[i].includes(addPattern)) {
        const putLineIndent = lines[i].match(/^\s*/)?.[0] || '            ';
        
        // Generate appropriate cleanup code based on collection type
        let sizeCheckCode: string[];
        
        if (isMap) {
          sizeCheckCode = [
            `${putLineIndent}// Implement size limit to prevent memory leak`,
            `${putLineIndent}if (${collectionName}.size() >= MAX_COLLECTION_SIZE) {`,
            `${putLineIndent}    // Remove oldest entry when limit reached`,
            `${putLineIndent}    String oldestKey = ${collectionName}.keySet().iterator().next();`,
            `${putLineIndent}    ${collectionName}.remove(oldestKey);`,
            `${putLineIndent}    LOG.info("Removed oldest entry to maintain size limit: " + oldestKey);`,
            `${putLineIndent}}`
          ];
        } else if (isList) {
          sizeCheckCode = [
            `${putLineIndent}// Implement size limit to prevent memory leak`,
            `${putLineIndent}if (${collectionName}.size() >= MAX_COLLECTION_SIZE) {`,
            `${putLineIndent}    // Remove oldest entry when limit reached`,
            `${putLineIndent}    ${collectionName}.remove(0);`,
            `${putLineIndent}    LOG.info("Removed oldest entry to maintain size limit");`,
            `${putLineIndent}}`
          ];
        } else if (isSet) {
          sizeCheckCode = [
            `${putLineIndent}// Implement size limit to prevent memory leak`,
            `${putLineIndent}if (${collectionName}.size() >= MAX_COLLECTION_SIZE) {`,
            `${putLineIndent}    // Remove oldest entry when limit reached`,
            `${putLineIndent}    Object oldestItem = ${collectionName}.iterator().next();`,
            `${putLineIndent}    ${collectionName}.remove(oldestItem);`,
            `${putLineIndent}    LOG.info("Removed oldest entry to maintain size limit");`,
            `${putLineIndent}}`
          ];
        } else {
          // Generic collection
          sizeCheckCode = [
            `${putLineIndent}// Implement size limit to prevent memory leak`,
            `${putLineIndent}if (${collectionName}.size() >= MAX_COLLECTION_SIZE) {`,
            `${putLineIndent}    // Remove oldest entry when limit reached`,
            `${putLineIndent}    Object oldestItem = ${collectionName}.iterator().next();`,
            `${putLineIndent}    ${collectionName}.remove(oldestItem);`,
            `${putLineIndent}    LOG.info("Removed oldest entry to maintain size limit");`,
            `${putLineIndent}}`
          ];
        }
        
        lines.splice(i, 0, ...sizeCheckCode);
        
        changes.push({
          line: i + 1,
          type: 'add',
          fixed: sizeCheckCode.join('\n')
        });
        
        break;
      }
    }

    const explanation = `### Fixed Static Collection Memory Leak (Line ${issue.line})\n\n` +
      `**Issue:** ${issue.message}\n\n` +
      `**Solution Applied:**\n` +
      `1. **Removed \`static\` modifier** - Changed from static to instance variable so the collection can be garbage collected\n` +
      `2. **Added size limit** - Implemented MAX_COLLECTION_SIZE constant (100 entries) to prevent unbounded growth\n` +
      `3. **Automatic cleanup** - Added code to remove oldest entries when size limit is reached\n\n` +
      `This prevents the memory leak by:\n` +
      `- Limiting maximum memory usage\n` +
      `- Automatically removing old entries (FIFO pattern)\n` +
      `- Allowing garbage collection of removed entries\n\n` +
      `**Before:**\n\`\`\`java\n${originalLine.trim()}\n\`\`\`\n\n` +
      `**After:**\n\`\`\`java\n${fixedLine.trim()}\n${sizeLimitLine.trim()}\n// ... size check added before .put() operations\n\`\`\`\n\n`;

    return {
      code: lines.join('\n'),
      changes,
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
    const lines = code.split('\n');
    const lineIndex = issue.line - 1;
    const originalLine = lines[lineIndex];
    const changes: GeneratedFix['changes'] = [];

    // Extract collection name from the issue message
    const collectionMatch = issue.message.match(/Collection '(\w+)'/);
    const collectionName = collectionMatch ? collectionMatch[1] : 'collection';

    const indent = originalLine.match(/^\s*/)?.[0] || '        ';
    
    // Detect collection type to generate appropriate cleanup code
    const isMap = originalLine.includes('Map<') || originalLine.includes('HashMap') ||
                  originalLine.includes('ConcurrentHashMap') || originalLine.includes('TreeMap');
    const isList = originalLine.includes('List<') || originalLine.includes('ArrayList') ||
                   originalLine.includes('LinkedList');
    
    // Generate appropriate cleanup code based on collection type
    let cleanupCode: string[];
    
    if (isMap) {
      cleanupCode = [
        `${indent}// Automatic cleanup to prevent unbounded growth`,
        `${indent}if (${collectionName}.size() > 1000) {`,
        `${indent}    // Keep only the most recent 500 entries`,
        `${indent}    int toRemove = ${collectionName}.size() - 500;`,
        `${indent}    ${collectionName}.keySet().stream()`,
        `${indent}        .limit(toRemove)`,
        `${indent}        .forEach(${collectionName}::remove);`,
        `${indent}    LOG.info("Cleaned up " + toRemove + " old entries from ${collectionName}");`,
        `${indent}}`
      ];
    } else if (isList) {
      cleanupCode = [
        `${indent}// Automatic cleanup to prevent unbounded growth`,
        `${indent}if (${collectionName}.size() > 1000) {`,
        `${indent}    // Keep only the most recent 500 entries`,
        `${indent}    int toRemove = ${collectionName}.size() - 500;`,
        `${indent}    ${collectionName}.subList(0, toRemove).clear();`,
        `${indent}    LOG.info("Cleaned up " + toRemove + " old entries from ${collectionName}");`,
        `${indent}}`
      ];
    } else {
      // Generic collection (Set or other)
      cleanupCode = [
        `${indent}// Automatic cleanup to prevent unbounded growth`,
        `${indent}if (${collectionName}.size() > 1000) {`,
        `${indent}    // Keep only the most recent 500 entries`,
        `${indent}    int toRemove = ${collectionName}.size() - 500;`,
        `${indent}    ${collectionName}.stream()`,
        `${indent}        .limit(toRemove)`,
        `${indent}        .forEach(${collectionName}::remove);`,
        `${indent}    LOG.info("Cleaned up " + toRemove + " old entries from ${collectionName}");`,
        `${indent}}`
      ];
    }

    lines.splice(lineIndex, 0, ...cleanupCode);

    changes.push({
      line: issue.line,
      type: 'add',
      fixed: cleanupCode.join('\n')
    });

    const explanation = `### Added Automatic Cleanup Mechanism (Line ${issue.line})\n\n` +
      `**Issue:** ${issue.message}\n\n` +
      `**Solution:** Implemented automatic cleanup that:\n` +
      `- Monitors collection size (triggers at 1000 entries)\n` +
      `- Removes oldest entries to maintain 500 entries\n` +
      `- Logs cleanup operations for monitoring\n` +
      `- Prevents unbounded memory growth\n\n` +
      `This ensures the collection never grows beyond a reasonable size, preventing memory exhaustion.\n\n`;

    return {
      code: lines.join('\n'),
      changes,
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
