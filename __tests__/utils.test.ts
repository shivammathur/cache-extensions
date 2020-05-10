import * as utils from '../src/utils';

jest.mock('@actions/core', () => ({
  getInput: jest.fn().mockImplementation(key => {
    return ['cache-extensions'].indexOf(key) !== -1 ? key : '';
  })
}));

describe('Utils tests', () => {
  it('checking getInput', async () => {
    process.env['test'] = 'cache-extensions';
    process.env['undefined'] = '';
    expect(await utils.getInput('test', false)).toBe('cache-extensions');
    expect(await utils.getInput('undefined', false)).toBe('');
    expect(await utils.getInput('cache-extensions', false)).toBe(
      'cache-extensions'
    );
    expect(await utils.getInput('DoesNotExist', false)).toBe('');
  });

  it('checking filterExtensions', async () => {
    expect(await utils.filterExtensions('a,:b,c')).toBe('a,c');
    expect(await utils.filterExtensions('a, :b, c')).toBe('a, c');
  });
});
