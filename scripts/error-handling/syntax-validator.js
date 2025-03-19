#!/usr/bin/env node

/**
 * This script validates TypeScript files for syntax errors before starting the application
 * Place this in /scripts/error-handling/syntax-validator.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DIRECTORIES_TO_CHECK = [
  '/app/agent/src',        // Main agent code
  '/app/packages/core/src' // Core package code
];
const EXTENSIONS_TO_CHECK = ['.ts', '.tsx'];

console.log('🔍 Running syntax validation...');

// Track if we found any errors
let hasErrors = false;

// Function to check if a file has syntax errors
function validateFile(filePath) {
  try {
    // Use TypeScript compiler to check syntax
    const result = execSync(`npx tsc --noEmit --allowJs --checkJs false --esModuleInterop ${filePath}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true };
  } catch (error) {
    hasErrors = true;
    return { 
      success: false, 
      errors: error.stderr || error.message 
    };
  }
}

// Function to scan a directory recursively
function scanDirectory(directory) {
  try {
    const files = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(directory, file.name);
      
      if (file.isDirectory() && file.name !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (file.isFile() && EXTENSIONS_TO_CHECK.includes(path.extname(file.name))) {
        // Only scan specific files that are likely to cause issues
        if (file.name === 'index.ts' || file.name.includes('chatWorkflowManager') || file.name.includes('multi-agent')) {
          console.log(`Checking ${fullPath}`);
          const result = validateFile(fullPath);
          
          if (!result.success) {
            console.error(`\n❌ Syntax error in ${fullPath}:`);
            console.error(result.errors);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${directory}: ${error.message}`);
  }
}

// Special check for the most critical file
function checkIndexTs() {
  const indexPath = '/app/agent/src/index.ts';
  if (fs.existsSync(indexPath)) {
    console.log(`Checking critical file: ${indexPath}`);
    
    try {
      // Quick syntax error check using Node.js
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // Look for common import typos
      const typos = ['iimport ', 'immport ', 'imoprt ', 'improt '];
      
      typos.forEach(typo => {
        if (content.includes(typo)) {
          console.error(`\n❌ CRITICAL ERROR: Found typo "${typo}" in ${indexPath}`);
          console.error(`This will cause the application to crash with cryptic errors.`);
          hasErrors = true;
        }
      });
      
      // Check for missing semicolons after imports (common error)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('import ') && !line.endsWith(';') && !line.endsWith('{')) {
          console.warn(`\n⚠️ Warning: Import on line ${i+1} may be missing a semicolon:`);
          console.warn(`  ${line}`);
        }
      }
      
    } catch (error) {
      console.error(`Error checking ${indexPath}: ${error.message}`);
      hasErrors = true;
    }
  } else {
    console.error(`\n❌ Critical file ${indexPath} not found!`);
    hasErrors = true;
  }
}

// Main execution
try {
  // First check the critical index.ts file
  checkIndexTs();
  
  // Check each directory
  for (const dir of DIRECTORIES_TO_CHECK) {
    if (fs.existsSync(dir)) {
      console.log(`Scanning directory: ${dir}`);
      scanDirectory(dir);
    } else {
      console.warn(`⚠️ Directory not found: ${dir}`);
    }
  }

  // Final report
  if (hasErrors) {
    console.error('\n❌ Syntax validation failed. Please fix the errors above before starting the application.');
    process.exit(1);
  } else {
    console.log('✅ Syntax validation passed!');
    process.exit(0);
  }
} catch (error) {
  console.error('❌ Error running syntax validation:', error);
  process.exit(1);
}
