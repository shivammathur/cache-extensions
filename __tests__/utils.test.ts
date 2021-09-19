import * as fs from 'fs';
import * as path from 'path';
import * as utils from '../src/utils';

async function cleanup(path: string): Promise<void> {
  fs.unlink(path, error => {
    if (error) {
      console.log(error);
    }
  });
}

describe('Utils tests', () => {
  it('checking getOutput', async () => {
    const temp_dir: string = process.env['RUNNER_TEMP'] || '';
    const file_path: string = path.join(temp_dir, 'test');
    fs.writeFileSync(file_path, 'test', {mode: 0o755});
    expect(await utils.getOutput('test')).toBe('test');
    await cleanup(file_path);
  });

  it('checking filterExtensions', async () => {
    expect(await utils.filterExtensions('a,:b,c')).toBe('"a,c"');
    expect(await utils.filterExtensions('a, :b, c')).toBe('"a, c"');
  });

  it('checking scriptCall', async () => {
    const script: string = path.join(__dirname, '../src/scripts/cache.sh');
    expect(await utils.scriptCall('test a b')).toBe(
      ['bash', script, 'test', 'a', 'b'].join(' ')
    );
  });
});
