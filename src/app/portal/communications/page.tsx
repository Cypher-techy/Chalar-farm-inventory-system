import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { PageHeader } from '@/components/portal/ui';
import ChatWorkspace from './chat-workspace';

export const dynamic = 'force-dynamic';

export default async function CommunicationsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.communications')) redirect('/portal/workspaces');

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: 'Portal', href: '/portal' },
          { label: 'Private Communications' },
        ]}
        title="Private Internal Communications"
        subtitle="End-to-end access-controlled conversations — only conversation participants can read, search, or reply. Message content never appears in global search or unauthorized notifications."
      />
      <Suspense fallback={<div className="p-10 text-center text-sm text-stone-400">Loading workspace…</div>}>
        <ChatWorkspace
          me={{ id: user.id, fullName: user.fullName, canInitiateAny: user.permissions.includes('communications.initiate_any') }}
        />
      </Suspense>
    </div>
  );
}
