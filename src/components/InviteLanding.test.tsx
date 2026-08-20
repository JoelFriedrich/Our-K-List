import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from '../test/supabase-mock';

type SupabaseStub = ReturnType<typeof createSupabaseMock>['supabase'];

const mocks = vi.hoisted(() => ({ supabase: {} as SupabaseStub }));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

vi.mock('./Auth', () => ({
  default: () => <div data-testid="auth-form" />,
}));

import InviteLanding from './InviteLanding';

const setup = (invite: { data: unknown; error?: unknown }) => {
  const mock = createSupabaseMock({ tables: { Invite_links: invite } });
  mocks.supabase = mock.supabase;
  return mock;
};

describe('InviteLanding', () => {
  it('names the inviter once the invite link resolves', async () => {
    setup({ data: { Profiles: { display_name: 'Joel' } }, error: null });
    render(<InviteLanding code="abc123" onAuthSuccess={vi.fn()} />);

    expect(await screen.findByText('Joel invited you to join Our K-List')).toBeInTheDocument();
    expect(screen.getByTestId('auth-form')).toBeInTheDocument();
  });

  it('falls back to a generic invite message when the inviter is unknown', async () => {
    setup({ data: null, error: { message: 'not found' } });
    render(<InviteLanding code="abc123" onAuthSuccess={vi.fn()} />);

    expect(
      await screen.findByText('Your friend invited you to join Our K-List')
    ).toBeInTheDocument();
  });

  it('falls back when the invite row has no joined profile', async () => {
    setup({ data: { Profiles: null }, error: null });
    render(<InviteLanding code="abc123" onAuthSuccess={vi.fn()} />);

    expect(
      await screen.findByText('Your friend invited you to join Our K-List')
    ).toBeInTheDocument();
  });

  it('looks the invite up by its code', async () => {
    const mock = setup({ data: { Profiles: { display_name: 'Joel' } }, error: null });
    render(<InviteLanding code="abc123" onAuthSuccess={vi.fn()} />);
    await screen.findByTestId('auth-form');

    expect(mock.from).toHaveBeenCalledWith('Invite_links');
    expect(mock.builderFor('Invite_links')?.eq).toHaveBeenCalledWith('code', 'abc123');
  });
});
