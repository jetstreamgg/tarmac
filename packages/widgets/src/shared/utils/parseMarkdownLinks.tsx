import React from 'react';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';

/**
 * Checks if a URL has a safe scheme that can be rendered as a clickable link
 * Allowed schemes: http, https, mailto, tel, and relative/hash URLs (no scheme)
 * Disallowed schemes like javascript: or data: will return false
 */
function isSafeUrlScheme(url: string): boolean {
  const trimmedUrl = url.trim();

  // Allow relative URLs and hash links (no scheme)
  if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('#')) {
    return true;
  }

  // Extract scheme by finding the first colon
  const colonIndex = trimmedUrl.indexOf(':');
  if (colonIndex === -1) {
    // No colon means no scheme, treat as relative URL
    return true;
  }

  const scheme = trimmedUrl.substring(0, colonIndex).toLowerCase();
  const safeSchemes = ['http', 'https', 'mailto', 'tel'];

  return safeSchemes.includes(scheme);
}

/**
 * Parses markdown links in text and converts them to ExternalLink components or plain anchor tags
 * Supports the pattern [text](url)
 * - Links starting with #tooltip- are rendered as plain <a> tags (for internal tooltip anchors)
 * - Links with safe schemes (http, https, mailto, tel) are rendered as ExternalLink components
 * - Links with unsafe schemes (javascript:, data:, etc.) are rendered as non-clickable text
 *
 * @param text - The text containing markdown links
 * @param onExternalLinkClicked - Optional callback for external link clicks
 * @returns React nodes with parsed links
 */
export function parseMarkdownLinks(
  text: string | undefined | null,
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
): React.ReactNode {
  if (!text) return '';

  const parts: React.ReactNode[] = [];
  let i = 0;
  let keyIndex = 0;

  while (i < text.length) {
    const openBracket = text.indexOf('[', i);
    if (openBracket === -1) break;

    const closeBracket = text.indexOf(']', openBracket + 1);
    if (closeBracket === -1) break;

    if (text[closeBracket + 1] !== '(') {
      i = closeBracket + 1;
      continue;
    }

    const closeParen = text.indexOf(')', closeBracket + 2);
    if (closeParen === -1) break;

    // Add text before the link
    if (openBracket > i) {
      parts.push(text.substring(i, openBracket));
    }

    const linkText = text.substring(openBracket + 1, closeBracket);
    const url = text.substring(closeBracket + 2, closeParen);

    // Check if the URL has a safe scheme
    if (!isSafeUrlScheme(url)) {
      // Render unsafe URLs as non-clickable text
      parts.push(<span key={`link-${keyIndex++}`}>{linkText}</span>);
    } else if (url.startsWith('#tooltip-')) {
      // Render as plain anchor tag for tooltip links
      parts.push(
        <a key={`link-${keyIndex++}`} href={url} className="text-text hover:text-white hover:underline">
          {linkText}
        </a>
      );
    } else {
      // Render as ExternalLink for external URLs
      parts.push(
        <ExternalLink
          key={`link-${keyIndex++}`}
          href={url}
          className="hover:text-white hover:underline"
          showIcon={false}
          onExternalLinkClicked={onExternalLinkClicked}
        >
          {linkText}
        </ExternalLink>
      );
    }

    i = closeParen + 1;
  }

  // If no links found, return the text as is
  if (parts.length === 0) {
    return text;
  }

  // Add any remaining text after the last link
  if (i < text.length) {
    parts.push(text.substring(i));
  }

  return <>{parts}</>;
}
