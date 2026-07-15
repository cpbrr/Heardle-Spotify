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
    expect(css).not.toMatch(/gradient|letter-spacing:\\s*-|\\d+vw/);
  });
});



describe('responsive design contract', () => {
  it('contains all required tokens, constraints, and control sizing', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
    for (const token of ['--bg: #0d0f0e', '--surface: #151816', '--surface-raised: #1b1f1c', '--text: #f4f6f4', '--muted: #9ca39e', '--border: #343a36', '--accent: #1ed760', '--accent-strong: #18b950', '--danger: #e45b5b', '--radius: 8px', '--content: 42rem']) expect(css).toContain(token);
    expect(css).toContain('minmax(0, 1fr)');
    expect(css).toContain('.artwork.artwork-placeholder');
    expect(css).toContain('width: min(100%, 18rem)');
    expect((css.match(/min-height: 44px/g) || []).length).toBeGreaterThan(0);
    expect(css).toContain('prefers-reduced-motion');
  });
});
