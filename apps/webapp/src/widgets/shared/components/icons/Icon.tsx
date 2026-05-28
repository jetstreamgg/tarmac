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
  return (
    <svg
      width={boxSize ? boxSize : width}
      height={boxSize ? boxSize : height}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      {...props}
    >
      {children}
    </svg>
  );
};
