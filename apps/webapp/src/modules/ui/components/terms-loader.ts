// This file handles loading the correct terms markdown based on environment configuration
// The imports are resolved at build time by Vite

// Default terms (always available as fallback)
import defaultTerms from '@/content/terms.md?raw';

// Import all potential terms files that might be used
// Add more imports here as needed for different environments
const termsModules = import.meta.glob('@/content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

// Function to get terms content based on environment variable
export function getTermsContent(): string {
  const termsFileName = import.meta.env.VITE_TERMS_MARKDOWN_FILE;

  if (!termsFileName) {
    // No custom file specified, use default
    return defaultTerms;
  }

  // Extract just the filename if a full path was provided
  let fileName = termsFileName;
  if (termsFileName.includes('/')) {
    fileName = termsFileName.split('/').pop() || termsFileName;
  }

  // Ensure the filename has a .md extension
  if (!fileName.endsWith('.md')) {
    fileName = `${fileName}.md`;
  }

  // Find the module key that ends with the filename
  // This handles various path formats like '/content/terms.md', '/src/content/terms.md', etc.
  const matchedKey = Object.keys(termsModules).find(
    key => key.endsWith(`/${fileName}`) || key.endsWith(fileName)
  );

  if (matchedKey) {
    console.log(`Using custom terms file: ${fileName} (matched key: ${matchedKey})`);
    return termsModules[matchedKey];
  }

  console.warn(`Terms file not found: ${fileName}, falling back to default`);
  console.warn('Available files:', Object.keys(termsModules));
  return defaultTerms;
}
