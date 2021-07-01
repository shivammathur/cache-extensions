import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';

/**
 * Function to read environment variable and return a string value.
 *
 * @param property
 */
export async function readEnv(property: string): Promise<string> {
  const value = process.env[property];
  switch (value) {
    case undefined:
      return '';
    default:
      return value;
  }
}

/**
 * Function to get inputs from both with and env annotations.
 *
 * @param name
 * @param mandatory
 */
export async function getInput(
  name: string,
  mandatory: boolean
): Promise<string> {
  const input = core.getInput(name);
  const env_input = await readEnv(name);
  switch (true) {
    case input != '':
      return input;
    case input == '' && env_input != '':
      return env_input;
    case input == '' && env_input == '' && mandatory:
      throw new Error(`Input required and not supplied: ${name}`);
    default:
      return '';
  }
}

/**
 * Function to get outputs
 */
export async function getOutput(output: string): Promise<string> {
  return fs.readFileSync(
    path.join(await readEnv('RUNNER_TEMP'), output),
    'utf8'
  );
}

/**
 * Function to parse PHP version.
 *
 * @param version
 */
export async function parseVersion(version: string): Promise<string> {
  switch (version) {
    case 'latest':
      return '7.4';
    default:
      switch (true) {
        case version.length > 1:
          return version.slice(0, 3);
        default:
          return version + '.0';
      }
  }
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
