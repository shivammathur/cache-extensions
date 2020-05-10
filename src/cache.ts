import {exec} from '@actions/exec/lib/exec';
import * as core from '@actions/core';
import * as path from 'path';
import * as utils from './utils';

/**
 * Run the script
 */
export async function run(): Promise<void> {
  try {
    let version: string = await utils.getInput('php-version', true);
    version = version.length > 1 ? version.slice(0, 3) : version + '.0';
    const extensions = await utils.filterExtensions(
      await utils.getInput('extensions', true)
    );
    const key: string = await utils.getInput('key', true);
    const script_path: string = path.join(__dirname, '../src/extensions.sh');
    await exec(
      'bash ' + script_path + ' "' + extensions + '" ' + key + ' ' + version
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

// call the run function
run();
