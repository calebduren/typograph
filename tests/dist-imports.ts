import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const dist = fileURLToPath(new URL('../packages/chat-typography/dist/', import.meta.url));
export const built = (entry: string) => existsSync(join(dist, entry));

/** Every package a built file imports, statically or dynamically, through its chunks. */
export async function packageImports(entry: string): Promise<string[]> {
  const { metafile } = await build({
    entryPoints: [join(dist, entry)],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const found = new Set<string>();
  for (const input of Object.values(metafile.inputs)) {
    for (const imported of input.imports) if (imported.external) found.add(imported.path);
  }
  return [...found].sort();
}
