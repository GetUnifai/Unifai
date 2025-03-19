#!/usr/bin/env node

/**
 * Module Loader Debug Tool
 * 
 * This script helps detect module loading issues by checking imports
 * Place in /scripts/error-handling/module-loader-debug.js
 * 
 * Usage: node module-loader-debug.js path/to/your/entryfile.ts
 */

const fs = require('fs');
const path = require('path');

// Get entry file from command line args
const entryFile = process.argv[2] || '/app/agent/src/index.ts';
if (!fs.existsSync(entryFile)) {
  console.error(`❌ File not found: ${entryFile}`);
  console.error('Usage: node module-loader-debug.js path/to/your/entryfile.ts');
  process.exit(1);
}

console.log(`🔍 Analyzing module imports in ${entryFile}...`);

// Read file content
const content = fs.readFileSync(entryFile, 'utf8');

// Regular expressions to find different import patterns
const importPatterns = [
  // Regular import
  { regex: /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g, type: 'regular' },
  // Default import
  { regex: /import\s+([^{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g, type: 'default' },
  // Import * as
  { regex: /import\s+\*\s+as\s+([^\s]+)\s+from\s+['"]([^'"]+)['"]/g, type: 'namespace' },
  // Bare import
  { regex: /import\s+['"]([^'"]+)['"]/g, type: 'bare' },
  // Dynamic import
  { regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, type: 'dynamic' },
  // Common typos
  { regex: /iimport\s+/g, type: 'typo', message: 'Typo detected: "iimport" should be "import"' },
  { regex: /immport\s+/g, type: 'typo', message: 'Typo detected: "immport" should be "import"' },
  { regex: /imoprt\s+/g, type: 'typo', message: 'Typo detected: "imoprt" should be "import"' },
  { regex: /improt\s+/g, type: 'typo', message: 'Typo detected: "improt" should be "import"' },
  { regex: /from\s+['"]\s+/g, type: 'typo', message: 'Typo detected: space after opening quote in from statement' },
  { regex: /from\s+[^'"]+['"]([^'"]+)['"]/g, type: 'typo', message: 'Potential syntax error in "from" statement' },
];

// Track issues found
let issues = [];
let imports = [];

// Search for import patterns
for (const pattern of importPatterns) {
  let match;
  const regex = new RegExp(pattern.regex.source, 'g'); // Create a new regex instance to avoid issues with global regex
  while ((match = regex.exec(content)) !== null) {
    if (pattern.type === 'typo') {
      issues.push({
        line: getLineNumber(content, match.index),
        message: pattern.message,
        type: 'error',
        match: match[0]
      });
    } else {
      // Extract module name based on pattern type
      let moduleName;
      let importedItems;
      
      switch (pattern.type) {
        case 'regular':
          moduleName = match[2];
          importedItems = match[1].split(',').map(item => item.trim());
          break;
        case 'default':
          moduleName = match[2];
          importedItems = [match[1]];
          break;
        case 'namespace':
          moduleName = match[2];
          importedItems = [`* as ${match[1]}`];
          break;
        case 'bare':
          moduleName = match[1];
          importedItems = [];
          break;
        case 'dynamic':
          moduleName = match[1];
          importedItems = ['[dynamic]'];
          break;
      }
      
      imports.push({
        type: pattern.type,
        module: moduleName,
        items: importedItems,
        line: getLineNumber(content, match.index)
      });
    }
  }
}

// Helper function to get line number from character index
function getLineNumber(text, index) {
  return text.substring(0, index).split('\n').length;
}

// Check for specific project imports (customize for your project)
const workspaceModules = [
  '@elizaos/client-direct',
  '@elizaos/core',
  '@elizaos/plugin-bootstrap',
  '@elizaos-plugins/adapter-sqlite' 
];

// Analyze important imports
let criticalIssues = [];
for (const imp of imports) {
  // Check workspace modules
  if (workspaceModules.includes(imp.module)) {
    console.log(`✓ Workspace module: ${imp.module} (line ${imp.line})`);
  }
  
  // Check for relative path imports to multi-agent
  if (imp.module.includes('multi-agent')) {
    console.log(`✓ Multi-agent import: ${imp.module} (line ${imp.line})`);
  }
  
  // Check for external imports (not relative and not workspace)
  if (!imp.module.startsWith('.') && !imp.module.startsWith('/') && !workspaceModules.includes(imp.module)) {
    // This is an external dependency, might want to check if it's installed
    try {
      // For npm modules, do a basic check if they're installed in node_modules
      const nodeModulesBase = path.resolve(path.dirname(entryFile), '../../../node_modules');
      const moduleName = imp.module.split('/')[0]; // Handle scoped packages
      const modulePath = path.join(nodeModulesBase, moduleName);
      
      if (!fs.existsSync(modulePath)) {
        criticalIssues.push({
          line: imp.line,
          module: imp.module,
          message: `External module not found in node_modules: ${moduleName}`,
          type: 'warning'
        });
      }
    } catch (error) {
      // Skip module check if it fails
    }
  }
}

// Display results
console.log(`\nFound ${imports.length} imports in ${entryFile}`);

if (issues.length > 0) {
  console.log('\n⚠️ Issues found:');
  issues.forEach(issue => {
    if (issue.type === 'error') {
      console.error(`❌ Line ${issue.line}: ${issue.message}`);
      // Show the problematic line
      const lines = content.split('\n');
      console.error(`   ${lines[issue.line - 1]}`);
    } else {
      console.warn(`⚠️ Line ${issue.line}: ${issue.message}`);
    }
  });
  
  // Exit with error if there are actual errors (not just warnings)
  if (issues.some(issue => issue.type === 'error')) {
    console.error('\n❌ Errors found in imports. Please fix before continuing.');
    process.exit(1);
  }
}

if (criticalIssues.length > 0) {
  console.log('\n⚠️ Potential module resolution issues:');
  criticalIssues.forEach(issue => {
    console.warn(`⚠️ Line ${issue.line}: ${issue.message}`);
  });
}

// Check for the critical import issue that was causing problems
if (!content.includes('import { setupMultiAgentChatEndpoint }') && !content.includes('iimport { setupMultiAgentChatEndpoint }')) {
  console.error('❌ CRITICAL ISSUE: Missing import for setupMultiAgentChatEndpoint');
  console.error('Make sure you have: import { setupMultiAgentChatEndpoint } from \'./multi-agent\';');
}

if (content.includes('iimport')) {
  console.error('❌ CRITICAL ISSUE: Found "iimport" typo in the file');
  console.error('Change "iimport" to "import" to fix the issue');
  process.exit(1);
}

console.log('\n✅ Module loading analysis complete!');
