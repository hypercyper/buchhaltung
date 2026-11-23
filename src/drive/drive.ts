// Minimal Drive REST v3 client. Scope drive.file: only files created by this app are visible.

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export class DriveError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
  /** Token missing/expired → user must reconnect. */
  get needsAuth(): boolean {
    return this.status === 401;
  }
}

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
  /** Monotonic revision counter; used for conflict detection before upload. */
  version?: string;
  trashed?: boolean;
}

const META_FIELDS = 'id,name,modifiedTime,version,trashed';

/** File metadata, or null if the file no longer exists (deleted). */
export async function getFileMeta(token: string, fileId: string): Promise<DriveFileMeta | null> {
  try {
    const response = await call(token, `${API}/${fileId}?fields=${META_FIELDS}`);
    return (await response.json()) as DriveFileMeta;
  } catch (error) {
    if (error instanceof DriveError && error.status === 404) return null;
    throw error;
  }
}

/** E-mail address of the connected Google account (works with drive.file scope). */
export async function getAccountEmail(token: string): Promise<string> {
  const response = await call(token, 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
  const body = (await response.json()) as { user?: { emailAddress?: string } };
  return body.user?.emailAddress ?? '';
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (!response.ok) {
    throw new DriveError(response.status, `Drive ${response.status}: ${await response.text()}`);
  }
  return response;
}

export async function findFileByName(token: string, name: string): Promise<DriveFileMeta | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  const params = new URLSearchParams({ q, fields: `files(${META_FIELDS})`, spaces: 'drive' });
  const response = await call(token, `${API}?${params}`);
  const body = (await response.json()) as { files: DriveFileMeta[] };
  return body.files[0] ?? null;
}

function multipartBody(metadata: object, content: string): { body: string; contentType: string } {
  const boundary = `b${crypto.randomUUID()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${boundary}--`;
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export async function createJsonFile(token: string, name: string, data: unknown): Promise<DriveFileMeta> {
  const { body, contentType } = multipartBody({ name, mimeType: 'application/json' }, JSON.stringify(data));
  const response = await call(token, `${UPLOAD}?uploadType=multipart&fields=${META_FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
  return (await response.json()) as DriveFileMeta;
}

export async function updateJsonFile(token: string, fileId: string, data: unknown): Promise<DriveFileMeta> {
  const response = await call(token, `${UPLOAD}/${fileId}?uploadType=media&fields=${META_FIELDS}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
  });
  return (await response.json()) as DriveFileMeta;
}

export async function readJsonFile<T>(token: string, fileId: string): Promise<T> {
  const response = await call(token, `${API}/${fileId}?alt=media`);
  return (await response.json()) as T;
}
