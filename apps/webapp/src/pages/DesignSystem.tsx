import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpToLine,
  ChevronDown,
  Copy,
  LineChart,
  Settings2,
  Star,
  Wallet
} from 'lucide-react';

import { applyTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CellAction,
  CellAmount,
  CellAmountWithToken,
  CellBadge,
  CellChevron,
  CellEmpty,
  CellHash,
  CellNetworks,
  CellPercent,
  CellPosition,
  CellProduct,
  CellStatus,
  CellToken,
  CellTokenIdle
} from '@/components/ui/table-cells';
import { RiskMeter, RiskTierMeter } from '@/components/product/RiskMeter';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { BaseChain, MainnetChain, OptimismChain, Pendle, Stake } from '@/modules/icons';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { Toaster } from '@/components/ui/sonner';
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import { GainValue } from '@/components/ui/GainValue';
import { SlippageMenu } from '@/components/ui/SlippageMenu';

// Internal-only living style guide (route /design-system, hidden in production).
// Shows every canonical components/ui primitive in its prop-reachable states;
// pointer states (hover/pressed/focus) are exercised live on the specimens.
// Purely presentational — no primitive is modified here.

const SECTIONS = [
  { id: 'colors', title: 'Color tokens' },
  { id: 'typography', title: 'Typography' },
  { id: 'buttons', title: 'Buttons' },
  { id: 'tabs', title: 'Tabs' },
  { id: 'form-controls', title: 'Form controls' },
  { id: 'select', title: 'Select' },
  { id: 'cards', title: 'Cards' },
  { id: 'overlays', title: 'Overlays' },
  { id: 'tables', title: 'Tables' },
  { id: 'data', title: 'Data & misc' }
];

function Section({
  id,
  title,
  note,
  children
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Heading tag="h2" variant="large" className="mb-1">
        {title}
      </Heading>
      {note && <p className="text-fgSecondary mb-4 max-w-3xl text-sm">{note}</p>}
      <div className="mt-4 space-y-8">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-fgSecondary font-circle mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/** A specimen with a small caption underneath. */
function Spec({
  label,
  children,
  className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <div className="flex min-h-10 w-full items-center">{children}</div>
      <span className="text-fgSecondary text-xs">{label}</span>
    </div>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-end gap-x-8 gap-y-6', className)}>{children}</div>;
}

// ─── Colors ───────────────────────────────────────────────────────────────────
// Class names must appear literally so Tailwind compiles (and therefore emits)
// each token — unconsumed @theme tokens are tree-shaken at runtime.

const TOKEN_GROUPS: { group: string; tokens: { name: string; cls: string }[] }[] = [
  {
    group: 'Brand',
    tokens: [
      { name: 'brand', cls: 'bg-brand' },
      { name: 'brandHover', cls: 'bg-brandHover' },
      { name: 'brandPressed', cls: 'bg-brandPressed' },
      { name: 'brandQuaternary', cls: 'bg-brandQuaternary' },
      { name: 'brandLight', cls: 'bg-brandLight' },
      { name: 'brandMiddle', cls: 'bg-brandMiddle' },
      { name: 'brandDark', cls: 'bg-brandDark' },
      { name: 'fgBrand', cls: 'bg-fgBrand' }
    ]
  },
  {
    group: 'Foreground / text',
    tokens: [
      { name: 'text', cls: 'bg-text' },
      { name: 'textSecondary', cls: 'bg-textSecondary' },
      { name: 'fgConsistent', cls: 'bg-fgConsistent' },
      { name: 'fgSecondary', cls: 'bg-fgSecondary' },
      { name: 'fgTertiary', cls: 'bg-fgTertiary' },
      { name: 'fgQuaternary', cls: 'bg-fgQuaternary' },
      { name: 'textMuted', cls: 'bg-textMuted' },
      { name: 'textEmphasis', cls: 'bg-textEmphasis' }
    ]
  },
  {
    group: 'Surfaces / glass',
    tokens: [
      { name: 'pageBackground', cls: 'bg-pageBackground' },
      { name: 'glassSurface', cls: 'bg-glassSurface' },
      { name: 'glassBadge', cls: 'bg-glassBadge' },
      { name: 'glassBorder', cls: 'bg-glassBorder' },
      { name: 'surface', cls: 'bg-surface' },
      { name: 'surfaceAlt', cls: 'bg-surfaceAlt' },
      { name: 'panel', cls: 'bg-panel' },
      { name: 'card', cls: 'bg-card' }
    ]
  },
  {
    group: 'Borders / focus',
    tokens: [
      { name: 'border', cls: 'bg-border' },
      { name: 'borderTertiary', cls: 'bg-borderTertiary' },
      { name: 'borderBrandDim', cls: 'bg-borderBrandDim' },
      { name: 'borderBrandDimTertiary', cls: 'bg-borderBrandDimTertiary' },
      { name: 'borderQuarternary', cls: 'bg-borderQuarternary' },
      { name: 'focusRing', cls: 'bg-focusRing' }
    ]
  },
  {
    group: 'Slider palette (H7)',
    tokens: [
      { name: 'slider-brand-start', cls: 'bg-slider-brand-start' },
      { name: 'slider-brand-end', cls: 'bg-slider-brand-end' },
      { name: 'slider-yellow-start', cls: 'bg-slider-yellow-start' },
      { name: 'slider-yellow-end', cls: 'bg-slider-yellow-end' },
      { name: 'sliderAmber', cls: 'bg-sliderAmber' },
      { name: 'sliderMarker', cls: 'bg-sliderMarker' },
      { name: 'sliderLine', cls: 'bg-sliderLine' },
      { name: 'sliderDot', cls: 'bg-sliderDot' }
    ]
  },
  {
    group: 'Status',
    tokens: [
      { name: 'bullish', cls: 'bg-bullish' },
      { name: 'error', cls: 'bg-error' }
    ]
  }
];

function ColorsSection() {
  return (
    <Section
      id="colors"
      title="Color tokens"
      note="Semantic --color-* tokens from globals.css. Dark is the at-parity palette; light values are interim until G2 (light parity). Checkerboard shows through translucent tokens."
    >
      {TOKEN_GROUPS.map(({ group, tokens }) => (
        <SubSection key={group} title={group}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {tokens.map(({ name, cls }) => (
              <div key={name} className="flex flex-col gap-1.5">
                <div className="border-glassBorder relative h-14 overflow-hidden rounded-lg border">
                  <div className="absolute inset-0 bg-[repeating-conic-gradient(#80808033_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]" />
                  <div className={cn('absolute inset-0', cls)} />
                </div>
                <span className="text-fgSecondary truncate text-xs" title={name}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </SubSection>
      ))}
    </Section>
  );
}

// ─── Typography ───────────────────────────────────────────────────────────────

function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      note="Heading and Text from modules/layout/components/Typography."
    >
      <SubSection title="Heading">
        <div className="space-y-3">
          {(['x-large', 'large', 'medium', 'small', 'extraSmall'] as const).map(v => (
            <div key={v} className="flex items-baseline gap-4">
              <Heading variant={v}>Sky Protocol heading</Heading>
              <span className="text-fgSecondary text-xs">{v}</span>
            </div>
          ))}
        </div>
      </SubSection>
      <SubSection title="Text">
        <div className="space-y-3">
          {(['large', 'medium', 'small', 'captionLg', 'captionSm', 'terms'] as const).map(v => (
            <div key={v} className="flex items-baseline gap-4">
              <Text variant={v}>The quick brown fox jumps over the lazy dog — 0123456789</Text>
              <span className="text-fgSecondary text-xs">{v}</span>
            </div>
          ))}
        </div>
      </SubSection>
    </Section>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

const DS_SIZES = ['xl', 'l', 'm', 's'] as const;
const ICON_SIZES = ['iconXl', 'iconL', 'iconM', 'iconS'] as const;

function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      note="Design-system recipes (H4/H5/H6). Hover and pressed are live — interact with the specimens."
    >
      {(['primary', 'secondary'] as const).map(variant => (
        <SubSection key={variant} title={`${variant} — XL / L / M / S, loading, disabled, icons`}>
          <Row>
            {DS_SIZES.map(size => (
              <Spec key={size} label={size}>
                <Button variant={variant} size={size}>
                  Button
                </Button>
              </Spec>
            ))}
            <Spec label="loading">
              <Button variant={variant} size="m" loading>
                Loading
              </Button>
            </Spec>
            <Spec label="disabled">
              <Button variant={variant} size="m" disabled>
                Disabled
              </Button>
            </Spec>
            <Spec label="leading icon">
              <Button variant={variant} size="m">
                <Wallet />
                Connect
              </Button>
            </Spec>
            <Spec label="trailing icon">
              <Button variant={variant} size="m">
                Continue
                <ArrowRight />
              </Button>
            </Spec>
          </Row>
        </SubSection>
      ))}

      <SubSection title="Icon buttons — iconXl / iconL / iconM / iconS">
        <Row>
          {ICON_SIZES.map(size => (
            <Spec key={size} label={size}>
              <span className="flex gap-3">
                <Button variant="primary" size={size}>
                  <Settings2 />
                </Button>
                <Button variant="secondary" size={size}>
                  <Settings2 />
                </Button>
              </span>
            </Spec>
          ))}
          <Spec label="disabled">
            <Button variant="primary" size="iconM" disabled>
              <Settings2 />
            </Button>
          </Spec>
        </Row>
      </SubSection>

      <SubSection title="Navbar / dropdown / mini (H6)">
        <Row>
          <Spec label="navbar">
            <Button variant="navbar" size="navbar">
              Portfolio
            </Button>
          </Spec>
          <Spec label="navbar current page">
            <Button variant="navbar" size="navbar" aria-current="page">
              Portfolio
            </Button>
          </Spec>
          <Spec label="dropdown">
            <Button variant="dropdown" size="dropdownS">
              Ethereum
              <ChevronDown className="size-4" />
            </Button>
          </Spec>
          <Spec label="dropdown open (forced)">
            <Button variant="dropdown" size="dropdownS" data-state="open">
              Ethereum
              <ChevronDown className="size-4" />
            </Button>
          </Spec>
          <Spec label="mini">
            <Button variant="mini" size="mini">
              <Copy className="size-3.5" />
              Copy
            </Button>
          </Spec>
        </Row>
      </SubSection>

      <SubSection title="Legacy variants (pre-DS, still consumed)">
        <Row>
          <Spec label="default">
            <Button>Button</Button>
          </Spec>
          <Spec label="chip">
            <Button variant="chip" size="xs">
              25%
            </Button>
          </Spec>
          <Spec label="pill">
            <Button variant="pill">Pill</Button>
          </Spec>
          <Spec label="link">
            <Button variant="link">Link</Button>
          </Spec>
          <Spec label="ghost">
            <Button variant="ghost">Ghost</Button>
          </Spec>
          <Spec label="outline">
            <Button variant="outline">Outline</Button>
          </Spec>
          <Spec label="connect">
            <Button variant="connect">Connect</Button>
          </Spec>
          <Spec label="connectPrimary">
            <Button variant="connectPrimary">Connect</Button>
          </Spec>
          <Spec label="primaryAlt">
            <Button variant="primaryAlt">Primary alt</Button>
          </Spec>
          <Spec label="input">
            <Button variant="input">Input</Button>
          </Spec>
          <Spec label="suggest">
            <Button variant="suggest">Suggest</Button>
          </Spec>
          <Spec label="light">
            <Button variant="light">Light</Button>
          </Spec>
        </Row>
      </SubSection>
    </Section>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function TabsSection() {
  return (
    <Section id="tabs" title="Tabs" note="The three design-system families (H6). All interactive.">
      <Row>
        <Spec label="pills">
          <Tabs defaultValue="a">
            <TabsList variant="pills">
              <TabsTrigger variant="pill" value="a">
                Overview
              </TabsTrigger>
              <TabsTrigger variant="pill" value="b">
                Positions
              </TabsTrigger>
              <TabsTrigger variant="pill" value="c">
                Activity
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Spec>
        <Spec label="segmented">
          <Tabs defaultValue="a">
            <TabsList variant="segmented">
              <TabsTrigger variant="segmented" value="a">
                1D
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="b">
                1W
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="c">
                1M
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="d">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Spec>
        <Spec label="nav">
          <Tabs defaultValue="a">
            <TabsList variant="nav">
              <TabsTrigger variant="nav" value="a">
                Earn
              </TabsTrigger>
              <TabsTrigger variant="nav" value="b">
                Stake
              </TabsTrigger>
              <TabsTrigger variant="nav" value="c">
                Convert
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Spec>
        <Spec label="default (legacy)" className="w-80">
          <Tabs defaultValue="a" className="w-full">
            <TabsList className="flex">
              <TabsTrigger value="a" position="left">
                Deposit
              </TabsTrigger>
              <TabsTrigger value="b" position="right">
                Withdraw
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Spec>
        <Spec label="icons (legacy)">
          <Tabs defaultValue="a">
            <TabsList variant="pills">
              <TabsTrigger variant="icons" value="a">
                <LineChart className="size-5" />
                Chart
              </TabsTrigger>
              <TabsTrigger variant="icons" value="b">
                <Settings2 className="size-5" />
                Config
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Spec>
      </Row>
    </Section>
  );
}

// ─── Form controls ────────────────────────────────────────────────────────────

function SlidersDemo() {
  const [standard, setStandard] = useState([40]);
  const [range, setRange] = useState([65]);
  return (
    <>
      <SubSection title="Slider — Standard (H7)">
        <div className="max-w-xl space-y-6">
          <div className="space-y-3">
            <Slider value={standard} onValueChange={setStandard} max={100} step={1} />
            <div className="text-fgSecondary flex items-center gap-4 text-xs">
              <span>0%</span>
              <SliderTicks progress={standard[0]} className="grow" />
              <span>100%</span>
            </div>
            <span className="text-fgSecondary text-xs">interactive · ticks follow the value</span>
          </div>
          <Spec label="disabled" className="w-full">
            <Slider defaultValue={[30]} max={100} disabled className="w-full" />
          </Spec>
        </div>
      </SubSection>

      <SubSection title="Slider — Range (H7)">
        <div className="max-w-xl space-y-6">
          <div className="space-y-3">
            <Slider variant="range" value={range} onValueChange={setRange} max={100} step={1} />
            <div className="text-fgSecondary flex items-center gap-4 text-xs">
              <span>Min</span>
              <SliderTicks variant="range" progress={range[0]} className="grow" />
              <span>Max</span>
            </div>
            <span className="text-fgSecondary text-xs">interactive · min/max markers, amber thumb</span>
          </div>
          <Spec label="empty (value at min — grey thumb)" className="w-full">
            <Slider variant="range" value={[0]} max={100} className="w-full" />
          </Spec>
          <Spec label="disabled" className="w-full">
            <Slider variant="range" defaultValue={[50]} max={100} disabled className="w-full" />
          </Spec>
        </div>
      </SubSection>
    </>
  );
}

function FormControlsSection() {
  return (
    <Section id="form-controls" title="Form controls" note="H7 — Slider, Switch, Checkbox, Radio.">
      <SlidersDemo />

      <SubSection title="Switch — M and S">
        <Row>
          <Spec label="M off / on (interactive)">
            <span className="flex items-center gap-3">
              <Switch />
              <Switch defaultChecked />
            </span>
          </Spec>
          <Spec label="M disabled off / on">
            <span className="flex items-center gap-3">
              <Switch disabled />
              <Switch disabled checked />
            </span>
          </Spec>
          <Spec label="S off / on (interactive)">
            <span className="flex items-center gap-3">
              <Switch size="sm" />
              <Switch size="sm" defaultChecked />
            </span>
          </Spec>
          <Spec label="S disabled off / on">
            <span className="flex items-center gap-3">
              <Switch size="sm" disabled />
              <Switch size="sm" disabled checked />
            </span>
          </Spec>
        </Row>
      </SubSection>

      <SubSection title="Checkbox">
        <Row>
          <Spec label="unchecked / checked (interactive)">
            <span className="flex items-center gap-3">
              <Checkbox />
              <Checkbox defaultChecked />
            </span>
          </Spec>
          <Spec label="indeterminate">
            <Checkbox checked="indeterminate" />
          </Spec>
          <Spec label="disabled — unchecked / checked / indeterminate">
            <span className="flex items-center gap-3">
              <Checkbox disabled />
              <Checkbox disabled checked />
              <Checkbox disabled checked="indeterminate" />
            </span>
          </Spec>
          <Spec label="with label">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox defaultChecked />I agree to the terms
            </label>
          </Spec>
        </Row>
      </SubSection>

      <SubSection title="Radio">
        <Row>
          <Spec label="interactive group">
            <RadioGroup defaultValue="b" className="flex gap-6">
              {['a', 'b', 'c'].map(v => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={v} />
                  Option {v.toUpperCase()}
                </label>
              ))}
            </RadioGroup>
          </Spec>
          <Spec label="disabled — unchecked / checked">
            <RadioGroup value="b" disabled className="flex gap-6">
              <RadioGroupItem value="a" />
              <RadioGroupItem value="b" />
            </RadioGroup>
          </Spec>
        </Row>
      </SubSection>

      <SubSection title="Toggle (legacy)">
        <Row>
          <Spec label="off / pressed (interactive)">
            <span className="flex items-center gap-3">
              <Toggle size="sm" aria-label="toggle">
                <Star className="size-4" />
              </Toggle>
              <Toggle size="sm" defaultPressed aria-label="toggle">
                <Star className="size-4" />
              </Toggle>
            </span>
          </Spec>
          <Spec label="singleSwitcher">
            <span className="flex items-center gap-1">
              <Toggle variant="singleSwitcher" pressed>
                1D
              </Toggle>
              <Toggle variant="singleSwitcher">1W</Toggle>
            </span>
          </Spec>
          <Spec label="singleSwitcherBright">
            <span className="flex items-center gap-1">
              <Toggle variant="singleSwitcherBright" pressed>
                1D
              </Toggle>
              <Toggle variant="singleSwitcherBright">1W</Toggle>
            </span>
          </Spec>
        </Row>
      </SubSection>
    </Section>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

function SelectSection() {
  return (
    <Section
      id="select"
      title="Select"
      note="Known issue in dark: --background/--foreground are light-only tokens, so the trigger/content surfaces are transparent with dark text (THEMING.md, deferred bug 4). Shown as-is on purpose."
    >
      <Row>
        <Spec label="default">
          <Select defaultValue="usds">
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usds">USDS</SelectItem>
              <SelectItem value="sky">SKY</SelectItem>
              <SelectItem value="susds">sUSDS</SelectItem>
            </SelectContent>
          </Select>
        </Spec>
        <Spec label="disabled">
          <Select disabled>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Disabled" />
            </SelectTrigger>
          </Select>
        </Spec>
      </Row>
    </Section>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function CardsSection() {
  return (
    <Section id="cards" title="Cards" note="Glass-surface variants.">
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Default card</CardTitle>
          </CardHeader>
          <CardContent>
            <Text variant="medium">Glass surface with 28px radius and 20px blur.</Text>
          </CardContent>
        </Card>
        <Card variant="stats">
          <CardHeader variant="stats">
            <CardTitle variant="stats">Stats card — TVL</CardTitle>
          </CardHeader>
          <CardContent variant="stats">
            <Heading variant="medium">$2.4B</Heading>
          </CardContent>
        </Card>
        <Card variant="pool">
          <CardHeader variant="pool">
            <CardTitle variant="pool">Pool card</CardTitle>
          </CardHeader>
          <CardContent variant="pool">
            <Text variant="medium">Tighter leading, lg breakpoint padding.</Text>
          </CardContent>
        </Card>
        <Card variant="statsCompact">
          <CardHeader variant="statsCompact">
            <CardTitle variant="statsCompact">Stats compact</CardTitle>
          </CardHeader>
          <CardContent variant="statsCompact">
            <Heading variant="small">1.2M SKY</Heading>
          </CardContent>
        </Card>
        <Card variant="stepper">
          <CardContent variant="stepper">
            <Text variant="medium">Stepper card — square corners, border, small text.</Text>
          </CardContent>
        </Card>
        <Card variant="spotlight" className="sm:col-span-2">
          <CardHeader variant="spotlight">
            <CardTitle variant="spotlight">Spotlight card</CardTitle>
          </CardHeader>
          <CardContent variant="spotlight">
            <Text variant="medium">Brand-gradient promotional surface.</Text>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function OverlaysSection() {
  return (
    <Section
      id="overlays"
      title="Overlays"
      note="Dialog and Sheet share the --background token gap in dark (THEMING.md, deferred bug 4)."
    >
      <Row>
        <Spec label="dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="m">
                Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogDescription>A dialog description explaining what this is about.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="primary" size="m">
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Spec>
        <Spec label="sheet (right)">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="m">
                Open sheet
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Sheet title</SheetTitle>
                <SheetDescription>Slide-over panel content.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </Spec>
        <Spec label="popover">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="m">
                Open popover
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <Text variant="medium">Popover content anchored to its trigger.</Text>
            </PopoverContent>
          </Popover>
        </Spec>
        <Spec label="tooltip (hover)">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="m">
                  Hover me
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tooltip text</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Spec>
        <Spec label="toast">
          <Button
            variant="secondary"
            size="m"
            onClick={() =>
              toast('Design-system toast', { description: 'Fired from the preview page via sonner.' })
            }
          >
            Fire toast
          </Button>
        </Spec>
      </Row>
    </Section>
  );
}

// ─── Data & misc ──────────────────────────────────────────────────────────────

function SlippageMenuDemo() {
  const [slippage, setSlippage] = useState(0.002);
  return <SlippageMenu value={slippage} defaultValue={0.002} onChange={setSlippage} />;
}

/** One primitive-built row per typed cell, so the table showcases itself. */
function CellSpecimenRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell className="text-fgSecondary w-64">{name}</TableCell>
      <TableCell>{children}</TableCell>
    </TableRow>
  );
}

/** Sortable-header button as consumers build it (EarnTable pattern). */
function SortableHead({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn('hover:text-fgPrimary inline-flex items-center gap-1 transition-colors')}
    >
      {label}
      <ChevronDown size={12} className={cn(active ? 'rotate-180 opacity-100' : 'opacity-40')} />
    </button>
  );
}

function TablesSection() {
  return (
    <Section
      id="tables"
      title="Tables"
      note="Patterns / Tables: transparent 32px Body-6 header, 88px rows separated by 2px slits, 24px corners on the body block only, bg-tertiary row hover. All columns left-aligned per Figma. Type=Text is the bare TableCell; Type=Button is the DS Button (primary, m)."
    >
      <SubSection title="Typed cells">
        <Table className="max-w-3xl">
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Specimen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <CellSpecimenRow name="Text (TableCell default)">$4.23b</CellSpecimenRow>
            <CellSpecimenRow name="Percent">
              <CellPercent value="3.75" />
            </CellSpecimenRow>
            <CellSpecimenRow name="Empty">
              <CellEmpty />
            </CellSpecimenRow>
            <CellSpecimenRow name="Icon">
              <CellChevron />
            </CellSpecimenRow>
            <CellSpecimenRow name="Risk (none / low / moderate / advanced)">
              <span className="flex items-center gap-2">
                <RiskMeter segments={[null, null, null]} />
                <RiskTierMeter tier="low" />
                <RiskTierMeter tier="moderate" />
                <RiskTierMeter tier="advanced" />
              </span>
            </CellSpecimenRow>
            <CellSpecimenRow name="Status">
              <span className="flex items-center gap-2">
                <CellStatus status="pending" />
                <CellStatus status="completed" />
              </span>
            </CellSpecimenRow>
            <CellSpecimenRow name="Button (DS Button primary/m)">
              <Button variant="primary" size="m">
                Supply
              </Button>
            </CellSpecimenRow>
            <CellSpecimenRow name="Networks">
              <CellNetworks>
                <MainnetChain className="h-full w-full" />
                <BaseChain className="h-full w-full" />
                <OptimismChain className="h-full w-full" />
              </CellNetworks>
            </CellSpecimenRow>
            <CellSpecimenRow name="Token">
              <CellToken
                icon={<TokenIcon token={{ symbol: 'sUSDS' }} width={28} className="h-7 w-7" showChainIcon={false} />}
                title="Sky Savings"
                subtitle={
                  <>
                    Supply: <TokenIconStack symbols={['USDS', 'USDC']} size={12} />
                  </>
                }
              />
            </CellSpecimenRow>
            <CellSpecimenRow name="Token (active position, showMode + showDate)">
              <CellToken
                active
                icon={<TokenIcon token={{ symbol: 'sUSDS' }} width={28} className="h-7 w-7" showChainIcon={false} />}
                title="Pendle sUSDS"
                titleSuffix={<Pendle className="h-4 w-4" />}
                subtitle={
                  <>
                    Supply: <TokenIconStack symbols={['USDS']} size={12} />
                    <span aria-hidden>·</span>
                    18 Jun 2026
                  </>
                }
              />
            </CellSpecimenRow>
            <CellSpecimenRow name="Token Idle">
              <CellTokenIdle
                icon={<TokenIcon token={{ symbol: 'USDS' }} width={28} className="h-7 w-7" showChainIcon={false} />}
                symbol="USDS"
                badges={
                  <>
                    <CellBadge tone="success">up to 4.75%</CellBadge>
                    <CellBadge>1:1 USDC</CellBadge>
                  </>
                }
                name="Sky USD"
              />
            </CellSpecimenRow>
            <CellSpecimenRow name="Position">
              <CellPosition icon={<Stake width={16} height={16} />} label="Position 1" />
            </CellSpecimenRow>
            <CellSpecimenRow name="Action">
              <CellAction icon={<ArrowDownToLine className="size-4" />} label="Supply" sublabel="35 min ago" />
            </CellSpecimenRow>
            <CellSpecimenRow name="Action and Position">
              <CellAction
                compact
                icon={<ArrowUpToLine className="size-4" />}
                label="Stake & Borrow"
                sublabel={
                  <>
                    35 min ago <span aria-hidden>·</span> Position 1
                  </>
                }
              />
            </CellSpecimenRow>
            <CellSpecimenRow name="Product">
              <CellProduct
                icon={<TokenIcon token={{ symbol: 'stUSDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
                label="Staked USDS"
              />
            </CellSpecimenRow>
            <CellSpecimenRow name="Amount with Token">
              <CellAmountWithToken
                amount="$128.90"
                icon={<TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />}
              />
            </CellSpecimenRow>
            <CellSpecimenRow name="Amount">
              <CellAmount
                icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
                amount="1,000.00"
                usd="$1,000.00"
              />
            </CellSpecimenRow>
            <CellSpecimenRow name="Hash">
              <CellHash label="0xff9s...dsa6" href="https://etherscan.io" />
            </CellSpecimenRow>
          </TableBody>
        </Table>
      </SubSection>

      <SubSection title="Table / Earn">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">
                <SortableHead label="Token" active />
              </TableHead>
              <TableHead>
                <SortableHead label="Network" />
              </TableHead>
              <TableHead>
                <SortableHead label="Risk profile" />
              </TableHead>
              <TableHead>
                <SortableHead label="Rate" />
              </TableHead>
              <TableHead>
                <SortableHead label="30D Rate" />
              </TableHead>
              <TableHead>
                <SortableHead label="TVL" />
              </TableHead>
              <TableHead>
                <SortableHead label="My position" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="cursor-pointer">
              <TableCell>
                <CellToken
                  active
                  icon={
                    <TokenIcon token={{ symbol: 'sUSDS' }} width={28} className="h-7 w-7" showChainIcon={false} />
                  }
                  title="Sky Savings"
                  subtitle={
                    <>
                      Supply: <TokenIconStack symbols={['USDS', 'USDC']} size={12} />
                    </>
                  }
                />
              </TableCell>
              <TableCell>
                <CellNetworks>
                  <MainnetChain className="h-full w-full" />
                  <BaseChain className="h-full w-full" />
                  <OptimismChain className="h-full w-full" />
                </CellNetworks>
              </TableCell>
              <TableCell>
                <RiskTierMeter tier="low" />
              </TableCell>
              <TableCell>
                <CellPercent value="3.75" />
              </TableCell>
              <TableCell>
                <CellPercent value="3.81" />
              </TableCell>
              <TableCell>$4.23b</TableCell>
              <TableCell>$2,500.00</TableCell>
            </TableRow>
            <TableRow className="cursor-pointer">
              <TableCell>
                <CellToken
                  icon={
                    <TokenIcon token={{ symbol: 'sUSDS' }} width={28} className="h-7 w-7" showChainIcon={false} />
                  }
                  title="Pendle sUSDS"
                  titleSuffix={<Pendle className="h-4 w-4" />}
                  subtitle={
                    <>
                      Supply: <TokenIconStack symbols={['USDS']} size={12} />
                      <span aria-hidden>·</span>
                      18 Jun 2026
                    </>
                  }
                />
              </TableCell>
              <TableCell>
                <CellNetworks>
                  <MainnetChain className="h-full w-full" />
                </CellNetworks>
              </TableCell>
              <TableCell>
                <RiskTierMeter tier="low" />
              </TableCell>
              <TableCell>
                <CellPercent value="8.61" />
              </TableCell>
              <TableCell>
                <CellEmpty />
              </TableCell>
              <TableCell>$78.9m</TableCell>
              <TableCell>$0.00</TableCell>
            </TableRow>
            <TableRow className="cursor-pointer">
              <TableCell>
                <CellToken
                  icon={
                    <TokenIcon token={{ symbol: 'USDS' }} width={28} className="h-7 w-7" showChainIcon={false} />
                  }
                  title="USDS Flagship Vault"
                  subtitle={
                    <>
                      Supply: <TokenIconStack symbols={['USDS']} size={12} />
                    </>
                  }
                />
              </TableCell>
              <TableCell>
                <CellNetworks>
                  <BaseChain className="h-full w-full" />
                </CellNetworks>
              </TableCell>
              <TableCell>
                <RiskTierMeter tier="moderate" />
              </TableCell>
              <TableCell>
                <CellPercent value="5.12" />
              </TableCell>
              <TableCell>
                <CellPercent value="5.02" />
              </TableCell>
              <TableCell>$312.4m</TableCell>
              <TableCell>
                <CellEmpty />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SubSection>

      <SubSection title="Table / Transactions">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[23%]">Action</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Supplied</TableHead>
              <TableHead>Txn hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <CellAction
                  icon={<ArrowDownToLine className="size-4" />}
                  label="Supply"
                  sublabel="35 min ago"
                />
              </TableCell>
              <TableCell>
                <CellNetworks>
                  <MainnetChain className="h-full w-full" />
                </CellNetworks>
              </TableCell>
              <TableCell>
                <CellStatus status="pending" />
              </TableCell>
              <TableCell>
                <CellProduct
                  icon={
                    <TokenIcon token={{ symbol: 'stUSDS' }} width={12} className="h-3 w-3" showChainIcon={false} />
                  }
                  label="Staked USDS"
                />
              </TableCell>
              <TableCell>
                <CellAmount
                  icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
                  amount="1,000.00"
                  usd="$1,000.00"
                />
              </TableCell>
              <TableCell>
                <CellHash label="0xff9s...dsa6" href="https://etherscan.io" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <CellAction
                  icon={<ArrowUpToLine className="size-4" />}
                  label="Withdraw"
                  sublabel="2 days ago"
                />
              </TableCell>
              <TableCell>
                <CellNetworks>
                  <BaseChain className="h-full w-full" />
                </CellNetworks>
              </TableCell>
              <TableCell>
                <CellStatus status="completed" />
              </TableCell>
              <TableCell>
                <CellProduct
                  icon={
                    <TokenIcon token={{ symbol: 'sUSDS' }} width={12} className="h-3 w-3" showChainIcon={false} />
                  }
                  label="Sky Savings"
                />
              </TableCell>
              <TableCell>
                <CellAmount
                  icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
                  amount="500.00"
                  usd="$500.00"
                />
              </TableCell>
              <TableCell>
                <CellHash label="0x8a2b...41ce" href="https://etherscan.io" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SubSection>

      <SubSection title="Table / Active Positions + Idle (excerpt)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Token</TableHead>
              <TableHead>Supplied</TableHead>
              <TableHead className="w-[148px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <CellTokenIdle
                  icon={<TokenIcon token={{ symbol: 'USDS' }} width={28} className="h-7 w-7" showChainIcon={false} />}
                  symbol="USDS"
                  badges={
                    <>
                      <CellBadge tone="success">up to 4.75%</CellBadge>
                      <CellBadge>1:1 USDC</CellBadge>
                    </>
                  }
                  name="Sky USD"
                />
              </TableCell>
              <TableCell>
                <CellAmount
                  icon={<TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />}
                  amount="1,000.00"
                  usd="$1,000.00"
                />
              </TableCell>
              <TableCell className="px-4">
                <Button variant="primary" size="m" className="w-full">
                  Supply
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <CellPosition icon={<Stake width={16} height={16} />} label="Position 1" />
              </TableCell>
              <TableCell>
                <CellAmountWithToken
                  amount="$128.90"
                  icon={<TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />}
                />
              </TableCell>
              <TableCell>
                <span className="flex justify-center">
                  <CellChevron />
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SubSection>
    </Section>
  );
}

function DataSection() {
  return (
    <Section id="data" title="Data & misc">
      <SubSection title="Accordion">
        <Accordion type="single" collapsible className="max-w-2xl">
          <AccordionItem value="a">
            <AccordionTrigger>What is the Sky Protocol?</AccordionTrigger>
            <AccordionContent>
              <Text variant="medium">A decentralized, non-custodial DeFi protocol.</Text>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>How do rewards work?</AccordionTrigger>
            <AccordionContent>
              <Text variant="medium">Rewards accrue per block and can be claimed at any time.</Text>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SubSection>

      <SubSection title="Pagination">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink>1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink>3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </SubSection>

      <SubSection title="Progress / Skeleton / Avatar">
        <Row>
          <Spec label="progress 40%" className="w-64">
            <Progress value={40} className="w-64" />
          </Spec>
          <Spec label="skeleton">
            <span className="flex w-48 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </span>
          </Spec>
          <Spec label="avatar fallback">
            <Avatar>
              <AvatarFallback>SK</AvatarFallback>
            </Avatar>
          </Spec>
        </Row>
      </SubSection>

      <SubSection title="Carousel">
        <Carousel className="mx-12 max-w-md">
          <CarouselContent>
            {[1, 2, 3].map(n => (
              <CarouselItem key={n}>
                <Card>
                  <CardContent className="flex h-32 items-center justify-center p-0">
                    <Heading variant="medium">Slide {n}</Heading>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
          <CarouselDots />
        </Carousel>
      </SubSection>

      <SubSection title="Collapsible">
        <Collapsible className="max-w-md">
          <CollapsibleTrigger asChild>
            <Button variant="secondary" size="s">
              Toggle details
              <ChevronDown />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <Text variant="medium">Collapsible content revealed on demand.</Text>
          </CollapsibleContent>
        </Collapsible>
      </SubSection>

      <SubSection title="Module bits — ChartSkeleton / GainValue / SlippageMenu">
        <div className="max-w-2xl space-y-8">
          <Spec label="chart skeleton (animated)" className="w-full">
            <div className="w-full">
              <ChartSkeleton />
            </div>
          </Spec>
          <Spec label="gain value">
            <GainValue value={557.9} className="text-lg" />
          </Spec>
          <Spec label="slippage menu — the gear opens the settings popover">
            <SlippageMenuDemo />
          </Spec>
        </div>
      </SubSection>
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DesignSystem() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  );

  const switchTheme = (value: string) => {
    const next = value === 'light' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div className="text-text min-h-screen">
      {/* Same viewport-fixed background the app shell uses — glass surfaces
          (cards, badges) are nearly invisible over a flat fill. */}
      <div aria-hidden className="app-background" />
      <header className="border-glassBorder bg-pageBackground/80 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Heading tag="h1" variant="small" className="mr-auto">
            Design system preview
          </Heading>
          <nav className="text-fgSecondary flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className="hover:text-text transition-colors">
                {s.title}
              </a>
            ))}
          </nav>
          <Tabs value={theme} onValueChange={switchTheme}>
            <TabsList variant="segmented">
              <TabsTrigger variant="segmented" value="dark">
                Dark
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="light">
                Light
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-6 py-10">
        <p className="text-fgSecondary max-w-3xl text-sm">
          Internal preview of the canonical <code>components/ui</code> primitives (hidden in production). Dark
          is the at-parity theme; light is the interim mechanism pending G2. Hover, press and focus the
          specimens to see their live states.
        </p>
        <ColorsSection />
        <TypographySection />
        <ButtonsSection />
        <TabsSection />
        <FormControlsSection />
        <SelectSection />
        <CardsSection />
        <OverlaysSection />
        <TablesSection />
        <DataSection />
      </main>
      <Toaster />
    </div>
  );
}

export default DesignSystem;
