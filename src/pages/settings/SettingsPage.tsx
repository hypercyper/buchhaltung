import { navigate } from '../../ui/router';
import { showToast } from '../../ui/toast';
import { AccountPage } from './AccountPage';
import { CategoriesPage } from './CategoriesPage';
import { FavoritesPage } from './FavoritesPage';
import { HelpPage } from './HelpPage';
import { ProfileForm } from './ProfileForm';
import { SubPage } from './SubPage';

const MENU = [
  { path: 'kategorien', label: 'Kategorien' },
  { path: 'favoriten', label: 'Favoriten' },
  { path: 'angaben', label: 'Meine Angaben' },
  { path: 'konto', label: 'Google-Konto & Sicherung' },
  { path: 'hilfe', label: 'Hilfe' },
];

export function SettingsPage({ sub }: { sub: string }) {
  switch (sub) {
    case 'kategorien':
      return <CategoriesPage />;
    case 'favoriten':
      return <FavoritesPage />;
    case 'konto':
      return <AccountPage />;
    case 'hilfe':
      return <HelpPage />;
    case 'angaben':
      return (
        <SubPage title="Meine Angaben">
          <ProfileForm submitLabel="Speichern" onSaved={() => showToast('Gespeichert')} />
        </SubPage>
      );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Einstellungen</h1>
      <ul className="card divide-y divide-gray-100 py-1">
        {MENU.map((item) => (
          <li key={item.path}>
            <button
              className="flex min-h-14 w-full items-center justify-between text-left text-lg"
              onClick={() => navigate(`/einstellungen/${item.path}`)}
            >
              {item.label}
              <span className="text-2xl text-gray-400" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-gray-500">App-Version {__APP_VERSION__}</p>
    </div>
  );
}
