import fs from 'node:fs';
import path from 'node:path';

function fixImports(filePath: string): void {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Remove .js from local imports (not npm packages)
  content = content.replace(
    /from ['"](\.\.?\/[^'"]+)\.js['"]/g,
    "from '$1'"
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed: ${filePath}`);
  }
}

function fixDir(dir: string): void {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      fixDir(filePath);
    } else if (file.endsWith('.ts')) {
      fixImports(filePath);
    }
  }
}

fixDir('src');
console.log('Fixed all imports!');