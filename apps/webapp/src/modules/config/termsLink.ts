import { reportError, ReportContext } from '@/modules/sentry/reportError';

export type TermsLink = {
  name: string;
  url: string;
};

type TermsLinkConfig = {
  termsLinks: TermsLink[];
  primaryTermsLink?: TermsLink;
  parseError?: unknown;
};

let cachedTermsLinkConfig: TermsLinkConfig | undefined;

const reportedTermsLinkErrors = new Set<string>();

function getReportKey(ctx: ReportContext): string {
  return [ctx.module, ctx.flow, ctx.action, ctx.type].filter(Boolean).join(':');
}

export function getTermsLinkConfig(): TermsLinkConfig {
  if (cachedTermsLinkConfig) {
    return cachedTermsLinkConfig;
  }

  try {
    const parsedTermsLink = JSON.parse(import.meta.env.VITE_TERMS_LINK);
    const termsLinks = Array.isArray(parsedTermsLink) ? parsedTermsLink : [];

    cachedTermsLinkConfig = {
      termsLinks,
      primaryTermsLink: termsLinks[0],
      parseError: Array.isArray(parsedTermsLink)
        ? undefined
        : new Error('VITE_TERMS_LINK must be a JSON array')
    };
  } catch (error) {
    cachedTermsLinkConfig = {
      termsLinks: [],
      primaryTermsLink: undefined,
      parseError: error
    };
  }

  return cachedTermsLinkConfig;
}

export function reportTermsLinkConfigErrorOnce(ctx: ReportContext): void {
  const { parseError } = getTermsLinkConfig();
  if (!parseError) return;

  const reportKey = getReportKey(ctx);
  if (reportedTermsLinkErrors.has(reportKey)) return;

  reportedTermsLinkErrors.add(reportKey);
  reportError(parseError, ctx);
}

export function reportMissingTermsLinkOnce(ctx: ReportContext): void {
  const { primaryTermsLink } = getTermsLinkConfig();
  if (primaryTermsLink) return;

  const reportKey = getReportKey(ctx);
  if (reportedTermsLinkErrors.has(reportKey)) return;

  reportedTermsLinkErrors.add(reportKey);
  reportError(new globalThis.Error('No terms link found'), ctx);
}
