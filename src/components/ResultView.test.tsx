import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultView } from './ResultView';

describe('ResultView', () => {
  it('offers full-track playback and another round after a loss', () => {
    render(<ResultView outcome="lost" title="Answer Song" artist="Artist" onPlayFullTrack={() => undefined} onPlayAnother={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Play full track' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play another' })).toBeVisible();
    expect(screen.getByText('Answer Song - Artist')).toBeVisible();
  });
});

