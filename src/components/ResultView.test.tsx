import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultView } from './ResultView';

describe('ResultView', () => {
  it('offers full-track playback and another round after a loss', () => {
    render(<ResultView outcome="lost" title="Answer Song" artist="Artist" imageUrl="https://images.test/answer.jpg" onPlayFullTrack={() => undefined} onPlayAnother={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Play full track' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play another' })).toBeVisible();
    expect(screen.getByText('Answer Song - Artist')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Answer Song album cover' })).toHaveAttribute(
      'src',
      'https://images.test/answer.jpg',
    );
  });
  it('keeps the artwork placeholder when the answer has no image', () => {
    const { container } = render(<ResultView outcome="lost" title="Answer Song" artist="Artist" imageUrl={null} onPlayFullTrack={() => undefined} onPlayAnother={() => undefined} />);

    expect(screen.queryByRole('img', { name: 'Answer Song album cover' })).toBeNull();
    expect(container.querySelector('.artwork-placeholder')).not.toBeNull();
  });
});


describe('ResultView callbacks', () => {
  it('clicks full-track and play-another controls', () => {
    let fullTrack = 0;
    let another = 0;
    render(<ResultView outcome="won" title="Answer Song" artist="Artist" imageUrl="https://images.test/answer.jpg" onPlayFullTrack={() => { fullTrack += 1; }} onPlayAnother={() => { another += 1; }} />);
    expect(screen.getByRole('img', { name: 'Answer Song album cover' })).toHaveAttribute(
      'src',
      'https://images.test/answer.jpg',
    );
    screen.getByRole('button', { name: 'Play full track' }).click();
    screen.getByRole('button', { name: 'Play another' }).click();
    expect(fullTrack).toBe(1);
    expect(another).toBe(1);
  });
});

