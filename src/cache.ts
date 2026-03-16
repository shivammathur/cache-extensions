import {exec} from '@actions/exec';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as spu from 'setup-php/lib/utils.js';
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as utils from './utils.js';

const DEPENDENCY_CACHE_DIR = 'deps';
const DEPENDENCY_CACHE_PLATFORMS = new Set<NodeJS.Platform>([
  'darwin',
  'linux'
]);
const SKIP_DEPENDENCY_CACHE_VERSIONS = /^5\.[3-5]$/;

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function shouldHandleDependencies(
  version: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  return (
    !SKIP_DEPENDENCY_CACHE_VERSIONS.test(version) &&
    DEPENDENCY_CACHE_PLATFORMS.has(platform)
  );
}

/**
 * Handle dependencies
 *
 * @param extensions
 * @param version
 */
export async function handleDependencies(
  extensions: string,
  version: string,
  platform: NodeJS.Platform = process.platform
): Promise<void> {
  if (!shouldHandleDependencies(version, platform)) {
    return;
  }

  const cacheKey = `${await utils.getOutput('key')}-deps`;
  const cacheDir = join(
    await spu.readEnv('RUNNER_TOOL_CACHE'),
    DEPENDENCY_CACHE_DIR
  );
  const cacheHit = await cache.restoreCache([cacheDir], cacheKey, [cacheKey]);
  const dependencyScript = utils.scriptCall(
    'dependencies',
    extensions,
    version
  );

  await exec(dependencyScript.command, dependencyScript.args);

  if (cacheHit || !existsSync(cacheDir)) {
    return;
  }

  try {
    await cache.saveCache([cacheDir], cacheKey);
  } catch {
    await cache.saveCache([cacheDir], `${cacheKey}-take-2`);
  }
}

/**
 * Run the script
 */
export async function run(): Promise<void> {
  try {
    const version = await spu.parseVersion(await spu.readPHPVersion());
    const extensions = utils.filterExtensions(
      await spu.getInput('extensions', true)
    );
    const key = await spu.getInput('key', true);
    const dataScript = utils.scriptCall('data', extensions, version, key);

    await exec(dataScript.command, dataScript.args);
    await handleDependencies(extensions, version);
  } catch (error) {
    core.setFailed(getErrorMessage(error));
  }
}

export async function main(
  runAction: () => Promise<void> = run
): Promise<void> {
  try {
    await runAction();
  } catch (error) {
    const message = getErrorMessage(error);

    if (error instanceof cache.ValidationError) {
      core.setFailed(message);
      return;
    }

    if (error instanceof cache.ReserveCacheError) {
      core.info(message);
      return;
    }

    core.warning(message);
  }
}

export function isMainModule(
  argv1: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url
): boolean {
  return !!argv1 && resolve(argv1) === fileURLToPath(moduleUrl);
}

export async function bootstrap(
  argv1: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url,
  runAction: () => Promise<void> = main
): Promise<void> {
  if (isMainModule(argv1, moduleUrl)) {
    await runAction();
  }
}

await bootstrap();
