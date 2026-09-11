import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExternalLink } from './ExternalLink';

describe('ExternalLink', () => {
  // The link is used inside <p> copy; element children used to be wrapped in
  // a div, which is invalid inside a paragraph (APP-563 #7).
  it('wraps element children in an inline element, never a div', () => {
    render(
      <p>
        <ExternalLink href="https://example.com">
          <span>Learn more</span>
        </ExternalLink>
      </p>
    );
    const link = screen.getByRole('link');
    expect(link.querySelector('div')).toBeNull();
    expect(link.firstElementChild?.tagName).toBe('SPAN');
    expect(link.closest('p')?.querySelector('div')).toBeNull();
  });

  it('renders string children bare', () => {
    render(<ExternalLink href="https://example.com">Docs</ExternalLink>);
    const link = screen.getByRole('link', { name: /Docs/ });
    expect(link.firstElementChild?.tagName).toBe('svg');
  });
});
