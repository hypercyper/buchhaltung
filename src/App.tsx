import { useEffect, useState } from 'react';
import { getKV, setKV } from './data/db';
import { useEditor } from './entry/editor';
import { EntryForm } from './entry/EntryForm';
import { currentYearMonth, type YearMonth } from './lib/date';
import { EntriesPage } from './pages/EntriesPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { OverviewPage } from './pages/OverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { afterSignIn, clearNotice, startSync, syncNow, useSyncStatus } from './sync/sync';
import { BottomNav } from './ui/BottomNav';
import { ConfirmHost } from './ui/confirm';
import { useHashPath } from './ui/router';
import { ToastHost, showToast } from './ui/toast';

const KEY_ONBOARDED = 'app.onboarded';

export function App({ cameBackFromRedirect }: { cameBackFromRedirect: boolean }) {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [month, setMonth] = useState<YearMonth>(currentYearMonth);
  const path = useHashPath();
  const editor = useEditor();
  const { notice } = useSyncStatus();

  useEffect(() => {
    void navigator.storage?.persist?.();
    void getKV(KEY_ONBOARDED, false).then(setOnboarded);
    if (cameBackFromRedirect) void afterSignIn().then(() => syncNow());
  }, [cameBackFromRedirect]);

  useEffect(() => {
    if (onboarded) void startSync();
  }, [onboarded]);

  useEffect(() => {
    if (!notice) return;
    showToast(notice, undefined, 8000);
    clearNotice();
  }, [notice]);

  if (onboarded === null) return null;

  if (!onboarded) {
    return (
      <>
        <OnboardingPage
          onDone={() => {
            void setKV(KEY_ONBOARDED, true);
            setOnboarded(true);
          }}
        />
        <ToastHost />
      </>
    );
  }

  let page;
  if (path.startsWith('/buchungen')) page = <EntriesPage month={month} onMonthChange={setMonth} />;
  else if (path.startsWith('/berichte')) page = <ReportsPage />;
  else if (path.startsWith('/einstellungen')) page = <SettingsPage sub={path.split('/')[2] ?? ''} />;
  else page = <OverviewPage month={month} onMonthChange={setMonth} />;

  return (
    <>
      <main className="mx-auto max-w-md p-4" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
        {page}
      </main>
      <BottomNav path={path} />
      {editor && <EntryForm key={JSON.stringify(editor)} request={editor} />}
      <ConfirmHost />
      <ToastHost />
    </>
  );
}
