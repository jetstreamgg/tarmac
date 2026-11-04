export type IconProps = React.SVGProps<SVGSVGElement> & {
  boxSize?: number;
};

export const Icon = ({
  width = 24,
  height = 24,
  viewBox = '0 0 24 24',
  children,
  boxSize,
  ...props
}: IconProps) => {
  // Hidden from assistive tech unless labelled: these icons sit beside text
  // that already says what they mean. Pass an aria-label to expose one, or
  // aria-hidden={false} to opt out (APP-578).
  const labelled = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  return (
    <svg
      width={boxSize ? boxSize : width}
      height={boxSize ? boxSize : height}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      aria-hidden={labelled ? undefined : true}
      {...props}
    >
      {children}
    </svg>
  );
};
