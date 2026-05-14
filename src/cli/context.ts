import fs from 'node:fs';
import path from 'node:path';

const IGNORE_DIRS = new Set([
  'node_modules', 'dist', '.git', '.next', '.nuxt', '__pycache__',
  'coverage', '.nyc_output', 'build', 'out', '.turbo', '.cache',
]);

const IGNORE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.lock', '.map',
]);

const KEY_FILES = [
  'README.md', 'readme.md',
  'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
  'CLAUDE.md', '.env.example',
];

const MAX_FILE_BYTES = 20_000;
const MAX_TREE_DEPTH = 4;

function buildTree(dir: string, depth = 0, prefix = ''): string {
  if (depth > MAX_TREE_DEPTH) return '';

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return '';
  }

  const filtered = entries.filter(e => {
    if (e.name.startsWith('.') && e.name !== '.env.example') return false;
    if (e.isDirectory() && IGNORE_DIRS.has(e.name)) return false;
    if (e.isFile() && IGNORE_EXTENSIONS.has(path.extname(e.name))) return false;
    return true;
  });

  return filtered.map((e, i) => {
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const line = prefix + connector + e.name;
    if (e.isDirectory()) {
      const children = buildTree(path.join(dir, e.name), depth + 1, childPrefix);
      return children ? line + '\n' + children : line;
    }
    return line;
  }).join('\n');
}

function readKeyFile(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function buildContext(cwd: string): string {
  const tree = buildTree(cwd);
  const parts: string[] = [
    `Current directory: ${cwd}`,
    '',
    'File structure:',
    tree || '(empty)',
  ];

  const keyFileSections: string[] = [];
  for (const name of KEY_FILES) {
    const content = readKeyFile(path.join(cwd, name));
    if (content) {
      keyFileSections.push(`<${name}>\n${content.trim()}\n</${name}>`);
    }
  }

  if (keyFileSections.length > 0) {
    parts.push('', 'Key files:', ...keyFileSections);
  }

  return parts.join('\n');
}
