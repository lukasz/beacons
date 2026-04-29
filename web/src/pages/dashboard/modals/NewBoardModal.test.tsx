import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import NewBoardModal from './NewBoardModal';
import { renderWithProviders, screen } from '../../../test/utils';
import type { TemplateBoardItem } from '../../../services/boards';

const baseProps = {
  preTemplate: null,
  onClose: vi.fn(),
  onClearPreTemplate: vi.fn(),
  onPickTemplate: vi.fn(),
  onPickFromTemplate: vi.fn(),
  onPickFromLinear: vi.fn(),
  onFreeRange: vi.fn(),
};

const sampleTpl: TemplateBoardItem = {
  id: 'tpl-1',
  sessionName: 'Cycle template',
  teamName: '',
  teamId: null,
  stickyCount: 0,
  sectionCount: 3,
  actionCount: 0,
  participants: [],
  updatedAt: '',
  archived: false,
  sections: [{ title: 'A', colorIdx: 0 }],
};

describe('<NewBoardModal />', () => {
  it('renders the three creation paths by default', () => {
    renderWithProviders(<NewBoardModal {...baseProps} />);
    expect(screen.getByText('From Linear')).toBeInTheDocument();
    expect(screen.getByText('From Template')).toBeInTheDocument();
    expect(screen.getByText('Free Range')).toBeInTheDocument();
  });

  it('replaces "From Template" with "Use Template" when a template is preselected', () => {
    renderWithProviders(<NewBoardModal {...baseProps} preTemplate={sampleTpl} />);
    expect(screen.getByText('Use Template')).toBeInTheDocument();
    expect(screen.queryByText('From Template')).not.toBeInTheDocument();
  });

  it('clicking "Free Range" calls onFreeRange', async () => {
    const onFreeRange = vi.fn();
    renderWithProviders(<NewBoardModal {...baseProps} onFreeRange={onFreeRange} />);
    await userEvent.click(screen.getByText('Free Range'));
    expect(onFreeRange).toHaveBeenCalledOnce();
  });

  it('clicking "Use Template" passes the preselected template to onPickTemplate', async () => {
    const onPickTemplate = vi.fn();
    renderWithProviders(<NewBoardModal {...baseProps} preTemplate={sampleTpl} onPickTemplate={onPickTemplate} />);
    await userEvent.click(screen.getByText('Use Template'));
    expect(onPickTemplate).toHaveBeenCalledWith(sampleTpl);
  });
});
