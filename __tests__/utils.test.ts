import * as utils from '../src/utils';

jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockImplementation(key => {
    return ['cache-extensions'].indexOf(key) !== -1 ? key : '';
  })
}));

describe('Utils tests', () => {
  it('checking readEnv', async () => {
    process.env['test'] = 'setup-php';
    expect(await utils.readEnv('test')).toBe('setup-php');
    expect(await utils.readEnv('undefined')).toBe('');
  });

  it('checking getInput', async () => {
    process.env['test'] = 'setup-php';
    expect(await utils.getInput('test', false)).toBe('setup-php');
    expect(await utils.getInput('cache-extensions', false)).toBe(
      'cache-extensions'
    );
    expect(await utils.getInput('DoesNotExist', false)).toBe('');
    expect(async () => {
      await utils.getInput('DoesNotExist', true);
    }).rejects.toThrow('Input required and not supplied: DoesNotExist');
  });

  it('checking parseVersion', async () => {
    expect(await utils.parseVersion('7')).toBe('7.0');
    expect(await utils.parseVersion('7.4')).toBe('7.4');
    expect(await utils.parseVersion('latest')).toBe('7.4');
  });

  it('checking filterExtensions', async () => {
    expect(await utils.filterExtensions('a,:b,c')).toBe('a,c');
    expect(await utils.filterExtensions('a, :b, c')).toBe('a, c');
  });
});
