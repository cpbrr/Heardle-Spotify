import { describe, expect, it, vi } from 'vitest';

import { AppError } from './authClient';
import { withRetry } from './withRetry';

function immediateDelay() {
  return vi.fn().mockResolvedValue(undefined);
}

describe('withRetry', () => {
  it('resolves on first success without delaying', async () => {
    const delay = immediateDelay();
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withRetry(fn, { delay })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('retries a retryable AppError and succeeds', async () => {
    const delay = immediateDelay();
    const fn = vi.fn()
      .mockRejectedValueOnce(new AppError('Spotify unavailable', { retryable: true, retryAfterMs: 1234 }))
      .mockResolvedValueOnce('ok');

    await expect(withRetry(fn, { delay })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(1234);
  });

  it('falls back to a default delay when retryAfterMs is absent', async () => {
    const delay = immediateDelay();
    const fn = vi.fn()
      .mockRejectedValueOnce(new AppError('Spotify unavailable', { retryable: true }))
      .mockResolvedValueOnce('ok');

    await expect(withRetry(fn, { delay })).resolves.toBe('ok');
    expect(delay).toHaveBeenCalledWith(500);
  });

  it('gives up after maxRetries and rethrows the last error', async () => {
    const delay = immediateDelay();
    const error = new AppError('Spotify unavailable', { retryable: true });
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { delay, maxRetries: 2 })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable AppError', async () => {
    const delay = immediateDelay();
    const error = new AppError('Not authenticated', { retryable: false });
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { delay })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('does not retry an error that is not an AppError', async () => {
    const delay = immediateDelay();
    const error = new Error('boom');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { delay })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
});
