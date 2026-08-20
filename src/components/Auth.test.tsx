import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from '../test/supabase-mock';

type SupabaseStub = ReturnType<typeof createSupabaseMock>['supabase'];

const mocks = vi.hoisted(() => ({
  supabase: {} as SupabaseStub,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import Auth from './Auth';

const setup = () => {
  const mock = createSupabaseMock();
  mocks.supabase = mock.supabase;
  return mock;
};

const fillCredentials = async () => {
  await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'joel@example.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'hunter2');
};

const switchToSignup = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Sign up now' }));
};

describe('Auth', () => {
  it('signs in with email and password', async () => {
    const mock = setup();
    render(<Auth />);

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(mock.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'joel@example.com',
      password: 'hunter2',
    });
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Welcome back!'));
  });

  it('surfaces sign in errors as a toast', async () => {
    const mock = setup();
    mock.supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: new Error('Invalid login credentials'),
    });
    render(<Auth />);

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Invalid login credentials')
    );
  });

  it('toggles between the sign in and sign up modes', async () => {
    setup();
    render(<Auth />);

    expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument();

    await switchToSignup();
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('signs up and backfills the profile row with the display name', async () => {
    const mock = setup();
    render(<Auth />);

    await switchToSignup();
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Joel');
    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(mock.supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'joel@example.com',
      password: 'hunter2',
      options: { data: { display_name: 'Joel' } },
    });
    await waitFor(() => expect(mock.from).toHaveBeenCalledWith('Profiles'));
    expect(mock.builderFor('Profiles')?.upsert).toHaveBeenCalledWith({
      id: 'user-1',
      display_name: 'Joel',
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Check your email for the confirmation link!'
    );
  });

  it('rejects a blank display name on sign up', async () => {
    const mock = setup();
    render(<Auth />);

    await switchToSignup();
    await userEvent.type(screen.getByPlaceholderText('Your name'), '   ');
    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Display name is required for signup')
    );
    expect(mock.supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('skips the profile upsert when sign up returns no user', async () => {
    const mock = setup();
    mock.supabase.auth.signUp.mockResolvedValue({ data: { user: null }, error: null });
    render(<Auth />);

    await switchToSignup();
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Joel');
    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('starts the google oauth flow from the current origin', async () => {
    const mock = setup();
    render(<Auth />);

    await userEvent.click(screen.getByRole('button', { name: 'Google' }));

    expect(mock.supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  });

  it('surfaces google oauth errors as a toast', async () => {
    const mock = setup();
    mock.supabase.auth.signInWithOAuth.mockResolvedValue({
      data: null,
      error: new Error('provider disabled'),
    });
    render(<Auth />);

    await userEvent.click(screen.getByRole('button', { name: 'Google' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('provider disabled'));
  });
});
