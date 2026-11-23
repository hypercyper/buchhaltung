import { describe, expect, it } from 'vitest';
import { mergeRecords, mergeSyncFiles, sameContent, validateSyncFile } from './merge';
import { DEFAULT_SETTINGS, type SyncFile } from '../data/types';

const rec = (id: string, updatedAt: string, extra: object = {}) => ({ id, updatedAt, deleted: false, ...extra });

function file(p: Partial<SyncFile>): SyncFile {
  return { schemaVersion: 1, entries: [], categories: [], favorites: [], settings: DEFAULT_SETTINGS, lastWriteAt: '', ...p };
}

describe('mergeRecords', () => {
  it('unions records from both sides', () => {
    const merged = mergeRecords([rec('a', 't1')], [rec('b', 't1')]);
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('newer updatedAt wins in both directions', () => {
    const local = [rec('a', '2026-01-02T00:00:00Z', { v: 'local' }), rec('b', '2026-01-01T00:00:00Z', { v: 'local' })];
    const remote = [rec('a', '2026-01-01T00:00:00Z', { v: 'remote' }), rec('b', '2026-01-03T00:00:00Z', { v: 'remote' })];
    const merged = Object.fromEntries(mergeRecords(local, remote).map((r) => [r.id, r.v]));
    expect(merged).toEqual({ a: 'local', b: 'remote' });
  });

  it('deletion on one device reaches the other (tombstone newer)', () => {
    const local = [rec('a', '2026-01-01T00:00:00Z')];
    const remote = [{ ...rec('a', '2026-01-05T00:00:00Z'), deleted: true }];
    expect(mergeRecords(local, remote)[0].deleted).toBe(true);
  });

  it('edit after deletion revives the record (later write wins)', () => {
    const local = [rec('a', '2026-01-06T00:00:00Z', { v: 'edited' })];
    const remote = [{ ...rec('a', '2026-01-05T00:00:00Z'), deleted: true }];
    const [merged] = mergeRecords(local, remote);
    expect(merged.deleted).toBe(false);
  });

  it('is order independent (two devices converge)', () => {
    const a = [rec('x', '2026-01-02T00:00:00Z', { v: 1 }), rec('y', '2026-01-01T00:00:00Z', { v: 1 })];
    const b = [rec('x', '2026-01-01T00:00:00Z', { v: 2 }), rec('y', '2026-01-03T00:00:00Z', { v: 2 }), rec('z', 't', { v: 2 })];
    const sort = (rs: { id: string }[]) => [...rs].sort((p, q) => p.id.localeCompare(q.id));
    expect(sort(mergeRecords(a, b))).toEqual(sort(mergeRecords(b, a)));
  });
});

describe('mergeSyncFiles', () => {
  it('returns local when remote is missing', () => {
    const local = file({ entries: [] });
    expect(mergeSyncFiles(local, null)).toBe(local);
  });

  it('settings: last write wins', () => {
    const local = file({ settings: { ...DEFAULT_SETTINGS, ownerName: 'Alt', updatedAt: '2026-01-01T00:00:00Z' } });
    const remote = file({ settings: { ...DEFAULT_SETTINGS, ownerName: 'Neu', updatedAt: '2026-02-01T00:00:00Z' } });
    expect(mergeSyncFiles(local, remote).settings.ownerName).toBe('Neu');
    expect(mergeSyncFiles(remote, local).settings.ownerName).toBe('Neu');
  });

  it('sameContent ignores order and lastWriteAt', () => {
    const a = file({ categories: [rec('a', 't') as never, rec('b', 't') as never], lastWriteAt: '1' });
    const b = file({ categories: [rec('b', 't') as never, rec('a', 't') as never], lastWriteAt: '2' });
    expect(sameContent(a, b)).toBe(true);
    expect(sameContent(a, file({}))).toBe(false);
  });
});

describe('validateSyncFile', () => {
  it('rejects foreign files', () => {
    expect(() => validateSyncFile({ foo: 1 })).toThrow('keine gültige');
    expect(() => validateSyncFile(null)).toThrow();
  });
  it('fills missing optional parts', () => {
    const f = validateSyncFile({ schemaVersion: 1, entries: [] });
    expect(f.categories).toEqual([]);
    expect(f.settings.showKleinunternehmerNote).toBe(true);
  });
});
