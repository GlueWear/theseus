import { mkdir, copyFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await mkdir(new URL('../../web/', import.meta.url), {recursive: true});
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../../web/theseus.html', import.meta.url));
await build({
  entryPoints: [fileURLToPath(new URL('../../bin/transport-sidecar.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('../../web/theseus-sidecar.mjs', import.meta.url)),
  nodePaths: [fileURLToPath(new URL('../node_modules', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'eof',
  sourcemap: false,
  banner: {js: '// Downloaded from the authenticated Theseus console. Node.js 20+.'},
});
