import type { ReactNode } from 'react';
import { ArrowLeftToLine } from 'lucide-react';
import { t } from '@lingui/core/macro';
import { CircleLogo, LightningFilled, SkyLinkLogo } from '@/modules/icons';
import { cn } from '@/lib/cn';
import type { BridgeRouteKind } from '../model/types';
import type { RouteOptionCard } from './bridgeRouteOptions';

type BridgeRoutePickerProps = {
  cards: RouteOptionCard[];
  selected: BridgeRouteKind;
  onPick: (kind: BridgeRouteKind) => void;
  onBack: () => void;
};

const BADGE =
  'font-circle flex h-[18px] shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]';

/** Brand-tinted pill with a bolt, for the faster route (Figma 3964:74437 Badge). */
export function BridgeFastBadge({
  children,
  testId = 'bridge-route-badge'
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <span className={cn(BADGE, 'bg-statusBrandBg text-statusBrand')} data-testid={testId}>
      <LightningFilled boxSize={8} className="size-2 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** "Select bridge type" (Figma 50, 60): one card per route; an unavailable one is greyed with its reason. */
export function BridgeRoutePicker({ cards, selected, onPick, onBack }: BridgeRoutePickerProps) {
  return (
    <div className="flex flex-col gap-5" data-testid="bridge-route-picker">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t`Back to the review`}
          className="border-borderPrimary text-fgPrimary flex size-10 shrink-0 items-center justify-center rounded-full border"
          data-testid="bridge-route-picker-back"
        >
          <ArrowLeftToLine size={16} aria-hidden />
        </button>
        <h3 className="text-text font-circle text-lg leading-6 font-medium">{t`Select bridge type`}</h3>
      </div>
      <ul className="flex flex-col gap-3">
        {cards.map(card => {
          const isSelected = card.kind === selected;
          return (
            <li key={card.kind}>
              <button
                type="button"
                disabled={card.unavailable}
                aria-pressed={isSelected}
                onClick={() => onPick(card.kind)}
                className={cn(
                  'flex w-full flex-col gap-3 rounded-2xl border p-[19px] text-left transition-colors',
                  isSelected
                    ? 'border-brandBorder from-brand3-start to-brand3-end bg-linear-to-b'
                    : 'border-borderPrimary bg-transparent',
                  card.unavailable && 'cursor-not-allowed opacity-50'
                )}
                data-testid={`bridge-route-option-${card.kind}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-text font-circle flex items-center gap-2 text-base leading-5 font-medium">
                    {card.logo === 'cctp' && (
                      <CircleLogo boxSize={16} className="size-4 shrink-0" aria-hidden />
                    )}
                    {card.logo === 'skylink' && (
                      <SkyLinkLogo boxSize={16} className="text-fgPrimary size-4 shrink-0" aria-hidden />
                    )}
                    {card.name}
                  </span>
                  {card.badge.tone === 'accent' ? (
                    <BridgeFastBadge>{card.badge.text}</BridgeFastBadge>
                  ) : (
                    <span
                      className={cn(BADGE, 'bg-glassBadge text-fgSecondary')}
                      data-testid="bridge-route-badge"
                    >
                      {card.badge.text}
                    </span>
                  )}
                </span>
                <span className="text-fgSecondary text-[11px] leading-4">{card.description}</span>
                <span className="flex flex-col">
                  {card.rows.map(row => (
                    <span
                      key={row.label}
                      className="border-borderPrimary flex items-center justify-between border-b py-1.5 text-xs leading-4 last:border-b-0 last:pb-0"
                    >
                      <span className="text-fgSecondary">{row.label}</span>
                      <span className="text-text font-medium">{row.value}</span>
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
