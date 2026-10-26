import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { defaultDashboardFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PortalIndex() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  redirect(defaultDashboardFor(user));
}
