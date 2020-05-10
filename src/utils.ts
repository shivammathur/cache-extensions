import * as fs from 'fs';
import * as core from '@actions/core';

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
  const input = process.env[name];
  switch (input) {
    case '':
    case undefined:
      return core.getInput(name, {required: mandatory});
    default:
      return input;
  }
}

/**
 * Function to filter extensions
 *
 * @param extension_csv
 */
export async function filterExtensions(extension_csv: string): Promise<string> {
  return extension_csv
    .split(',')
    .filter(extension => {
      return extension.trim()[0] != ':';
    })
    .join(',');
}
