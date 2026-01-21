import { cn } from '@widgets/lib/utils';

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
  h2: 'scroll-m-20 font-medium tracking-tight leading-normal transition-colors',
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

const HEADING_VARIANTS: Record<HeadingVariant, string> = {
  // TODO: Heading styles should all be Circular Std font
  // Headings are "book" weight which is 450 but CSS doesn't support that we should choose whichever looks best
  'x-large': 'text-[32px] text-text font-circle leading-10 font-normal',
  large: 'text-3xl text-text font-circle',
  medium: 'text-2xl text-text font-circle',
  small: 'text-lg text-text font-circle'
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
