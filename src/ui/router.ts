// Hash routing (GitHub Pages has no SPA fallback): #/buchungen, #/einstellungen/kategorien …
import { useEffect, useState } from 'react';

function currentPath(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

export function useHashPath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(path: string): void {
  window.location.hash = path;
}
