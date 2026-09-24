import type { Plugin } from 'vite';

type OutputChunk = {
  type: 'chunk';
  fileName: string;
  imports: string[];
  isDynamicEntry: boolean;
  facadeModuleId: string | null;
};

const ROUTE_FILE = /\/src\/routes\/([^/?]+)\.tsx(?:\?|$)/;

/** A route file name segment, matched literally inside the URL pattern. */
const escapeRegExp = (text: string) => text.replace(/[\\^$.*+?()[\]{}|\/-]/g, '\\$&');

/**
 * JSON for an inline <script>: characters that could end the element (`</`)
 * or a string literal (U+2028/U+2029 in older engines) are written as escapes.
 */
const toScriptLiteral = (value: unknown) =>
  JSON.stringify(value).replace(
    /[<>\/\u2028\u2029]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );

/**
 * Preloads the code of the page being opened, from index.html.
 *
 * With `autoCodeSplitting`, a page's component is a lazy chunk that the
 * browser only requests once the entry has run, React has rendered and the
 * router has matched the URL: a second network round trip in front of first
 * paint. Every URL is served the same index.html, so the links can't be static.
 * Instead this inlines a small script with a map from each route's URL pattern
 * to its chunks (its layouts' and its own, with their static imports), which
 * adds `modulepreload` links for the current path while the HTML parses.
 */
export function preloadRouteChunks(): Plugin {
  return {
    name: 'preload-route-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const chunks = Object.values(ctx.bundle).filter(
          (c): c is OutputChunk & typeof c => c.type === 'chunk'
        );
        const byFileName = new Map(chunks.map(c => [c.fileName, c]));

        // Route id (the file name, e.g. `_shell.earn.rewards.$rewardContract`)
        // to its lazy chunks: the split component, and a split loader if any.
        const routeChunks = new Map<string, string[]>();
        for (const chunk of chunks) {
          const routeId = chunk.isDynamicEntry && chunk.facadeModuleId?.match(ROUTE_FILE)?.[1];
          if (routeId) routeChunks.set(routeId, [...(routeChunks.get(routeId) ?? []), chunk.fileName]);
        }

        const closure = (seeds: string[]) => {
          const files = new Set<string>();
          const visit = (fileName: string) => {
            if (files.has(fileName)) return;
            files.add(fileName);
            byFileName.get(fileName)?.imports.forEach(visit);
          };
          seeds.forEach(visit);
          // index.html already preloads the entry's own imports.
          return [...files].filter(fileName => !html.includes(fileName));
        };

        const routeIds = [...routeChunks.keys()];
        const isLayout = (id: string) => routeIds.some(other => other.startsWith(`${id}.`));
        // `_shell.earn.rewards.$rewardContract` → ^/earn/rewards/[^/]+$
        // (pathless `_layouts` and `index` add no segment).
        const pathPattern = (id: string) => {
          const segments = id
            .split('.')
            .filter(segment => !segment.startsWith('_') && segment !== 'index')
            .map(segment => (segment.startsWith('$') ? '[^/]+' : escapeRegExp(segment)));
          return `^/${segments.join('/')}$`;
        };
        // A route's chain: every route id that is a dot-prefix of it, itself included.
        const chain = (id: string) =>
          routeIds
            .filter(other => other === id || id.startsWith(`${other}.`))
            .flatMap(other => routeChunks.get(other)!);

        const files: string[] = [];
        const fileIndex = (fileName: string) => {
          const index = files.indexOf(fileName);
          return index === -1 ? files.push(fileName) - 1 : index;
        };
        const routes = routeIds
          .filter(id => !isLayout(id))
          .map(id => [pathPattern(id), closure(chain(id)).map(fileIndex)] as const);

        const script = `(function(){var f=${toScriptLiteral(files)},r=${toScriptLiteral(routes)},p=location.pathname.replace(/\\/+$/,'')||'/';for(var i=0;i<r.length;i++)if(new RegExp(r[i][0]).test(p)){r[i][1].forEach(function(n){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href='/'+f[n];document.head.appendChild(l)});break}})()`;

        return {
          html,
          tags: [{ tag: 'script', children: script, injectTo: 'head-prepend' as const }]
        };
      }
    }
  };
}
