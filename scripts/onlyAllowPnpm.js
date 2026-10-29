// preinstall guard: refuse installs run with anything but pnpm. A local
// stand-in for `pnpm dlx only-allow pnpm`, which fetched only-allow from the
// registry outside the lockfile and honored a PR-added .npmrc — a redirect
// that ran before lockfile validation (APP-477).
const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.startsWith('pnpm/')) {
  const used = userAgent.split(' ')[0] || 'an unknown package manager';
  console.error(`\nThis repository requires pnpm (it was installed with ${used}).`);
  console.error('Run `corepack enable` and then `pnpm install`.\n');
  process.exit(1);
}
