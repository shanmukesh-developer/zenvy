"use client";

// App sections (owner, 24 Nov 2026): one place to turn each part of the customer app on or off.
// Backend: GET / PUT /api/admin/app-sections (backend/utils/appSections). Same card as Settings > Feature switches.
import { useAdminAuth } from '@/utils/useAdminAuth';
import { LoadingState, PageHeader } from '@/components/ui';
import LaunchSwitchesCard from '@/components/config/LaunchSwitchesCard';

export default function AppSectionsPage() {
  const { isAuthed } = useAdminAuth();
  if (!isAuthed) return <LoadingState />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="App sections" description="Turn each part of the customer app on or off. Students see a change the next time they open or refresh the app." />
      <LaunchSwitchesCard />
    </div>
  );
}
