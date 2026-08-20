import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedEvent, FeedEventType } from '../types';
import { createSupabaseMock } from '../test/supabase-mock';

type SupabaseStub = ReturnType<typeof createSupabaseMock>['supabase'];

const mocks = vi.hoisted(() => ({ supabase: {} as SupabaseStub }));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

import Feed from './Feed';

const event = (
  eventType: FeedEventType,
  metadata: Record<string, unknown> = {},
  overrides: Partial<FeedEvent> = {}
): FeedEvent => ({
  id: `event-${eventType}`,
  user_id: 'friend-1',
  event_type: eventType,
  show_id: 'show-1',
  user_show_id: 'user-show-1',
  metadata,
  created_at: new Date().toISOString(),
  Profiles: { display_name: 'Mina' } as FeedEvent['Profiles'],
  Show_data: { title: 'Goblin' } as FeedEvent['Show_data'],
  ...overrides,
});

const setup = (events: FeedEvent[], extra: Parameters<typeof createSupabaseMock>[0] = {}) => {
  const mock = createSupabaseMock({
    ...extra,
    tables: {
      Friendships: {
        data: [{ user_id: 'user-1', friend_id: 'friend-1' }],
        error: null,
      },
      Feed_events: { data: events, error: null },
      User_shows: { data: null, error: null },
      Awards: { data: [], error: null },
      ...extra.tables,
    },
    singles: {
      User_shows: {
        data: { id: 'user-show-1', user_id: 'friend-1', show_id: 'show-1' },
        error: null,
      },
      ...extra.singles,
    },
  });
  mocks.supabase = mock.supabase;
  return mock;
};

const feedText = async () => (await screen.findByText(/Mina|Someone/)).closest('div')?.textContent;

describe('Feed', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('queries the feed for the current user and their accepted friends', async () => {
    const mock = setup([event('added_show', { status: 'want_to_watch' })]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);
    await screen.findByText('Activity Feed');

    expect(mock.builderFor('Friendships')?.eq).toHaveBeenCalledWith('status', 'accepted');
    expect(mock.builderFor('Feed_events')?.in).toHaveBeenCalledWith('user_id', [
      'user-1',
      'friend-1',
    ]);
    expect(mock.builderFor('Feed_events')?.limit).toHaveBeenCalledWith(50);
  });

  it('describes an added show with its humanized status', async () => {
    setup([event('added_show', { status: 'want_to_watch' })]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await feedText()).toBe('Mina added Goblin to their want to watch');
  });

  it.each([
    ['watched', 'Mina finished Goblin'],
    ['watching', 'Mina started watching Goblin'],
    ['want_to_watch', 'Mina wants to watch Goblin'],
  ])('describes a %s status change', async (newStatus, expected) => {
    setup([event('status_changed', { new_status: newStatus })]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await feedText()).toBe(expected);
  });

  it('describes a rating with the score', async () => {
    setup([event('rated', { rating: 9 })]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await feedText()).toBe('Mina rated Goblin a 9');
  });

  it('describes an award with spaces instead of underscores', async () => {
    setup([event('gave_award', { award: 'Funniest_Show' })]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await feedText()).toBe('Mina gave a Funniest Show award to Goblin');
  });

  it('describes playlist activity by playlist name', async () => {
    setup([
      event('created_playlist', { playlist_name: 'Cozy watches' }),
      event('followed_playlist', { playlist_name: 'Cozy watches' }, { id: 'event-follow' }),
    ]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(
      await screen.findByText(/created a new playlist:/)
    ).toHaveTextContent('Mina created a new playlist: Cozy watches');
    expect(screen.getByText(/followed/)).toHaveTextContent('Mina followed Cozy watches');
  });

  it('distinguishes liking your own comment from a friend comment', async () => {
    setup([
      event('liked_comment', { liked_user_display_name: 'Mina' }),
      event(
        'liked_comment',
        { liked_user_display_name: 'Joel' },
        { id: 'event-liked-other' }
      ),
    ]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText(/their own/)).toHaveTextContent(
      'Mina liked their own comment on Goblin'
    );
    expect(screen.getByText(/Joel's/)).toHaveTextContent(
      "Mina liked Joel's comment on Goblin"
    );
  });

  it('quotes the comment body for comment events', async () => {
    setup([event('commented', { comment: 'Best show ever' })]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('"Best show ever"')).toBeInTheDocument();
  });

  it('falls back to generic copy for unknown actors, shows and event types', async () => {
    setup([
      event('added_show' as FeedEventType, {}, {
        event_type: 'unknown_event' as FeedEventType,
        Profiles: undefined,
        Show_data: undefined,
      }),
    ]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('Someone interacted with a show')).toBeInTheDocument();
  });

  it('renders the empty state when there is no activity', async () => {
    setup([]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  });

  it('refetches when the refresh button is pressed', async () => {
    const mock = setup([event('rated', { rating: 9 })]);
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);
    await screen.findByText('Activity Feed');
    const callsAfterMount = mock.supabase.auth.getUser.mock.calls.length;

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(mock.supabase.auth.getUser.mock.calls.length).toBe(callsAfterMount + 1)
    );
  });

  it('opens the linked show with its awards when an event is clicked', async () => {
    const mock = setup([event('rated', { rating: 9 })], {
      tables: { Awards: { data: [{ id: 'award-1', show_id: 'show-1' }], error: null } },
    });
    const onShowClick = vi.fn();
    render(<Feed onShowClick={onShowClick} refreshTrigger={0} />);

    await userEvent.click(await screen.findByText('Mina'));

    await waitFor(() =>
      expect(onShowClick).toHaveBeenCalledWith({
        id: 'user-show-1',
        user_id: 'friend-1',
        show_id: 'show-1',
        awards: [{ id: 'award-1', show_id: 'show-1' }],
      })
    );
    expect(mock.builderFor('Awards')?.eq).toHaveBeenCalledWith('user_id', 'friend-1');
  });

  it('ignores clicks on events that are not linked to a list entry', async () => {
    const mock = setup([event('created_playlist', { playlist_name: 'Cozy' }, {
      user_show_id: undefined,
    })]);
    const onShowClick = vi.fn();
    render(<Feed onShowClick={onShowClick} refreshTrigger={0} />);

    await userEvent.click(await screen.findByText('Mina'));

    expect(onShowClick).not.toHaveBeenCalled();
    expect(mock.builderFor('User_shows')).toBeUndefined();
  });

  it('logs and stops loading when the feed query fails', async () => {
    setup([], { tables: { Feed_events: { data: null, error: { message: 'boom' } } } });
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('Error fetching feed:', { message: 'boom' });
  });

  it('does not query the feed when nobody is signed in', async () => {
    const mock = setup([], { user: null });
    render(<Feed onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
    expect(mock.from).not.toHaveBeenCalled();
  });
});
