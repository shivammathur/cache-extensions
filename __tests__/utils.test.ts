import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as utils from '../src/utils.js';

describe('Utils tests', () => {
  let runnerTemp: string;

  beforeEach(() => {
    runnerTemp = mkdtempSync(join(tmpdir(), 'cache-extensions-utils-'));
    process.env['RUNNER_TEMP'] = runnerTemp;
  });

  afterEach(() => {
    rmSync(runnerTemp, {recursive: true, force: true});
  });

  it('checking getOutput', async () => {
    const file_path: string = join(runnerTemp, 'test');
    writeFileSync(file_path, 'test');
    expect(await utils.getOutput('test')).toBe('test');
  });

  it('checking filterExtensions', async () => {
    expect(utils.filterExtensions('a,:b,c')).toBe('a,c');
    expect(utils.filterExtensions('a, :b, c')).toBe('a, c');
  });

  it('checking SCRIPT_PATH', () => {
    expect(utils.SCRIPT_PATH).toBe(join(import.meta.dirname, '../src/scripts/cache.sh'));
  });

  it('checking scriptCall', () => {
    expect(utils.scriptCall('test', 'a', 'b')).toEqual({
      command: 'bash',
      args: [utils.SCRIPT_PATH, 'test', 'a', 'b']
    });
  });
});
