import { ArrowLeftToLine } from 'lucide-react';
import { t } from '@lingui/core/macro';
import { CircleLogo, SkyLinkLogo } from '@/modules/icons';
import { cn } from '@/lib/cn';
import type { BridgeRouteKind } from '../model/types';
import type { RouteOptionCard } from './bridgeRouteOptions';

type BridgeRoutePickerProps = {
  cards: RouteOptionCard[];
  selected: BridgeRouteKind;
  onPick: (kind: BridgeRouteKind) => void;
  onBack: () => void;
};

/** "Select bridge type" (Figma 50, 60): one card per route; an unavailable one is greyed with its reason. */
export function BridgeRoutePicker({ cards, selected, onPick, onBack }: BridgeRoutePickerProps) {
  return (
    <div className="flex flex-col gap-6" data-testid="bridge-route-picker">
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
      <ul className="flex flex-col gap-4">
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
                  'flex w-full flex-col gap-4 rounded-2xl border p-[19px] text-left transition-colors',
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
                  <span
                    className={cn(
                      'font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]',
                      card.badge.tone === 'accent' ? 'bg-brand text-white' : 'bg-glassBadge text-fgSecondary'
                    )}
                  >
                    {card.badge.text}
                  </span>
                </span>
                <span className="text-fgSecondary text-xs leading-[18px]">{card.description}</span>
                <span className="flex flex-col">
                  {card.rows.map(row => (
                    <span
                      key={row.label}
                      className="border-borderPrimary flex items-center justify-between border-b py-2 text-xs leading-4 last:border-b-0"
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
