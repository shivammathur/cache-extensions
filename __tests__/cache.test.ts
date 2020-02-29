import * as install from '../src/cache';

/**
 * Mock cache.ts
 */
jest.mock('../src/cache', () => ({
  run: jest.fn().mockImplementation(
    async (): Promise<string> => {
      const version: string = process.env['php-version'] || '';
      const extensions: string = process.env['extensions'] || '';
      const key: string = process.env['key'] || '';
      const script_path = 'extensions.sh';

      return (
        'bash ' + script_path + ' "' + extensions + '" ' + key + ' ' + version
      );
    }
  )
}));

/**
 * Function to set the process.env
 *
 * @param version
 * @param os
 * @param extension_csv
 * @param ini_values_csv
 * @param coverage_driver
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
  it('Test Run', async () => {
    setEnv('7.0', 'xdebug, pcov', 'cache-v1');
    // @ts-ignore
    const script: string = await install.run();
    expect(script).toContain('bash extensions.sh "xdebug, pcov" cache-v1 7.0');
  });

  it('Test Run', async () => {
    setEnv('7.4', 'xdebug, zip', 'cache-v2');
    // @ts-ignore
    const script: string = await install.run();
    expect(script).toContain('bash extensions.sh "xdebug, zip" cache-v2 7.4');
  });
});
