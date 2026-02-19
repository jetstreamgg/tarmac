import { ConsoleMessage, Page } from '@playwright/test';

export const createConsoleListener = (page: Page) => {
  const messages: string[] = [];
  let internalRegex: RegExp | null = null;

  const filter = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (internalRegex?.test(text)) messages.push(text);
  };

  return {
    initialize: (regex: RegExp = /\[Analytics\] Event:/) => {
      messages.length = 0;
      internalRegex = regex;
      page.on('console', filter);
    },
    getMessages: (regex?: RegExp) => (regex ? messages.filter(m => regex.test(m)) : messages),
    clearMessages: () => {
      messages.length = 0;
    },
    reset: () => {
      messages.length = 0;
      internalRegex = null;
      page.off('console', filter);
    }
  };
};
