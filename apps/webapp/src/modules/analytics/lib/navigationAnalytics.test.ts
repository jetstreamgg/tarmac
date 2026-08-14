import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNavigationSubscriber,
  pathnameToPreviousWidget,
  pathnameToWidgetName,
  type NavigationSubscriberDeps
} from './navigationAnalytics';
import { consumePendingNavIntent, setPendingNavIntent } from './navigationIntent';

const push = (pathname: string) => ({ location: { pathname }, action: { type: 'PUSH' as const } });
const replace = (pathname: string) => ({ location: { pathname }, action: { type: 'REPLACE' as const } });
const back = (pathname: string) => ({ location: { pathname }, action: { type: 'BACK' as const } });

function makeDeps() {
  const calls: string[] = [];
  const deps: NavigationSubscriberDeps = {
    startNewFlow: vi.fn(() => void calls.push('rotate')),
    trackWidgetSelected: vi.fn(() => void calls.push('emit')),
    getChainId: () => 1
  };
  return { deps, calls };
}

describe('pathnameToWidgetName', () => {
  it('maps product routes to their widget_name', () => {
    expect(pathnameToWidgetName('/earn/savings')).toBe('savings');
    expect(pathnameToWidgetName('/earn/rewards/0x123')).toBe('rewards');
    expect(pathnameToWidgetName('/earn/vaults/morpho/0xabc')).toBe('vaults');
    expect(pathnameToWidgetName('/earn/fixed/some-market')).toBe('fixed');
    expect(pathnameToWidgetName('/earn/stusds')).toBe('stusds');
    expect(pathnameToWidgetName('/stake')).toBe('stake');
    expect(pathnameToWidgetName('/convert')).toBe('convert');
  });

  it('returns null for containers and off-map routes (D5)', () => {
    expect(pathnameToWidgetName('/portfolio')).toBeNull();
    expect(pathnameToWidgetName('/earn')).toBeNull();
    expect(pathnameToWidgetName('/')).toBeNull();
    expect(pathnameToWidgetName('/seal-engine')).toBeNull();
  });
});

describe('pathnameToPreviousWidget', () => {
  it('labels the earn marketplace and containers', () => {
    expect(pathnameToPreviousWidget('/earn')).toBe('earn_marketplace');
    expect(pathnameToPreviousWidget('/portfolio')).toBe('balances');
    expect(pathnameToPreviousWidget('/')).toBe('balances');
  });

  it('labels product routes by widget name', () => {
    expect(pathnameToPreviousWidget('/earn/savings')).toBe('savings');
    expect(pathnameToPreviousWidget('/stake')).toBe('stake');
  });
});

describe('createNavigationSubscriber', () => {
  beforeEach(() => {
    consumePendingNavIntent();
  });

  it('emits on a push to a product route, rotating the flow first', () => {
    const { deps, calls } = makeDeps();
    const subscriber = createNavigationSubscriber('/portfolio', deps);

    subscriber(push('/earn/savings'));

    expect(calls).toEqual(['rotate', 'emit']);
    expect(deps.trackWidgetSelected).toHaveBeenCalledWith({
      widgetName: 'savings',
      previousWidget: 'balances',
      selectionMethod: 'link',
      chainId: 1
    });
  });

  it('rotates but does not emit on container navigation (D5)', () => {
    const { deps } = makeDeps();
    const subscriber = createNavigationSubscriber('/earn/savings', deps);

    subscriber(push('/earn'));

    expect(deps.startNewFlow).toHaveBeenCalledOnce();
    expect(deps.trackWidgetSelected).not.toHaveBeenCalled();
  });

  it('ignores replaces and traversals but keeps previous_widget current', () => {
    const { deps } = makeDeps();
    const subscriber = createNavigationSubscriber('/stake', deps);

    subscriber(replace('/portfolio'));
    subscriber(back('/earn'));
    expect(deps.startNewFlow).not.toHaveBeenCalled();
    expect(deps.trackWidgetSelected).not.toHaveBeenCalled();

    subscriber(push('/convert'));
    expect(deps.trackWidgetSelected).toHaveBeenCalledWith(
      expect.objectContaining({ previousWidget: 'earn_marketplace' })
    );
  });

  it('ignores pushes that only change search (same pathname)', () => {
    const { deps } = makeDeps();
    const subscriber = createNavigationSubscriber('/earn/savings', deps);

    subscriber(push('/earn/savings'));

    expect(deps.startNewFlow).not.toHaveBeenCalled();
    expect(deps.trackWidgetSelected).not.toHaveBeenCalled();
  });

  it('honors a pending nav intent whose pathname matches', () => {
    const { deps } = makeDeps();
    const subscriber = createNavigationSubscriber('/portfolio', deps);

    setPendingNavIntent('card', '/earn/savings');
    subscriber(push('/earn/savings'));

    expect(deps.trackWidgetSelected).toHaveBeenCalledWith(
      expect.objectContaining({ selectionMethod: 'card' })
    );
  });

  it('falls back to link when the pending intent targets another pathname', () => {
    const { deps } = makeDeps();
    const subscriber = createNavigationSubscriber('/portfolio', deps);

    setPendingNavIntent('header_nav', '/stake');
    subscriber(push('/convert'));

    expect(deps.trackWidgetSelected).toHaveBeenCalledWith(
      expect.objectContaining({ selectionMethod: 'link' })
    );
  });

  it('consumes the pending intent even on non-emitting events', () => {
    const { deps } = makeDeps();
    const subscriber = createNavigationSubscriber('/portfolio', deps);

    setPendingNavIntent('header_nav', '/earn');
    subscriber(push('/earn'));
    subscriber(push('/stake'));

    expect(deps.trackWidgetSelected).toHaveBeenCalledWith(
      expect.objectContaining({ selectionMethod: 'link', widgetName: 'stake' })
    );
  });
});
