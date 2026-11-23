import { navigate } from './router';

const ITEMS = [
  { path: '/', label: 'Übersicht', icon: '🏠' },
  { path: '/buchungen', label: 'Buchungen', icon: '📋' },
  { path: '/berichte', label: 'Berichte', icon: '📄' },
  { path: '/einstellungen', label: 'Einstellungen', icon: '⚙️' },
];

export function BottomNav({ path }: { path: string }) {
  const active = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md md:max-w-2xl">
        {ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            aria-current={active(item.path) ? 'page' : undefined}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
              active(item.path) ? 'font-bold text-teal-800' : 'text-gray-600'
            }`}
          >
            <span className="text-xl" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
