// Lab 5 Issue #38 (R-08): the footer shows the running release from /api/health.
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReleaseFooter from './ReleaseFooter';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('ReleaseFooter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the short commit of the running release', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(200, { status: 'ok', commit: 'be0a452833b82efe58895a982438d58fa2c5b9c1' }),
    );
    render(<ReleaseFooter />);
    expect(await screen.findByText('be0a452')).toHaveAttribute('title', 'be0a452833b82efe58895a982438d58fa2c5b9c1');
    expect(screen.getByTestId('release-footer')).toHaveTextContent('LendLab release be0a452');
  });

  it('shows "local" for a local run', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { status: 'ok', commit: 'local' }));
    render(<ReleaseFooter />);
    expect(await screen.findByText('local')).toBeInTheDocument();
  });

  it('renders nothing when the health check fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const { container } = render(<ReleaseFooter />);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
