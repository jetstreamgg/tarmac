export function generateUUID(): string {
  const template = '10000000-1000-4000-8000-100000000000';
  return template.replace(/[018]/g, c =>
    (parseInt(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (parseInt(c) / 4)))).toString(16)
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
