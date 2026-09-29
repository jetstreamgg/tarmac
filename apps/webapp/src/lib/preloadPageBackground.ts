/**
 * Preloads the theme's page background image, so the shell doesn't paint on a
 * bare backdrop while the CSS background downloads (it is only requested once
 * the page's elements are styled).
 *
 * Requested from the entry rather than from index.html. The entry's modules
 * evaluate only once all of their scripts have downloaded, so the image (~88 kB)
 * no longer shares the connection with the scripts that first paint waits for,
 * and it still arrives well before that paint. Measured on a throttled phone:
 * first paint ~80 ms sooner, with the background ready for it on every run.
 *
 * The theme is already set on the root by the inline script in index.html.
 */
const link = document.createElement('link');
link.rel = 'preload';
link.as = 'image';
link.href =
  document.documentElement.dataset.theme === 'light'
    ? '/images/background-light.webp'
    : '/images/background-dark.webp';
document.head.appendChild(link);
