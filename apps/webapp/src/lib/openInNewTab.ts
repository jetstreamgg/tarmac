/** Opens an explorer link the way a hash cell's anchor does (new tab, no opener). */
export function openInNewTab(href: string) {
  window.open(href, '_blank', 'noopener,noreferrer');
}

/**
 * Whether the user has just finished a text-selection drag. A whole-row link
 * gets its click on mouseup at the end of such a drag (select an amount or a
 * date and the row's common ancestor receives the click), which would open
 * the explorer instead of leaving the selection — so row activation skips it.
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed && selection.toString().length > 0;
}
