import { render, cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icon } from '@/modules/icons/Icon';

// Radix's AvatarImage only mounts the <img> once it has loaded, which never
// happens in happy-dom — render plain elements so the attributes are visible.
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: () => null
}));
vi.mock('@/modules/ui/hooks/useTokenImage', () => ({ useTokenImage: () => '/tokens/usds.svg' }));
vi.mock('@/modules/ui/hooks/useChainImage', () => ({ useChainImage: () => '/networks/ethereum.svg' }));

import { TokenIcon } from './TokenIcon';
import { TokenIconStack } from './TokenIconStack';

const imgs = (container: HTMLElement) => Array.from(container.querySelectorAll('img'));

describe('TokenIcon alt text (APP-578)', () => {
  afterEach(cleanup);

  it('is decorative by default, even when the token has a name', () => {
    const { container } = render(
      <TokenIcon token={{ symbol: 'USDS', name: 'USDS Stablecoin' }} chainId={1} />
    );

    // Token icon and chain badge both carry an empty alt.
    expect(imgs(container)).toHaveLength(2);
    imgs(container).forEach(img => expect(img.getAttribute('alt')).toBe(''));
  });

  it('uses the alt passed for a standalone icon', () => {
    const { container } = render(<TokenIcon token={{ symbol: 'USDS' }} alt="USDS" showChainIcon={false} />);

    expect(imgs(container)[0].getAttribute('alt')).toBe('USDS');
  });

  it('names each icon of a labelled stack by its symbol', () => {
    const { container } = render(<TokenIconStack symbols={['USDS', 'USDC']} labelled />);

    expect(imgs(container).map(img => img.getAttribute('alt'))).toEqual(['USDS', 'USDC']);
  });

  it('keeps an unlabelled stack decorative', () => {
    const { container } = render(<TokenIconStack symbols={['USDS', 'USDC']} />);

    expect(imgs(container).map(img => img.getAttribute('alt'))).toEqual(['', '']);
  });
});

describe('Icon aria-hidden default (APP-578)', () => {
  afterEach(cleanup);

  it('hides an unlabelled icon from assistive tech', () => {
    render(<Icon data-testid="icon" />);
    expect(screen.getByTestId('icon').getAttribute('aria-hidden')).toBe('true');
  });

  it('exposes an icon that carries an aria-label', () => {
    render(<Icon data-testid="icon" aria-label="Warning" />);
    expect(screen.getByTestId('icon').hasAttribute('aria-hidden')).toBe(false);
  });

  it('lets a caller opt out explicitly', () => {
    render(<Icon data-testid="icon" aria-hidden={false} />);
    expect(screen.getByTestId('icon').getAttribute('aria-hidden')).toBe('false');
  });
});
