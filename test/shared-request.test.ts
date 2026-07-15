import { createSharedRequestCache } from '../web/src/lib/shared-request.js';

describe('shared request cache', () => {
  it('shares one in-flight request between duplicate consumers', async () => {
    const cache = createSharedRequestCache<string>();
    let calls = 0;
    let resolveRequest!: (value: string) => void;
    const request = () => {
      calls += 1;
      return new Promise<string>((resolve) => {
        resolveRequest = resolve;
      });
    };

    const first = cache.run('callback-key', request);
    const second = cache.run('callback-key', request);

    expect(first).toBe(second);
    expect(calls).toBe(1);

    resolveRequest('done');
    await expect(first).resolves.toBe('done');
  });

  it('clears settled requests so a failed callback can be retried', async () => {
    const cache = createSharedRequestCache<string>();
    let calls = 0;

    await expect(cache.run('callback-key', async () => {
      calls += 1;
      throw new Error('temporary failure');
    })).rejects.toThrow('temporary failure');

    await expect(cache.run('callback-key', async () => {
      calls += 1;
      return 'retried';
    })).resolves.toBe('retried');
    expect(calls).toBe(2);
  });

  it('does not cache a factory that throws before returning a promise', () => {
    const cache = createSharedRequestCache<string>();
    let calls = 0;

    expect(() => cache.run('callback-key', () => {
      calls += 1;
      throw new Error('invalid callback');
    })).toThrow('invalid callback');

    expect(() => cache.run('callback-key', () => {
      calls += 1;
      throw new Error('retried');
    })).toThrow('retried');
    expect(calls).toBe(2);
  });
});
