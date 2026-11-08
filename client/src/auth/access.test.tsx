// F-02 UI behavior (AC-02-07): role-aware navigation and the /forbidden page.
// The UI only guides people; the server enforces access (see server/tests/api/access.test.ts).
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from './AuthContext';

const borrower = { id: 3, email: 'borrower1@lendlab.test', name: 'Borrower One', role: 'BORROWER', locationIds: [] };
const custodian = { id: 5, email: 'custodian.hw@lendlab.test', name: 'Hardware Lab Custodian', role: 'CUSTODIAN', locationIds: [1] };

function signedInAs(user: typeof borrower | typeof custodian, path: string) {
  sessionStorage.setItem('lendlab.token', 'tok');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user }), { status: 200 }));
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

describe('role-aware navigation', () => {
  it('a borrower sees Catalog and My Borrowing, and no Requests link', async () => {
    signedInAs(borrower, '/catalog');
    await screen.findByTestId('page-catalog');

    expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Borrowing' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Requests' })).not.toBeInTheDocument();
  });

  it('a custodian sees Requests, and no borrower links', async () => {
    signedInAs(custodian, '/custodian/requests');
    await screen.findByTestId('page-custodian-requests');

    expect(screen.getByRole('link', { name: 'Requests' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Catalog' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Borrowing' })).not.toBeInTheDocument();
  });
});

describe('role-restricted routes', () => {
  it('a borrower opening /custodian/requests sees the "no access" page with a link home', async () => {
    signedInAs(borrower, '/custodian/requests');

    expect(await screen.findByText('You do not have access to this page.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/catalog');
    expect(screen.queryByTestId('page-custodian-requests')).not.toBeInTheDocument();
  });

  it('a custodian opening /my sees the "no access" page linking to their home', async () => {
    signedInAs(custodian, '/my');

    expect(await screen.findByText('You do not have access to this page.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/custodian/requests');
  });

  it('/forbidden itself is reachable for a signed-in user', async () => {
    signedInAs(borrower, '/forbidden');
    expect(await screen.findByText('You do not have access to this page.')).toBeInTheDocument();
  });
});
