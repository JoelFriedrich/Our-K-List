import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ id: 'client' })),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

const loadModule = () => import('./supabase');

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('creates the client from the vite env vars', async () => {
    const { supabase } = await loadModule();

    expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
    expect(supabase).toEqual({ id: 'client' });
  });

  it('throws a descriptive error when the url is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');

    await expect(loadModule()).rejects.toThrow(/Missing Supabase environment variables/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when the anon key is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(loadModule()).rejects.toThrow(/Missing Supabase environment variables/);
    expect(createClient).not.toHaveBeenCalled();
  });
});
