import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from '../test/supabase-mock';

type SupabaseStub = ReturnType<typeof createSupabaseMock>['supabase'];

const mocks = vi.hoisted(() => ({
  supabase: {} as SupabaseStub,
  toastError: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));

import Navbar from './Navbar';

const props = {
  onAddClick: vi.fn(),
  onViewChange: vi.fn(),
  onProfileClick: vi.fn(),
  currentView: 'my-list',
  refreshTrigger: 0,
  pendingRequestsCount: 0,
};

const setup = (config: Parameters<typeof createSupabaseMock>[0] = {}) => {
  const mock = createSupabaseMock({
    tables: { Profiles: { data: { id: 'user-1', display_name: 'Joel' }, error: null } },
    ...config,
  });
  mocks.supabase = mock.supabase;
  return mock;
};

describe('Navbar', () => {
  it('renders the display name of the signed in user', async () => {
    setup();
    render(<Navbar {...props} />);

    expect(await screen.findByText('Joel')).toBeInTheDocument();
  });

  it('falls back to "User" when there is no profile row', async () => {
    setup({ tables: { Profiles: { data: null, error: null } } });
    render(<Navbar {...props} />);

    expect(await screen.findByText('User')).toBeInTheDocument();
  });

  it('does not fetch a profile when nobody is signed in', async () => {
    const mock = setup({ user: null });
    render(<Navbar {...props} />);

    expect(await screen.findByText('User')).toBeInTheDocument();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('reports the view the user navigates to', async () => {
    setup();
    const onViewChange = vi.fn();
    render(<Navbar {...props} onViewChange={onViewChange} />);

    for (const [label, view] of [
      ['Friends', 'friends'],
      ['Playlists', 'playlists'],
      ['Feed', 'feed'],
    ] as const) {
      await userEvent.click(screen.getAllByRole('button', { name: label })[0]);
      expect(onViewChange).toHaveBeenCalledWith(view);
    }

    await userEvent.click(screen.getAllByRole('button', { name: 'My List' })[0]);
    expect(onViewChange).toHaveBeenCalledWith('my-list');
  });

  it('shows a badge with the pending friend request count', async () => {
    setup();
    render(<Navbar {...props} pendingRequestsCount={3} />);

    // Once for desktop nav, once for the mobile nav.
    expect(await screen.findAllByText('3')).toHaveLength(2);
  });

  it('hides the badge when there are no pending requests', async () => {
    setup();
    render(<Navbar {...props} pendingRequestsCount={0} />);
    await screen.findByText('Joel');

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('triggers the add-show and profile callbacks', async () => {
    setup();
    const onAddClick = vi.fn();
    const onProfileClick = vi.fn();
    render(<Navbar {...props} onAddClick={onAddClick} onProfileClick={onProfileClick} />);

    await userEvent.click(screen.getByTitle('Add Show'));
    expect(onAddClick).toHaveBeenCalledTimes(1);

    await userEvent.click(await screen.findByText('Joel'));
    expect(onProfileClick).toHaveBeenCalledTimes(1);
  });

  it('signs the user out', async () => {
    const mock = setup();
    render(<Navbar {...props} />);

    await userEvent.click(screen.getByTitle('Logout'));

    expect(mock.supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('surfaces a sign out failure as a toast', async () => {
    const mock = setup();
    mock.supabase.auth.signOut.mockResolvedValue({ error: { message: 'sign out failed' } });
    render(<Navbar {...props} />);

    await userEvent.click(screen.getByTitle('Logout'));

    expect(mocks.toastError).toHaveBeenCalledWith('sign out failed');
  });

  it('renders the avatar image when the profile has one', async () => {
    setup({
      tables: {
        Profiles: {
          data: { id: 'user-1', display_name: 'Joel', avatar_url: 'https://img/joel.png' },
          error: null,
        },
      },
    });
    render(<Navbar {...props} />);

    expect(await screen.findByRole('img', { name: 'Joel' })).toHaveAttribute(
      'src',
      'https://img/joel.png'
    );
  });
});
