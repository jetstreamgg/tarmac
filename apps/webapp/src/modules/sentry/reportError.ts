import * as Sentry from '@sentry/react';
import { toError } from '@jetstreamgg/sky-hooks';

export type ReportContext = {
  module: string;
  flow?: string;
  action?: string;
  statusCode?: number;
  type?: string;
  level?: Sentry.SeverityLevel;
  extra?: Record<string, unknown>;
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

    if (ctx.extra) {
      scope.setExtras(ctx.extra);
    }

    Sentry.captureException(normalizedError);
  });

  if (import.meta.env.DEV) {
     
    console.error(normalizedError, ctx);
  }
}
