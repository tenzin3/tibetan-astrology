// Copies the static app into dist/ for deployment to any static host.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const entry of ['index.html', 'css', 'js']) {
  cpSync(join(root, entry), join(dist, entry), { recursive: true });
}
console.log('Built to dist/');
