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


