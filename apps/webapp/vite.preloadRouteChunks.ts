import type { Plugin } from 'vite';

type OutputChunk = {
  type: 'chunk';
  fileName: string;
  imports: string[];
  isDynamicEntry: boolean;
  facadeModuleId: string | null;
};

const ROUTES_DIR = '/src/routes/';
const ROUTE_FILE = /\/src\/routes\/([^/?]+)\.tsx(?:\?|$)/;
/**
 * The flat file-name segments this plugin can turn into a URL pattern: a
 * pathless `_layout`, `index`, a `$param`, or a literal path segment. Anything
 * else (`{-$param}`, `(group)`, a bare `$` splat, `-ignored`, a `name_` escape)
 * fails the build instead of silently losing or mis-matching the preload.
 */
const SEGMENT = /^(?:_[\w-]+|\$\w+|[a-z0-9][a-z0-9-]*)$/;
/** File-name suffixes TanStack reads as file types, not path segments. */
const RESERVED_SEGMENTS = new Set(['route', 'lazy']);

/**
 * Where `/` redirects to (`routes/_shell.index.tsx`, which has no chunk of its
 * own), and what it decides from: `LAST_KEY` and `PORTFOLIO_DECISION_TTL_MS` in
 * `src/lib/portfolioDecisionCache.ts`. Mirrored rather than imported, since
 * this file's tsconfig project can't include app sources. Keep in sync.
 */
const HOME_PATHS = { portfolio: '/portfolio', earn: '/earn' };
const LAST_PORTFOLIO_DECISION_KEY = 'portfolioDecision:v1:$last';
const PORTFOLIO_DECISION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A route file name segment, matched literally inside the URL pattern. */
const escapeRegExp = (text: string) => text.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');

/**
 * JSON for an inline <script>: characters that could end the element (`</`)
 * or a string literal (U+2028/U+2029 in older engines) are written as escapes.
 */
const toScriptLiteral = (value: unknown) =>
  JSON.stringify(value).replace(
    /[<>/\u2028\u2029]/g,
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
          if (!chunk.isDynamicEntry || !chunk.facadeModuleId?.includes(ROUTES_DIR)) continue;
          const routeId = chunk.facadeModuleId.match(ROUTE_FILE)?.[1];
          if (!routeId) {
            throw new Error(`preload-route-chunks: can't map ${chunk.facadeModuleId} to a URL`);
          }
          const bad = routeId.split('.').find(s => !SEGMENT.test(s) || RESERVED_SEGMENTS.has(s));
          if (bad) throw new Error(`preload-route-chunks: unknown segment "${bad}" in ${routeId}`);
          routeChunks.set(routeId, [...(routeChunks.get(routeId) ?? []), chunk.fileName]);
        }
        // e.g. a router plugin upgrade that renames the split chunks' module ids.
        if (routeChunks.size === 0) throw new Error('preload-route-chunks: found no route chunks');

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
        for (const path of Object.values(HOME_PATHS)) {
          if (!routes.some(([pattern]) => new RegExp(pattern).test(path))) {
            throw new Error(`preload-route-chunks: no route matches the home path ${path}`);
          }
        }

        // The URL path is the only outside input. It is only ever tested
        // against the anchored patterns above (linear time) and never becomes
        // a pattern or an href. Trailing slashes are trimmed with a loop: the
        // regex /\/+$/ backtracks quadratically on a long run of slashes.
        // `/` preloads the page its redirect will land on, decided the same way
        // as `_shell.index.tsx` (readLastPortfolioDecision): Portfolio when the
        // last settled decision, unexpired, had outcome `none`; Earn otherwise.
        const home = `if(p==='/'){try{var d=JSON.parse(localStorage.getItem(${toScriptLiteral(LAST_PORTFOLIO_DECISION_KEY)})||'null');p=d&&d.outcome==='none'&&Date.now()-d.updatedAt<=${PORTFOLIO_DECISION_TTL_MS}?${toScriptLiteral(HOME_PATHS.portfolio)}:${toScriptLiteral(HOME_PATHS.earn)}}catch(_){p=${toScriptLiteral(HOME_PATHS.earn)}}}`;
        const script = `(function(){var f=${toScriptLiteral(files)},r=${toScriptLiteral(routes)},p=location.pathname,e=p.length;while(e>1&&p.charCodeAt(e-1)===47)e--;p=p.slice(0,e);${home}for(var i=0;i<r.length;i++)if(new RegExp(r[i][0]).test(p)){r[i][1].forEach(function(n){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href='/'+f[n];document.head.appendChild(l)});break}})()`;

        // Right after `<meta charset>`, which must stay in the first 1024 bytes,
        // and ahead of the stylesheet: an inline script after a pending
        // stylesheet waits for it to load.
        const charset = /<meta charset=[^>]*>/i;
        if (charset.test(html)) {
          return html.replace(charset, meta => `${meta}\n    <script>${script}</script>`);
        }
        return {
          html,
          tags: [{ tag: 'script', children: script, injectTo: 'head-prepend' as const }]
        };
      }
    }
  };
}
