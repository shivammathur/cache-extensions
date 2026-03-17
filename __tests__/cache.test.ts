import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {jest} from '@jest/globals';

const exec = jest.fn() as jest.MockedFunction<
  (command: string, args?: string[]) => Promise<number>
>;
const info = jest.fn() as jest.MockedFunction<(message: string) => void>;
const setFailed = jest.fn() as jest.MockedFunction<(message: string) => void>;
const warning = jest.fn() as jest.MockedFunction<(message: string) => void>;
const getInput = jest.fn() as jest.MockedFunction<
  (name: string, required?: boolean) => Promise<string>
>;
const parseVersion = jest.fn() as jest.MockedFunction<
  (version: string) => Promise<string>
>;
const readEnv = jest.fn() as jest.MockedFunction<
  (name: string) => Promise<string>
>;
const readPHPVersion = jest.fn() as jest.MockedFunction<() => Promise<string>>;
const restoreCache = jest.fn() as jest.MockedFunction<
  (paths: string[], primaryKey: string, restoreKeys?: string[]) => Promise<string | undefined>
>;
const saveCache = jest.fn() as jest.MockedFunction<
  (paths: string[], key: string) => Promise<number>
>;

class ValidationError extends Error {}
class ReserveCacheError extends Error {}

jest.unstable_mockModule('@actions/exec', () => ({
  exec
}));

jest.unstable_mockModule('@actions/core', () => ({
  info,
  setFailed,
  warning
}));

jest.unstable_mockModule('@actions/cache', () => ({
  ReserveCacheError,
  ValidationError,
  restoreCache,
  saveCache
}));

jest.unstable_mockModule('setup-php/lib/utils.js', () => ({
  getInput,
  parseVersion,
  readEnv,
  readPHPVersion
}));

const cache = await import('../src/cache.js');
const utils = await import('../src/utils.js');

type TestDirs = {
  root: string;
  runnerTemp: string;
  toolCache: string;
};

function createTestDirs(): TestDirs {
  const root = mkdtempSync(join(tmpdir(), 'cache-extensions-'));
  const runnerTemp = join(root, 'runner-temp');
  const toolCache = join(root, 'tool-cache');

  mkdirSync(runnerTemp, {recursive: true});
  mkdirSync(toolCache, {recursive: true});

  return {root, runnerTemp, toolCache};
}

function removeTestDirs(dirs: TestDirs): void {
  rmSync(dirs.root, {recursive: true, force: true});
}

function setActionInputs(
  version: string,
  extensions: string,
  key: string
): void {
  parseVersion.mockResolvedValue(version);
  readPHPVersion.mockResolvedValue(version);
  getInput.mockImplementation(async (name: string): Promise<string> => {
    if (name === 'extensions') {
      return extensions;
    }

    if (name === 'key') {
      return key;
    }

    return '';
  });
}

function writeKeyOutput(runnerTemp: string, key: string): void {
  writeFileSync(join(runnerTemp, 'key'), key);
}

function toFileHref(path: string): string {
  return pathToFileURL(path).href;
}

describe('cache.ts', () => {
  let dirs: TestDirs;

  beforeEach(() => {
    jest.clearAllMocks();
    dirs = createTestDirs();

    exec.mockResolvedValue(0);
    restoreCache.mockResolvedValue(undefined);
    saveCache.mockResolvedValue(1);
    readEnv.mockImplementation(async (name: string): Promise<string> => {
      if (name === 'RUNNER_TEMP') {
        return dirs.runnerTemp;
      }

      if (name === 'RUNNER_TOOL_CACHE') {
        return dirs.toolCache;
      }

      return dirs.root;
    });
  });

  afterEach(() => {
    removeTestDirs(dirs);
  });

  it('runs the data script without dependency caching for skipped PHP versions', async () => {
    setActionInputs('5.4', 'xdebug, pcov', 'cache-v1');

    await cache.run();

    expect(exec).toHaveBeenCalledWith('bash', [
      utils.SCRIPT_PATH,
      'data',
      'xdebug, pcov',
      '5.4',
      'cache-v1'
    ]);
    expect(restoreCache).not.toHaveBeenCalled();
  });

  it('skips dependency handling for unsupported PHP versions', async () => {
    await cache.handleDependencies('xdebug', '5.5', 'linux');

    expect(restoreCache).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(saveCache).not.toHaveBeenCalled();
  });

  it('skips dependency handling on unsupported platforms', async () => {
    await cache.handleDependencies('xdebug', '8.3', 'win32');

    expect(restoreCache).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(saveCache).not.toHaveBeenCalled();
  });

  it('runs dependency restoration without saving when the cache already exists', async () => {
    writeKeyOutput(dirs.runnerTemp, 'cache-v2');
    restoreCache.mockResolvedValue('cache-hit');

    await cache.handleDependencies('xdebug', '8.3', 'linux');

    expect(restoreCache).toHaveBeenCalledWith(
      [join(dirs.toolCache, 'deps')],
      'cache-v2-deps',
      ['cache-v2-deps']
    );
    expect(exec).toHaveBeenCalledWith('bash', [
      utils.SCRIPT_PATH,
      'dependencies',
      'xdebug',
      '8.3'
    ]);
    expect(saveCache).not.toHaveBeenCalled();
  });

  it('skips cache save when the dependency directory does not exist', async () => {
    writeKeyOutput(dirs.runnerTemp, 'cache-v3');

    await cache.handleDependencies('xdebug', '8.3', 'linux');

    expect(saveCache).not.toHaveBeenCalled();
  });

  it('saves the dependency cache when the directory exists and no cache is restored', async () => {
    writeKeyOutput(dirs.runnerTemp, 'cache-v4');
    mkdirSync(join(dirs.toolCache, 'deps'), {recursive: true});

    await cache.handleDependencies('xdebug', '8.3', 'linux');

    expect(saveCache).toHaveBeenCalledWith(
      [join(dirs.toolCache, 'deps')],
      'cache-v4-deps'
    );
  });

  it('falls back to a secondary cache key when the first save fails', async () => {
    writeKeyOutput(dirs.runnerTemp, 'cache-v5');
    mkdirSync(join(dirs.toolCache, 'deps'), {recursive: true});
    saveCache
      .mockRejectedValueOnce(new Error('primary save failed'))
      .mockResolvedValueOnce(1);

    await cache.handleDependencies('xdebug', '8.3', 'linux');

    expect(saveCache).toHaveBeenNthCalledWith(
      1,
      [join(dirs.toolCache, 'deps')],
      'cache-v5-deps'
    );
    expect(saveCache).toHaveBeenNthCalledWith(
      2,
      [join(dirs.toolCache, 'deps')],
      'cache-v5-deps-take-2'
    );
  });

  it('reports run failures through core.setFailed', async () => {
    parseVersion.mockRejectedValue('parse failed');

    await cache.run();

    expect(setFailed).toHaveBeenCalledWith('parse failed');
  });

  it('routes validation errors through main()', async () => {
    await cache.main(async () => {
      throw new ValidationError('validation failed');
    });

    expect(setFailed).toHaveBeenCalledWith('validation failed');
    expect(info).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });

  it('routes reserve-cache errors through main()', async () => {
    await cache.main(async () => {
      throw new ReserveCacheError('reserve failed');
    });

    expect(info).toHaveBeenCalledWith('reserve failed');
    expect(setFailed).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
  });

  it('routes unexpected errors through main()', async () => {
    await cache.main(async () => {
      throw new Error('unexpected failure');
    });

    expect(warning).toHaveBeenCalledWith('unexpected failure');
    expect(setFailed).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('uses run() when main() is invoked without an explicit action', async () => {
    setActionInputs('5.4', 'xdebug, sodium', 'cache-v6');

    await cache.main();

    expect(exec).toHaveBeenCalledWith('bash', [
      utils.SCRIPT_PATH,
      'data',
      'xdebug, sodium',
      '5.4',
      'cache-v6'
    ]);
  });

  it('bootstraps only when the module is the entrypoint', async () => {
    const runAction = jest.fn() as jest.MockedFunction<() => Promise<void>>;
    runAction.mockResolvedValue(undefined);
    const actionPath = resolve(dirs.root, 'action.js');
    const otherPath = resolve(dirs.root, 'other.js');

    await cache.bootstrap(otherPath, toFileHref(actionPath), runAction);
    expect(runAction).not.toHaveBeenCalled();

    await cache.bootstrap(actionPath, toFileHref(actionPath), runAction);
    expect(runAction).toHaveBeenCalledTimes(1);
  });

  it('exposes helper functions for dependency decisions and error messages', () => {
    const actionPath = resolve(dirs.root, 'action.js');
    const otherPath = resolve(dirs.root, 'other.js');

    expect(cache.shouldHandleDependencies('8.4', 'darwin')).toBe(true);
    expect(cache.shouldHandleDependencies('5.3', 'linux')).toBe(false);
    expect(cache.shouldHandleDependencies('8.4')).toBe(
      ['darwin', 'linux'].includes(process.platform)
    );
    expect(cache.getErrorMessage(new Error('typed'))).toBe('typed');
    expect(cache.getErrorMessage('plain message')).toBe('plain message');
    expect(cache.isMainModule(actionPath, toFileHref(actionPath))).toBe(true);
    expect(cache.isMainModule(actionPath, toFileHref(otherPath))).toBe(false);
    expect(cache.isMainModule(actionPath)).toBe(false);
    expect(cache.isMainModule(undefined, toFileHref(actionPath))).toBe(false);
  });

  it('treats symlinked entrypoint paths as the main module', () => {
    const realActionPath = resolve(dirs.root, 'real-action.js');
    const symlinkActionPath = resolve(dirs.root, 'symlink-action.js');

    writeFileSync(realActionPath, '');
    expect(cache.normalizeModulePath(realActionPath)).toBe(
      realpathSync(realActionPath)
    );

    if (process.platform === 'win32') {
      return;
    }

    symlinkSync(realActionPath, symlinkActionPath, 'file');

    expect(cache.normalizeModulePath(symlinkActionPath)).toBe(
      realpathSync(realActionPath)
    );
    expect(
      cache.isMainModule(symlinkActionPath, toFileHref(realActionPath))
    ).toBe(true);
  });
});
