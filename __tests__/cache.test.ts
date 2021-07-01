import path from 'path';
import * as cache from '../src/cache';
import * as utils from '../src/utils';

/**
 * Mock cache.ts
 */
jest.mock('../src/cache', () => ({
  run: jest.fn().mockImplementation(async (): Promise<string> => {
    const version: string = await utils.parseVersion(
      process.env['php-version'] || ''
    );
    const extensions = await utils.filterExtensions(
      process.env['extensions'] || ''
    );
    const key: string = process.env['key'] || '';
    return await utils.scriptCall('test', extensions, key, version);
  })
}));

/**
 * Function to set the process.env
 *
 * @param version
 * @param extensions
 * @param key
 */
function setEnv(
  version: string | number,
  extensions: string,
  key: string
): void {
  process.env['php-version'] = version.toString();
  process.env['extensions'] = extensions;
  process.env['key'] = key;
}

describe('Install', () => {
  const spath: string = path.join(__dirname, '../src/scripts/cache.sh');
  it('Test Run', async () => {
    setEnv('7.0', 'xdebug, pcov', 'cache-v1');
    const script: string = '' + (await cache.run());
    expect(script).toContain(`bash ${spath} test "xdebug, pcov" cache-v1 7.0`);
  });

  it('Test Run', async () => {
    setEnv('7.4', 'xdebug, zip', 'cache-v2');
    const script: string = '' + (await cache.run());
    expect(script).toContain(`bash ${spath} test "xdebug, zip" cache-v2 7.4`);
  });

  it('Test Run', async () => {
    setEnv('7.4', 'xdebug, :zip', 'cache-v2');
    const script: string = '' + (await cache.run());
    expect(script).toContain(`bash ${spath} test "xdebug" cache-v2 7.4`);
  });
});
