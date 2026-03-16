import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import * as spu from 'setup-php/lib/utils.js';

export const SCRIPT_PATH = join(import.meta.dirname, '../src/scripts/cache.sh');

export type ScriptCall = {
  command: 'bash';
  args: [string, string, ...string[]];
};

/**
 * Function to get outputs
 */
export async function getOutput(output: string): Promise<string> {
  return readFile(join(await spu.readEnv('RUNNER_TEMP'), output), 'utf8');
}

/**
 * Function to filter extensions
 *
 * @param extension_csv
 */
export function filterExtensions(extension_csv: string): string {
  return extension_csv
    .split(',')
    .filter(extension => {
      return extension.trim()[0] != ':';
    })
    .join(',');
}

/**
 * Function to get script call
 *
 * @param fn
 * @param args
 */
export function scriptCall(fn: string, ...args: string[]): ScriptCall {
  return {
    command: 'bash',
    args: [SCRIPT_PATH, fn, ...args]
  };
}
