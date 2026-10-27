/**
 * Whether clearly-labelled demo data (including the *.demo staff accounts,
 * whose passwords are published in this repository) may be seeded and used.
 *
 *  - ENABLE_DEMO_SEED=false always disables it.
 *  - On a Vercel *production* deployment it is disabled even if
 *    ENABLE_DEMO_SEED=true was copied over from a development .env, unless
 *    ALLOW_DEMO_SEED_IN_PRODUCTION=true is set deliberately.
 *  - Otherwise ENABLE_DEMO_SEED=true enables it, and the default is "on
 *    everywhere except NODE_ENV=production".
 */
export function isDemoSeedEnabled(): boolean {
  const flag = process.env.ENABLE_DEMO_SEED;
  if (flag === 'false') return false;
  if (process.env.VERCEL_ENV === 'production' && process.env.ALLOW_DEMO_SEED_IN_PRODUCTION !== 'true') return false;
  if (flag === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

/** Demo staff accounts use this reserved domain. */
export const DEMO_EMAIL_DOMAIN = '@chalarfarms.demo';

export function isDemoAccountEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}
