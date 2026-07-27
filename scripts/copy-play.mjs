import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('dist/index.html', 'dist/Cave-Tribe-v0.1.1-PLAY.html');
console.log('Created dist/Cave-Tribe-v0.1.1-PLAY.html');
