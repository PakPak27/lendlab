// SYS-01: the app shows loading, success, and error states for the API status check.
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SystemStatus from './SystemStatus';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SystemStatus', () => {
  it('shows a loading message while checking', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<SystemStatus />);
    expect(screen.getByText('Checking system status…')).toBeInTheDocument();
  });

  it('shows connected when /api/ready succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ db: 'connected' }), { status: 200 }),
    );
    render(<SystemStatus />);
    expect(await screen.findByText('API and database are connected.')).toBeInTheDocument();
  });

  it('shows the error and a Retry button when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<SystemStatus />);
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
