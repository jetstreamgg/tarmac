const supportedLocales = [
  { value: 'en', name: 'English' },
  { value: 'es', name: 'Español' },
  { value: 'es-AR', name: 'Español (Argentina)' },
  { value: 'es-ES', name: 'Español (España)' },
  { value: 'ko', name: 'Korean' }
];

export const locales = supportedLocales.map(locale => locale.value);
