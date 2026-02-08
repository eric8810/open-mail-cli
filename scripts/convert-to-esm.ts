import fs from 'node:fs';
import path from 'node:path';

/**
 * Convert CommonJS require/module.exports to ES6 import/export
 */
function convertFile(filePath: string): void {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Remove @ts-nocheck
  content = content.replace(/^\/\/ @ts-nocheck\n/, '');

  // Convert require statements to import
  const requirePattern = /const\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\);?/g;

  content = content.replace(requirePattern, (match, namedImports, defaultImport, modulePath) => {
    if (namedImports) {
      const imports = namedImports.split(',').map((s: string) => s.trim()).join(', ');
      return `import { ${imports} } from '${modulePath}.js';`;
    } else if (defaultImport) {
      return `import ${defaultImport} from '${modulePath}.js';`;
    }
    return match;
  });

  // Convert module.exports = x
  content = content.replace(/module\.exports\s*=\s*(.+?);?$/, 'export default $1;');

  // Convert exports.x = y
  content = content.replace(/exports\.(\w+)\s*=\s*(.+?);?/g, 'export const $1 = $2;');

  // Convert module.exports = { x, y }
  const exportsObjectPattern = /module\.exports\s*=\s*\{([^}]+)\};?/;
  content = content.replace(exportsObjectPattern, (match, exports) => {
    const items = exports.split(',').map((s: string) => s.trim());
    return `export { ${items.join(', ')} };`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Converted: ${filePath}`);
  }
}

/**
 * Recursively convert all TypeScript files
 */
function convertDir(dir: string): void {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      convertDir(filePath);
    } else if (file.endsWith('.ts')) {
      convertFile(filePath);
    }
  }
}

// Convert src directory
convertDir('src');
console.log('Conversion complete!');