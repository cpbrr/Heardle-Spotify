import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GameScreen } from './GameScreen';
import { SourcePicker } from './SourcePicker';

describe('responsive listening studio structure', () => {
  it('keeps one main and six stable attempt rows', () => {
    render(<GameScreen />);
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('exposes dialog semantics and labelled icon controls', () => {
    render(<SourcePicker onSelect={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close source picker' })).toBeVisible();
  });
});
