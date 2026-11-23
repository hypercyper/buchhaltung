// First start (PLAN.md §5.1): welcome → Google login (required) → name for PDF header → done.
import { useEffect, useState } from 'react';
import { getAccessToken, getClientId, getPreferredMethod, setPreferredMethod } from '../auth';
import { ensureStartCategories } from '../data/repo';
import { connectGoogle, syncNow } from '../sync/sync';
import { ProfileForm } from './settings/ProfileForm';

type Step = 'welcome' | 'loading' | 'profile';

export function OnboardingPage({ onDone }: { onDone: () => void }) {
  // Back from a redirect login: continue right after the login step.
  const [step, setStep] = useState<Step>(() => (getAccessToken() ? 'loading' : 'welcome'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 'loading') return;
    // Load existing data from Drive first, seed start categories only afterwards
    // (deterministic ids make a double seed harmless anyway).
    void syncNow()
      .then(ensureStartCategories)
      .then(() => setStep('profile'));
  }, [step]);

  async function login() {
    setError('');
    setBusy(true);
    try {
      await connectGoogle();
      setStep('loading');
    } catch {
      setError('Die Anmeldung hat nicht geklappt. Bitte nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  }

  function switchMethod() {
    setPreferredMethod(getPreferredMethod() === 'popup' ? 'redirect' : 'popup');
    setError('Anderer Anmeldeweg ist eingestellt. Bitte jetzt nochmal anmelden.');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      {step === 'welcome' && (
        <>
          <div className="text-center">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="mx-auto mb-4 h-20 w-20 rounded-3xl" />
            <h1 className="text-3xl font-bold">Willkommen!</h1>
            <p className="mt-3 text-lg text-gray-700">
              Hier erfasst du deine Einnahmen und Ausgaben. Die App erstellt daraus Monats- und Jahresübersichten für
              die Steuer.
            </p>
          </div>
          <button className="btn min-h-14 bg-teal-700 text-white" onClick={login} disabled={busy || !getClientId()}>
            {busy ? 'Bitte warten …' : 'Mit Google anmelden'}
          </button>
          <p className="text-center text-gray-600">
            Deine Daten werden in deinem Google Drive gesichert. Die App sieht nur ihre eigene Datei.{' '}
            <a className="underline" href={`${import.meta.env.BASE_URL}datenschutz.html`}>
              Datenschutz
            </a>
          </p>
          {!getClientId() && (
            <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
              Die App ist noch nicht fertig eingerichtet (Google-Zugang fehlt). Bitte melde dich bei Johannes.
            </p>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-red-900">
              <p>{error}</p>
              <button className="mt-2 min-h-11 underline" onClick={switchMethod}>
                Klappt nicht? Anderen Anmeldeweg versuchen
              </button>
            </div>
          )}
        </>
      )}

      {step === 'loading' && <p className="text-center text-lg text-gray-700">Deine Daten werden geladen …</p>}

      {step === 'profile' && (
        <>
          <div>
            <h1 className="text-2xl font-bold">Fast fertig</h1>
            <p className="mt-2 text-gray-700">Wie sollen deine Berichte überschrieben sein? Du kannst das später ändern.</p>
          </div>
          <ProfileForm submitLabel="Fertig" onSaved={onDone} />
        </>
      )}
    </main>
  );
}
