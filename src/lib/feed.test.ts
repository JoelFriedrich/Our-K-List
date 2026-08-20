import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, insert, from } = vi.hoisted(() => {
  const insert = vi.fn();
  return {
    getSession: vi.fn(),
    insert,
    from: vi.fn(() => ({ insert })),
  };
});

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession }, from },
}));

import { insertFeedEvent } from './feed';

const session = (userId: string | null) => ({
  data: { session: userId ? { user: { id: userId } } : null },
});

describe('insertFeedEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    getSession.mockResolvedValue(session('user-1'));
    insert.mockResolvedValue({ error: null });
  });

  it('inserts the event with the id from the fresh session', async () => {
    await insertFeedEvent('added_show', 'show-1', 'user-show-1', { title: 'Goblin' });

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('Feed_events');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      event_type: 'added_show',
      show_id: 'show-1',
      user_show_id: 'user-show-1',
      metadata: { title: 'Goblin' },
    });
  });

  it('skips the insert when there is no active session', async () => {
    getSession.mockResolvedValue(session(null));

    await insertFeedEvent('rated', 'show-1', 'user-show-1', {});

    expect(insert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('No active session for feed event insert');
  });

  it('skips the insert when the session has no user id', async () => {
    getSession.mockResolvedValue({ data: { session: { user: {} } } });

    await insertFeedEvent('rated', 'show-1', 'user-show-1', {});

    expect(insert).not.toHaveBeenCalled();
  });

  it('swallows insert errors so callers are never rejected', async () => {
    insert.mockResolvedValue({ error: new Error('duplicate key') });

    await expect(
      insertFeedEvent('commented', 'show-1', 'user-show-1', {})
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      'Feed event insert failed:',
      expect.any(Error)
    );
  });

  it('swallows a rejected session lookup', async () => {
    getSession.mockRejectedValue(new Error('network down'));

    await expect(
      insertFeedEvent('gave_award', 'show-1', 'user-show-1', {})
    ).resolves.toBeUndefined();
    expect(insert).not.toHaveBeenCalled();
  });
});
