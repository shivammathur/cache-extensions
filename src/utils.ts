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
