import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import TemplatePickerModal from './TemplatePickerModal';
import { renderWithProviders, screen } from '../../../test/utils';
import type { TemplateBoardItem } from '../../../services/boards';

function tpl(id: string, name: string): TemplateBoardItem {
  return {
    id, sessionName: name,
    teamName: '', teamId: null,
    stickyCount: 0, sectionCount: 3, actionCount: 0,
    participants: [], updatedAt: '', archived: false,
    sections: [],
  };
}

describe('<TemplatePickerModal />', () => {
  it('shows the empty state when there are no templates', () => {
    renderWithProviders(<TemplatePickerModal templates={[]} onClose={() => {}} onPick={() => {}} />);
    expect(screen.getByText(/no templates yet/i)).toBeInTheDocument();
  });

  it('lists the available templates', () => {
    renderWithProviders(<TemplatePickerModal templates={[tpl('a', 'Sprint retro'), tpl('b', 'Cycle review')]} onClose={() => {}} onPick={() => {}} />);
    expect(screen.getByText('Sprint retro')).toBeInTheDocument();
    expect(screen.getByText('Cycle review')).toBeInTheDocument();
  });

  it('calls onPick with the chosen template', async () => {
    const onPick = vi.fn();
    const a = tpl('a', 'Sprint retro');
    renderWithProviders(<TemplatePickerModal templates={[a]} onClose={() => {}} onPick={onPick} />);
    await userEvent.click(screen.getByText('Sprint retro'));
    expect(onPick).toHaveBeenCalledWith(a);
  });

  it('clicks on the overlay closes', async () => {
    const onClose = vi.fn();
    renderWithProviders(<TemplatePickerModal templates={[]} onClose={onClose} onPick={() => {}} />);
    // The overlay is the outermost div; click directly on it.
    const overlay = document.querySelector('.dash-modal-overlay') as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });
});
