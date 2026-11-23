import type { ReactNode } from 'react';
import { navigate } from '../../ui/router';

export function SubPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <button className="icon-btn" aria-label="Zurück zu den Einstellungen" onClick={() => navigate('/einstellungen')}>
          ‹
        </button>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
}
