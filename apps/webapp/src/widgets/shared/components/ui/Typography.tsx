import { cn } from '@/widgets/lib/utils';

type TextElement = 'p' | 'span';
type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4';
type TypographyElement = TextElement | HeadingElement;

interface TypographyProps {
  children: React.ReactNode;
  tag?: TypographyElement;
  className?: string;
  dataTestId?: string;
  id?: string;
}

const ELEMENTS: Record<TypographyElement, string> = {
  h1: 'scroll-m-20 font-normal tracking-tight',
  h2: 'scroll-m-20 font-circle font-medium tracking-tight leading-normal transition-colors',
  h3: 'scroll-m-20 font-normal tracking-tight',
  h4: 'scroll-m-20 font-normal tracking-tight',
  p: 'leading-normal text-base',
  span: 'leading-normal text-base'
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

type HeadingVariant = 'x-large' | 'large' | 'medium' | 'small';

interface HeadingProps {
  children: React.ReactNode;
  tag?: HeadingElement;
  variant?: HeadingVariant;
  className?: string;
  dataTestId?: string;
  id?: string;
}

// Circular Medium (font-weight/label = 500) is the only heading weight in the
// design system; without the class these resolve to Circular Book (450).
const HEADING_VARIANTS: Record<HeadingVariant, string> = {
  'x-large': 'text-[32px] text-text font-circle font-medium leading-10',
  large: 'text-3xl text-text font-circle font-medium',
  medium: 'text-2xl text-text font-circle font-medium',
  small: 'text-lg text-text font-circle font-medium'
};

export function Heading({ variant = 'medium', className, tag = 'h2', ...props }: HeadingProps) {
  const variantClass = variant ? HEADING_VARIANTS[variant] : '';
  return <Typography tag={tag} className={cn(variantClass, className)} {...props} />;
}

type TextVariant = 'large' | 'medium' | 'small' | 'captionLg' | 'captionSm' | 'button';

interface TextProps {
  children: React.ReactNode;
  tag?: TextElement;
  variant?: TextVariant;
  className?: string;
  dataTestId?: string;
  id?: string;
}

const TEXT_VARIANTS: Record<TextVariant, string> = {
  large: 'font-normal text-base font-graphik',
  medium: 'font-normal text-sm font-graphik',
  small: 'font-normal text-[13px] font-graphik',
  captionLg: 'font-normal text-sm font-graphik',
  captionSm: 'font-normal text-xs font-graphik',
  button: 'text-error-red text-xs font-circle'
};

export function Text({ variant = 'large', className, tag = 'p', ...props }: TextProps) {
  const variantClass = variant ? TEXT_VARIANTS[variant] : '';
  return <Typography tag={tag} className={cn(variantClass, className)} {...props} />;
}
