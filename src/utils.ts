import * as fs from 'fs';
import * as path from 'path';
import * as spu from 'setup-php/lib/utils';

/**
 * Function to get outputs
 */
export async function getOutput(output: string): Promise<string> {
  return fs.readFileSync(
    path.join(await spu.readEnv('RUNNER_TEMP'), output),
    'utf8'
  );
}

/**
 * Function to filter extensions
 *
 * @param extension_csv
 */
export async function filterExtensions(extension_csv: string): Promise<string> {
  return JSON.stringify(
    extension_csv
      .split(',')
      .filter(extension => {
        return extension.trim()[0] != ':';
      })
      .join(',')
  );
}

/**
 * Function to get script call
 *
 * @param fn
 * @param args
 */
export async function scriptCall(
  fn: string,
  ...args: string[]
): Promise<string> {
  const script: string = path.join(__dirname, '../src/scripts/cache.sh');
  return ['bash', script, fn, ...args].join(' ');
}
