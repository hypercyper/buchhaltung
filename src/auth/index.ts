import { AuthMethod, AuthProvider } from './auth';
import { gisProvider } from './gisProvider';
import { redirectProvider } from './redirectProvider';

export * from './auth';
export { consumeRedirectResult, redirectUri } from './redirectProvider';

export function getAuthProvider(method: AuthMethod): AuthProvider {
  return method === 'redirect' ? redirectProvider : gisProvider;
}
