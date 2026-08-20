import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Award, Show, UserShow } from '../types';
import { createSupabaseMock } from '../test/supabase-mock';

type SupabaseStub = ReturnType<typeof createSupabaseMock>['supabase'];

const mocks = vi.hoisted(() => ({ supabase: {} as SupabaseStub }));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

import MyList from './MyList';

const show = (overrides: Partial<Show> = {}): Show => ({
  id: 'show-1',
  tmdb_id: 1,
  title: 'Goblin',
  poster_url: 'https://example.com/goblin.jpg',
  summary: 'A goblin looks for his bride.',
  seasons: 1,
  episodes: 16,
  actors: ['Gong Yoo'],
  characters: ['Kim Shin'],
  release_year: 2016,
  ...overrides,
});

const userShow = (overrides: Partial<UserShow> = {}): UserShow => ({
  id: 'user-show-1',
  user_id: 'user-1',
  show_id: 'show-1',
  user_rating: 8,
  comments: '',
  status: 'watched',
  added_at: '2024-01-01T00:00:00.000Z',
  is_spoiler: false,
  show: show(),
  ...overrides,
});

const award = (showId: string, id: string): Award => ({
  id,
  user_id: 'user-1',
  show_id: showId,
  award: 'Funniest Show',
  created_at: '2024-01-01T00:00:00.000Z',
});

const shows: UserShow[] = [
  userShow({ id: 'us-1', show_id: 'show-1', user_rating: 7, show: show() }),
  userShow({
    id: 'us-2',
    show_id: 'show-2',
    user_rating: 10,
    comments: 'made me cry',
    show: show({ id: 'show-2', title: 'Crash Landing on You', actors: ['Hyun Bin'] }),
  }),
  userShow({
    id: 'us-3',
    show_id: 'show-3',
    status: 'watching',
    user_rating: 6,
    show: show({ id: 'show-3', title: 'Vincenzo' }),
  }),
  userShow({
    id: 'us-4',
    show_id: 'show-4',
    status: 'want_to_watch',
    user_rating: 0,
    show: show({ id: 'show-4', title: 'Reply 1988' }),
  }),
];

const setup = (config: Parameters<typeof createSupabaseMock>[0] = {}) => {
  const mock = createSupabaseMock({
    ...config,
    tables: {
      User_shows: { data: shows, error: null },
      Awards: { data: [award('show-1', 'award-1')], error: null },
      Profiles: { data: { id: 'user-1', display_name: 'Joel' }, error: null },
      ...config.tables,
    },
  });
  mocks.supabase = mock.supabase;
  return mock;
};

/** Icon-only buttons in the toolbar: [grid view, list view]. */
const iconButtons = () =>
  screen.getAllByRole('button').filter((button) => button.textContent === '');

const titles = () =>
  screen
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

describe('MyList', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('shows the profile name and total number of tracked shows', async () => {
    setup();
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('Joel List')).toBeInTheDocument();
    expect(screen.getByText('4 Total Shows tracked')).toBeInTheDocument();
  });

  it('falls back to a generic header when there is no profile', async () => {
    setup({ tables: { Profiles: { data: null, error: null } } });
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('My List')).toBeInTheDocument();
  });

  it('lists only watched shows by default, highest rated first', async () => {
    setup();
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);

    await waitFor(() => expect(titles()).toEqual(['Crash Landing on You', 'Goblin']));
  });

  it('switches the visible shows when another status tab is selected', async () => {
    setup();
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);
    await screen.findByText('Goblin');

    await userEvent.click(screen.getByRole('button', { name: 'watching' }));

    expect(titles()).toEqual(['Vincenzo']);
  });

  it('filters by title, comment and actor', async () => {
    setup();
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);
    const search = await screen.findByPlaceholderText('Search watched shows...');

    await userEvent.type(search, 'goblin');
    expect(titles()).toEqual(['Goblin']);

    await userEvent.clear(search);
    await userEvent.type(search, 'made me cry');
    expect(titles()).toEqual(['Crash Landing on You']);

    await userEvent.clear(search);
    await userEvent.type(search, 'hyun bin');
    expect(titles()).toEqual(['Crash Landing on You']);
  });

  it('clears the search with the reset button', async () => {
    setup();
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);
    const search = await screen.findByPlaceholderText('Search watched shows...');

    await userEvent.type(search, 'goblin');
    expect(titles()).toEqual(['Goblin']);

    await userEvent.click(iconButtons()[0]);

    expect(search).toHaveValue('');
    expect(titles()).toEqual(['Crash Landing on You', 'Goblin']);
  });

  it('reports when a search matches nothing', async () => {
    setup();
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);
    const search = await screen.findByPlaceholderText('Search watched shows...');

    await userEvent.type(search, 'nothing here');

    expect(
      screen.getByText('No shows matching "nothing here" in watched.')
    ).toBeInTheDocument();
  });

  it('keeps only awarded shows when sorting by awards', async () => {
    setup();
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);
    await screen.findByText('Goblin');

    await userEvent.click(screen.getByRole('button', { name: 'Awards' }));

    expect(titles()).toEqual(['Goblin']);
  });

  it('renders an empty state for a status with no shows', async () => {
    setup({ tables: { User_shows: { data: [], error: null } } });
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);

    expect(await screen.findByText('No shows in this category yet.')).toBeInTheDocument();
  });

  it('renders a ranked list in list view and notifies clicks', async () => {
    setup();
    const onShowClick = vi.fn();
    render(<MyList onShowClick={onShowClick} refreshTrigger={0} />);
    await screen.findByText('Goblin');

    await userEvent.click(iconButtons()[1]);

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Crash Landing on You'));
    expect(onShowClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'us-2' })
    );
  });

  it('stops loading and logs when the shows query fails', async () => {
    setup({ tables: { User_shows: { data: null, error: { message: 'boom' } } } });
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);

    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('My List fetch error:', { message: 'boom' })
    );
  });

  it('does not query shows when nobody is signed in', async () => {
    const mock = setup({ user: null });
    render(<MyList onShowClick={vi.fn()} refreshTrigger={0} />);

    await waitFor(() => expect(mock.supabase.auth.getUser).toHaveBeenCalled());
    expect(mock.from).not.toHaveBeenCalled();
  });
});
