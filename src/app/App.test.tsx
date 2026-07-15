import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the product identity while startup state is checked', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Heardle' })).toBeVisible();
    expect(screen.getByText('Checking Spotify connection...')).toBeVisible();
  });
});
