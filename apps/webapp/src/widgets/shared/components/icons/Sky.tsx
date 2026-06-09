/**
 * Sky (sky.money) brand mark — the official "portal" logo (round by design).
 * Served from `src/public/images/sky.svg`, the same asset used as the app logo/favicon.
 * Rendered as an <img> so sizing/rounding still come from `className`.
 */
export const Sky = ({ className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img src="/images/sky.svg" alt="Sky" width={16} height={16} className={className} {...props} />
);
