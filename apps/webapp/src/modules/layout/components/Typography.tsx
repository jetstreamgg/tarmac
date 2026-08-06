import { cn } from '@/lib/utils';

type TextElement = 'p' | 'span';
type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4';
type ListElement = 'ul' | 'ol';
type TypographyElement = TextElement | HeadingElement;

interface TypographyProps {
  children: React.ReactNode;
  tag?: TypographyElement;
  className?: string;
  dataTestId?: string;
}

const ELEMENTS: Record<TypographyElement, string> = {
  // No weight here: every heading is reached through <Heading>, whose variant
  // classes are merged after these and carry the design system's single
  // heading weight (Circular Medium — see HEADING_VARIANTS).
  h1: 'scroll-m-20 tracking-tight',
  h2: 'scroll-m-20 tracking-tight leading-normal transition-colors',
  h3: 'scroll-m-20 tracking-tight',
  h4: 'scroll-m-20 tracking-tight',
  p: 'leading-normal font-normal text-base',
  span: 'leading-normal font-normal text-base'
  // ...add other variants as needed
};

function Typography({ children, tag = 'span', className, dataTestId, ...props }: TypographyProps) {
  const elementClass = ELEMENTS[tag];
  const Element = tag;

  return (
    <Element className={cn(elementClass, className)} data-testid={dataTestId} {...props}>
      {children}
    </Element>
  );
}

type HeadingVariant = 'x-large' | 'large' | 'medium' | 'small' | 'extraSmall';

interface HeadingProps {
  children: React.ReactNode;
  tag?: HeadingElement;
  variant?: HeadingVariant;
  className?: string;
  dataTestId?: string;
}

// Every Heading style in the design system binds font-weight/label = 500, i.e.
// Circular Medium (Figma "5. Typography"). Without the weight class these fall
// to `normal`, which resolves to Circular Book (450) — the face is real, so the
// difference is a subtly lighter heading rather than an obvious fallback.
const HEADING_VARIANTS: Record<HeadingVariant, string> = {
  'x-large': 'text-[32px] text-text font-circle font-medium leading-10',
  large: 'text-3xl text-text font-circle font-medium',
  medium: 'text-2xl text-text font-circle font-medium',
  small: 'text-lg text-text font-circle font-medium',
  extraSmall: 'text-base text-text font-circle font-medium'
};

export function Heading({ variant = 'medium', className, tag = 'h2', ...props }: HeadingProps) {
  const variantClass = variant ? HEADING_VARIANTS[variant] : '';
  return <Typography tag={tag} className={cn(variantClass, className)} {...props} />;
}

type TextVariant =
  'large' | 'medium' | 'small' | 'captionLg' | 'captionSm' | 'button' | 'chartSecondary' | 'terms';

export interface TextProps {
  children: React.ReactNode;
  tag?: TextElement;
  variant?: TextVariant;
  className?: string;
  dataTestId?: string;
}

const TEXT_VARIANTS: Record<TextVariant, string> = {
  large: 'font-normal text-base font-graphik',
  medium: 'font-normal text-sm font-graphik',
  small: 'font-normal text-[13px] font-graphik',
  captionLg: 'font-normal text-sm font-graphik',
  captionSm: 'font-normal text-xs font-graphik',
  button: 'text-error-red text-xs font-circle',
  chartSecondary:
    'text-[13px] font-normal leading-none text-selectActive light:text-textSecondary lg:hidden font-graphik',
  terms: 'text-text text-[13px] font-graphik'
};

export function Text({ variant = 'large', className, tag = 'p', ...props }: TextProps) {
  const variantClass = variant ? TEXT_VARIANTS[variant] : '';
  return <Typography tag={tag} className={cn(variantClass, className)} {...props} />;
}

export type ListVariant = 'unordered' | 'ordered';
interface ListProps {
  children: React.ReactNode;
  tag?: ListElement;
  variant?: ListVariant;
  className?: string;
  dataTestId?: string;
}

const LIST_VARIANTS: Record<ListVariant, string> = {
  unordered: 'list-disc [&>li]:mt-2 ml-6',
  ordered: 'list-decimal [&>li]:mt-2 ml-6'
};

export function List({ className, variant = 'unordered', tag = 'ul', children, ...props }: ListProps) {
  const variantClass = variant ? LIST_VARIANTS[variant] : '';
  const Element = tag;
  return (
    <Element className={cn(variantClass, className)} {...props}>
      {children}
    </Element>
  );
}
