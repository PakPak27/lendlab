// F-01 UI behavior (AC-01-08): login form states, redirect by role, protected routes, sign out.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';

const borrower = { id: 3, email: 'borrower1@lendlab.test', name: 'Borrower One', role: 'BORROWER', locationIds: [] };
const custodian = {
  id: 5,
  email: 'custodian.hw@lendlab.test',
  name: 'Hardware Lab Custodian',
  role: 'CUSTODIAN',
  locationIds: [1],
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const unauthenticated = () =>
  json(401, { error: { code: 'UNAUTHENTICATED', message: 'You must sign in to continue.' } });

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('protected routes', () => {
  it('redirects to /login when there is no token (opening /my signed out)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(unauthenticated());
    renderApp('/my');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('clears a stale token and redirects to /login when /me returns 401', async () => {
    sessionStorage.setItem('lendlab.token', 'stale');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(unauthenticated());
    renderApp('/my');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(sessionStorage.getItem('lendlab.token')).toBeNull();
  });
});

async function openLogin() {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(unauthenticated());
  renderApp('/login');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Sign in' });
  return { user, fetchSpy };
}

describe('login form', () => {
  it('has labelled fields and disables Sign in while submitting', async () => {
    const { user, fetchSpy } = await openLogin();
    fetchSpy.mockReturnValue(new Promise(() => {})); // login never resolves
    await user.type(screen.getByLabelText('E-mail'), 'borrower1@lendlab.test');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: /Signing in/ })).toBeDisabled();
  });

  it('shows a red alert for wrong credentials (401) and stores no token', async () => {
    const { user, fetchSpy } = await openLogin();
    fetchSpy.mockResolvedValue(
      json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid e-mail or password.' } }),
    );
    await user.type(screen.getByLabelText('E-mail'), 'borrower1@lendlab.test');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid e-mail or password.');
    expect(sessionStorage.getItem('lendlab.token')).toBeNull();
  });

  it('shows inline field errors for a 400 response', async () => {
    const { user, fetchSpy } = await openLogin();
    fetchSpy.mockResolvedValue(
      json(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request is invalid.',
          details: [{ field: 'email', message: 'Enter a valid e-mail address.' }],
        },
      }),
    );
    await user.type(screen.getByLabelText('E-mail'), 'abc');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid e-mail address.')).toBeInTheDocument();
  });

  it('shows the network error message when the server cannot be reached', async () => {
    const { user, fetchSpy } = await openLogin();
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    await user.type(screen.getByLabelText('E-mail'), 'borrower1@lendlab.test');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server. Try again.');
  });
});

describe('after sign-in', () => {
  async function signIn(record: typeof borrower | typeof custodian) {
    const { user, fetchSpy } = await openLogin();
    fetchSpy.mockResolvedValue(json(200, { token: 'tok123', user: record }));
    await user.type(screen.getByLabelText('E-mail'), record.email);
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    return { user, fetchSpy };
  }

  it('sends a borrower to /catalog and shows their name and role badge', async () => {
    await signIn(borrower);
    expect(await screen.findByTestId('page-catalog')).toBeInTheDocument();
    expect(screen.getByText('Borrower One')).toBeInTheDocument();
    expect(screen.getByText('Borrower')).toBeInTheDocument();
    expect(sessionStorage.getItem('lendlab.token')).toBe('tok123');
  });

  it('sends a custodian to /custodian/requests', async () => {
    await signIn(custodian);
    expect(await screen.findByTestId('page-custodian-requests')).toBeInTheDocument();
    expect(screen.getByText('Custodian')).toBeInTheDocument();
  });

  it('Sign out calls the logout endpoint, clears the token and returns to /login', async () => {
    const { user, fetchSpy } = await signIn(borrower);
    await screen.findByTestId('page-catalog');

    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(sessionStorage.getItem('lendlab.token')).toBeNull();
    await waitFor(() => {
      const logoutCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/api/auth/logout'));
      expect(logoutCall).toBeDefined();
      const headers = new Headers((logoutCall![1] as RequestInit).headers);
      expect(headers.get('Authorization')).toBe('Bearer tok123');
    });
  });
});
