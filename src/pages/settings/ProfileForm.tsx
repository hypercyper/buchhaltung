// "Meine Angaben" – used in settings and in onboarding.
import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../data/repo';

export function ProfileForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [showNote, setShowNote] = useState(true);

  useEffect(() => {
    void getSettings().then((s) => {
      setOwnerName(s.ownerName);
      setBusinessName(s.businessName);
      setAddress(s.address);
      setShowNote(s.showKleinunternehmerNote);
      setLoaded(true);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await saveSettings({ ownerName: ownerName.trim(), businessName: businessName.trim(), address: address.trim(), showKleinunternehmerNote: showNote });
    onSaved();
  }

  if (!loaded) return null;
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="p-name">Dein Name</label>
        <input id="p-name" className="field" autoComplete="name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="p-business">Firmenname (freiwillig)</label>
        <input id="p-business" className="field" autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="p-address">Adresse (freiwillig)</label>
        <textarea
          id="p-address"
          className="field"
          rows={3}
          autoComplete="street-address"
          placeholder={'Straße Nr.\nPLZ Ort'}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <label className="flex min-h-12 items-start gap-3">
        <input type="checkbox" className="mt-1 h-6 w-6 accent-teal-700" checked={showNote} onChange={(e) => setShowNote(e.target.checked)} />
        <span>
          Hinweis „Kleinunternehmerin gem. § 19 UStG“ in den Berichten anzeigen
          <span className="block text-sm text-gray-600">Bedeutet: Du weist keine Umsatzsteuer aus.</span>
        </span>
      </label>
      <p className="text-sm text-gray-600">Diese Angaben stehen oben in deinen PDF-Berichten.</p>
      <button type="submit" className="btn bg-teal-700 text-white">
        {submitLabel}
      </button>
    </form>
  );
}
