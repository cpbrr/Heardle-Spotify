import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GameScreen } from './GameScreen';
import { SourcePicker } from './SourcePicker';

describe('responsive listening studio structure', () => {
  it('keeps one main and seven stable attempt rows', () => {
    render(<GameScreen />);
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('exposes dialog semantics and labelled icon controls', () => {
    render(<SourcePicker onSelect={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close source picker' })).toBeVisible();
  });
});

import fs from 'node:fs';
import path from 'node:path';

describe('responsive style constraints', () => {
  it('contains exact tokens and mobile-safe accessibility rules', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
    expect(css).toContain('--bg: #0d0f0e');
    expect(css).toContain('--content: 42rem');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).not.toMatch(/gradient|letter-spacing:\s*-|\\d+vw/);
  });
});



describe('responsive design contract', () => {
  it('contains all required tokens, constraints, and control sizing', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
    for (const token of ['--bg: #0d0f0e', '--surface: #12150f', '--surface-inset: #171c17', '--text: #f4f6f2', '--muted: #9aa39c', '--border: #232923', '--accent: #ffffff', '--danger: #ff7a6e', '--radius-md: 14px', '--content: 42rem']) expect(css).toContain(token);
    expect(css).toContain('min-width: 0');
    expect(css).toContain('.artwork.artwork-placeholder');
    expect(css).toContain('width: min(100%, 18rem)');
    expect((css.match(/min-height: 44px/g) || []).length).toBeGreaterThan(0);
    expect(css).toContain('prefers-reduced-motion');
  });
});


