import {exec} from '@actions/exec';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as spu from 'setup-php/lib/utils';
import * as fs from 'fs';
import * as path from 'path';
import * as utils from './utils';

/**
 * Handle dependencies
 *
 * @param extensions
 * @param version
 */
export async function handleDependencies(
  extensions: string,
  version: string
): Promise<void> {
  if (!/^5.[3-5]$/.test(version) && /linux|darwin/.test(process.platform)) {
    const cache_key: string = (await utils.getOutput('key')) + '-deps';
    const cache_dir: string = path.join(
      await spu.readEnv('RUNNER_TOOL_CACHE'),
      'deps'
    );
    const cache_hit: string | undefined = await cache.restoreCache(
      [cache_dir],
      cache_key,
      [cache_key]
    );
    await exec(await utils.scriptCall('dependencies', extensions, version));
    if (!cache_hit && fs.existsSync(cache_dir)) {
      try {
        await cache.saveCache([cache_dir], cache_key);
      } catch {
        await cache.saveCache([cache_dir], cache_key + '-take-2');
      }
    }
  }
}

/**
 * Run the script
 */
export async function run(): Promise<void> {
  try {
    const version: string = await spu.parseVersion(await spu.readPHPVersion());
    const extensions: string = await utils.filterExtensions(
      await spu.getInput('extensions', true)
    );
    const enableCrossWorkflow: string = (await spu.getInput('enable-cross-workflow', false)) === 'true' ? 'true' : 'false';
    const key: string = await spu.getInput('key', true);
    await exec(await utils.scriptCall('data', extensions, version, key, enableCrossWorkflow));
    await handleDependencies(extensions, version);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

// call the run function
(async () => {
  await run();
})().catch(error => {
  if (error.name === cache.ValidationError.name) {
    core.setFailed(error.message);
  } else if (error.name === cache.ReserveCacheError.name) {
    core.info(error.message);
  } else {
    core.warning(error.message);
  }
});
