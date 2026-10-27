/**
 * Whether clearly-labelled demo data (including the *.demo staff accounts,
 * whose passwords are published in this repository) may be seeded and used.
 *
 * The portal runs as a REAL system by default: demo data is strictly opt-in
 * (ENABLE_DEMO_SEED=true) and is never allowed on a Vercel production
 * deployment, whatever the environment variables say.
 */
export function isDemoSeedEnabled(): boolean {
  if (process.env.VERCEL_ENV === 'production') return false;
  return process.env.ENABLE_DEMO_SEED === 'true';
}

/** Demo staff accounts use this reserved domain. */
export const DEMO_EMAIL_DOMAIN = '@chalarfarms.demo';

export function isDemoAccountEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}
