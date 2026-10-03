import { mkdir, copyFile } from 'node:fs/promises';
await mkdir(new URL('../../web/', import.meta.url), {recursive: true});
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../../web/theseus.html', import.meta.url));
