import * as Sentry from '@sentry/react';
// The helpers module, not the `@/hooks` barrel: hooks report through this file, so
// importing the barrel here would close an import cycle.
import { toError } from '@/hooks/helpers';

export type ReportContext = {
  module: string;
  flow?: string;
  action?: string;
  statusCode?: number;
  type?: string;
  level?: Sentry.SeverityLevel;
  /** Extra searchable tags, on top of module/flow/action/type. */
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, Record<string, unknown>>;
  fingerprint?: string[];
};

export function reportError(error: unknown, ctx: ReportContext): void {
  const normalizedError = toError(error);

  Sentry.withScope(scope => {
    scope.setTag('module', ctx.module);

    if (ctx.flow) {
      scope.setTag('flow', ctx.flow);
    }

    if (ctx.action) {
      scope.setTag('action', ctx.action);
    }

    if (ctx.type) {
      scope.setTag('type', ctx.type);
    }

    if (ctx.statusCode !== undefined) {
      scope.setTag('status_code', String(ctx.statusCode));
    }

    if (ctx.level) {
      scope.setLevel(ctx.level);
    }

    if (ctx.tags) {
      scope.setTags(ctx.tags);
    }

    if (ctx.extra) {
      scope.setExtras(ctx.extra);
    }

    if (ctx.contexts) {
      Object.entries(ctx.contexts).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }

    if (ctx.fingerprint) {
      scope.setFingerprint(ctx.fingerprint);
    }

    Sentry.captureException(normalizedError);
  });

  if (import.meta.env.DEV) {
    console.error(normalizedError, ctx);
  }
}
