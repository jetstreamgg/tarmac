// preinstall guard: refuse installs run with anything but pnpm. A local
// stand-in for `pnpm dlx only-allow pnpm`, which fetched only-allow from the
// registry outside the lockfile and honored a PR-added .npmrc — a redirect
// that ran before lockfile validation (APP-477).
// Only a package manager that names itself is refused: some environments (Vercel's
// build, for one) run lifecycle scripts with no user agent at all, and only-allow
// let those through too.
const packageManager = (process.env.npm_config_user_agent || '').split('/')[0];

if (packageManager && packageManager !== 'pnpm') {
  console.error(`\nThis repository requires pnpm (it was installed with ${packageManager}).`);
  console.error('Run `corepack enable` and then `pnpm install`.\n');
  process.exit(1);
}
