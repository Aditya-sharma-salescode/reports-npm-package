import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportTiles } from '../src/screens/ReportTiles';
import { makeReportConfig } from './fixtures';

const cards = [
  makeReportConfig({ id: 'a', name: 'Sales Summary', description: 'Daily sales', type: 'Sales' }),
  makeReportConfig({ id: 'b', name: 'Stock Report', description: 'Inventory levels', type: 'Inventory' }),
  makeReportConfig({ id: 'c', name: 'Sales Detail', description: 'Line items', type: 'Sales' }),
  makeReportConfig({ id: 'd', name: 'Live Feed', description: 'Realtime', type: 'Sales', isLiveReport: true }),
];

/** The search input is hidden behind a toggle; open it and return the input. */
async function openSearch() {
  await userEvent.click(screen.getByLabelText(/search reports/i));
  return screen.getByPlaceholderText(/search reports/i);
}

describe('ReportTiles', () => {
  beforeEach(() => localStorage.clear()); // favourites persist to localStorage

  it('renders the Reports header', () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('renders every report card', () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    expect(screen.getByText('Sales Summary')).toBeInTheDocument();
    expect(screen.getByText('Stock Report')).toBeInTheDocument();
    expect(screen.getByText('Live Feed')).toBeInTheDocument();
  });

  it('groups cards by type with uppercased section labels', () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    expect(screen.getByText('SALES')).toBeInTheDocument();
    expect(screen.getByText('INVENTORY')).toBeInTheDocument();
  });

  it('defaults a missing type to the "REPORTS" group label', () => {
    render(
      <ReportTiles reportCards={[makeReportConfig({ id: 'x', name: 'No Type' })]} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('REPORTS')).toBeInTheDocument();
  });

  it('calls onSelect with the clicked card config', async () => {
    const onSelect = vi.fn();
    render(<ReportTiles reportCards={cards} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('Stock Report'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('filters cards by name via the search box', async () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    const input = await openSearch();
    await userEvent.type(input, 'stock');
    expect(screen.getByText('Stock Report')).toBeInTheDocument();
    expect(screen.queryByText('Sales Summary')).not.toBeInTheDocument();
  });

  it('filters cards by description text', async () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    const input = await openSearch();
    await userEvent.type(input, 'inventory');
    expect(screen.getByText('Stock Report')).toBeInTheDocument();
    expect(screen.queryByText('Sales Detail')).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    const input = await openSearch();
    await userEvent.type(input, 'nonexistent');
    expect(screen.getByText(/no reports match/i)).toBeInTheDocument();
  });

  it('shows a LIVE badge on live reports', () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('clears the search via the clear button', async () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    const input = await openSearch();
    await userEvent.type(input, 'stock');
    expect(screen.queryByText('Sales Summary')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/clear search/i));
    expect(screen.getByText('Sales Summary')).toBeInTheDocument();
  });

  it('hides the header when showHeader is false', () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} showHeader={false} />);
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    // Cards still render.
    expect(screen.getByText('Sales Summary')).toBeInTheDocument();
  });

  it('moves a card into a FAVOURITES section when starred', async () => {
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/add sales summary to favourites/i));
    expect(screen.getByText('FAVOURITES')).toBeInTheDocument();
    // The favourite persists to localStorage.
    expect(localStorage.getItem('sc-report-favourites')).toContain('a');
  });

  it('restores favourites from localStorage on mount', () => {
    localStorage.setItem('sc-report-favourites', JSON.stringify(['b']));
    render(<ReportTiles reportCards={cards} onSelect={vi.fn()} />);
    expect(screen.getByText('FAVOURITES')).toBeInTheDocument();
  });
});
