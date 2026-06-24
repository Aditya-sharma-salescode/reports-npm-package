import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompactCheckboxDropdown } from '../src/components/CompactCheckboxDropdown';

const options = [
  { label: 'North', value: 'N' },
  { label: 'South', value: 'S' },
  { label: 'East', value: 'E' },
];

function renderDropdown(props: Partial<React.ComponentProps<typeof CompactCheckboxDropdown>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <CompactCheckboxDropdown
      label="Region"
      options={options}
      selected={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...utils };
}

describe('CompactCheckboxDropdown', () => {
  it('renders the label and is closed by default', () => {
    renderDropdown();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('opens the portal on click and lists all options', async () => {
    renderDropdown();
    await userEvent.click(screen.getByText('Region'));
    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.getByText('South')).toBeInTheDocument();
    expect(screen.getByText('East')).toBeInTheDocument();
  });

  it('calls onOpen when opened and onClose when toggled shut', async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    renderDropdown({ onOpen, onClose });
    const trigger = screen.getByText('Region');
    await userEvent.click(trigger);
    expect(onOpen).toHaveBeenCalled();
    await userEvent.click(trigger);
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles a value on (multi-select) via onChange', async () => {
    const { onChange } = renderDropdown();
    await userEvent.click(screen.getByText('Region'));
    await userEvent.click(screen.getByText('North'));
    expect(onChange).toHaveBeenCalledWith(['N']);
  });

  it('toggles a value off when already selected', async () => {
    const { onChange } = renderDropdown({ selected: ['N'] });
    await userEvent.click(screen.getByText('Region'));
    await userEvent.click(screen.getByText('North'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('respects maxSelected (ignores additions beyond the cap)', async () => {
    const { onChange } = renderDropdown({ selected: ['N'], maxSelected: 1 });
    await userEvent.click(screen.getByText('Region'));
    await userEvent.click(screen.getByText('South'));
    // Adding beyond the cap returns the unchanged selection.
    expect(onChange).toHaveBeenCalledWith(['N']);
  });

  it('shows a count summary when items are selected', () => {
    renderDropdown({ selected: ['N', 'S'] });
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('in single-select mode, selecting replaces the selection', async () => {
    const { onChange } = renderDropdown({ multiSelect: false, selected: ['N'] });
    await userEvent.click(screen.getByText('Region'));
    await userEvent.click(screen.getByText('South'));
    expect(onChange).toHaveBeenCalledWith(['S']);
  });

  it('single-select displays the chosen option label', () => {
    renderDropdown({ multiSelect: false, selected: ['S'] });
    expect(screen.getByText('South')).toBeInTheDocument();
  });

  it('filters options by the search box (internal state)', async () => {
    renderDropdown();
    await userEvent.click(screen.getByText('Region'));
    await userEvent.type(screen.getByPlaceholderText('Search...'), 'sou');
    expect(screen.getByText('South')).toBeInTheDocument();
    expect(screen.queryByText('North')).not.toBeInTheDocument();
  });

  it('shows "No options found" when the search matches nothing', async () => {
    renderDropdown();
    await userEvent.click(screen.getByText('Region'));
    await userEvent.type(screen.getByPlaceholderText('Search...'), 'zzz');
    expect(screen.getByText('No options found')).toBeInTheDocument();
  });

  it('hides the search box when searchable is false', async () => {
    renderDropdown({ searchable: false });
    await userEvent.click(screen.getByText('Region'));
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('does not open when disabled', async () => {
    const onOpen = vi.fn();
    renderDropdown({ disabled: true, onOpen });
    await userEvent.click(screen.getByText('Region'));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByText('North')).not.toBeInTheDocument();
  });

  it('renders a loading spinner instead of options when loading', async () => {
    const { container } = renderDropdown({ loading: true });
    await userEvent.click(screen.getByText('Region'));
    expect(document.querySelector('.compact-dropdown-spinner')).toBeTruthy();
    void container;
  });

  it('select-all selects every option when none are selected', async () => {
    const { onChange } = renderDropdown({ selectAllLabel: 'Select All' });
    await userEvent.click(screen.getByText('Region'));
    await userEvent.click(screen.getByText('Select All'));
    expect(onChange).toHaveBeenCalledWith(['N', 'S', 'E']);
  });

  it('select-all clears the selection when all are already selected', async () => {
    const { onChange } = renderDropdown({ selectAllLabel: 'Select All', selected: ['N', 'S', 'E'] });
    await userEvent.click(screen.getByText('Region'));
    await userEvent.click(screen.getByText('Select All'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('closes on an outside click', async () => {
    renderDropdown();
    await userEvent.click(screen.getByText('Region'));
    expect(screen.getByText('North')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('North')).not.toBeInTheDocument();
  });

  it('supports controlled search via searchText/onSearchChange', async () => {
    const onSearchChange = vi.fn();
    renderDropdown({ searchText: 'eas', onSearchChange });
    await userEvent.click(screen.getByText('Region'));
    // Controlled search value filters to East only.
    const portal = document.querySelector('.compact-dropdown-options') as HTMLElement;
    expect(within(portal).getByText('East')).toBeInTheDocument();
    expect(within(portal).queryByText('North')).not.toBeInTheDocument();
  });
});
