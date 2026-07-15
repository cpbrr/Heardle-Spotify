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


describe('ResultView callbacks', () => {
  it('clicks full-track and play-another controls', () => {
    let fullTrack = 0;
    let another = 0;
    render(<ResultView outcome="won" title="Answer Song" artist="Artist" onPlayFullTrack={() => { fullTrack += 1; }} onPlayAnother={() => { another += 1; }} />);
    screen.getByRole('button', { name: 'Play full track' }).click();
    screen.getByRole('button', { name: 'Play another' }).click();
    expect(fullTrack).toBe(1);
    expect(another).toBe(1);
  });
});

