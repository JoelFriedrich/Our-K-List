import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Show, UserShow } from '../types';
import ShowCard from './ShowCard';

const show: Show = {
  id: 'show-1',
  tmdb_id: 1234,
  title: 'Goblin',
  poster_url: 'https://example.com/goblin.jpg',
  summary: 'A goblin looks for his bride.',
  seasons: 1,
  episodes: 16,
  actors: ['Gong Yoo'],
  characters: ['Kim Shin'],
  release_year: 2016,
};

const userShow = (overrides: Partial<UserShow> = {}): UserShow => ({
  id: 'user-show-1',
  user_id: 'user-1',
  show_id: 'show-1',
  user_rating: 9.5,
  comments: 'Loved it',
  status: 'watched',
  added_at: '2024-01-01T00:00:00.000Z',
  is_spoiler: false,
  show,
  ...overrides,
});

describe('ShowCard', () => {
  it('renders the show poster, title, year and counts', () => {
    render(<ShowCard userShow={userShow()} onClick={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'Goblin' })).toHaveAttribute(
      'src',
      'https://example.com/goblin.jpg'
    );
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('2016')).toBeInTheDocument();
    expect(screen.getByText('1 Seasons')).toBeInTheDocument();
    expect(screen.getByText('16 Episodes')).toBeInTheDocument();
  });

  it('renders nothing when the joined show is missing', () => {
    const { container } = render(
      <ShowCard userShow={userShow({ show: undefined })} onClick={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('omits the release year when it is not set', () => {
    render(
      <ShowCard userShow={userShow({ show: { ...show, release_year: null } })} onClick={vi.fn()} />
    );

    expect(screen.queryByText('2016')).not.toBeInTheDocument();
  });

  it('humanizes the status badge', () => {
    render(<ShowCard userShow={userShow({ status: 'want_to_watch' })} onClick={vi.fn()} />);

    expect(screen.getByText('want to watch')).toBeInTheDocument();
  });

  it('hides the rating for shows that are only planned', () => {
    render(<ShowCard userShow={userShow({ status: 'want_to_watch' })} onClick={vi.fn()} />);

    expect(screen.queryByText('9.5')).not.toBeInTheDocument();
  });

  it('shows the rating for watched shows', () => {
    render(<ShowCard userShow={userShow()} onClick={vi.fn()} />);

    expect(screen.getByText('9.5')).toBeInTheDocument();
  });

  it('shows the spoiler badge only when flagged', () => {
    const { unmount } = render(<ShowCard userShow={userShow()} onClick={vi.fn()} />);
    expect(screen.queryByTitle('Contains Spoilers')).not.toBeInTheDocument();
    unmount();

    render(<ShowCard userShow={userShow({ is_spoiler: true })} onClick={vi.fn()} />);
    expect(screen.getByTitle('Contains Spoilers')).toBeInTheDocument();
  });

  it('lists every award badge', () => {
    render(
      <ShowCard
        userShow={userShow({
          awards: [
            {
              id: 'award-1',
              user_id: 'user-1',
              show_id: 'show-1',
              award: 'Funniest Show',
              created_at: '2024-01-01T00:00:00.000Z',
            },
            {
              id: 'award-2',
              user_id: 'user-1',
              show_id: 'show-1',
              award: 'Most Rewatched',
              created_at: '2024-01-01T00:00:00.000Z',
            },
          ],
        })}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText('Funniest Show')).toBeInTheDocument();
    expect(screen.getByText('Most Rewatched')).toBeInTheDocument();
  });

  it('calls onClick when the card is clicked', async () => {
    const onClick = vi.fn();
    render(<ShowCard userShow={userShow()} onClick={onClick} />);

    await userEvent.click(screen.getByText('Goblin'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
