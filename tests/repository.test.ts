import 'fake-indexeddb/auto';
import { openDB, deleteDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as hashes from '../src/data/french';
import { LocalRepository } from '../src/data/repository';
import { assertStoredState } from '../src/data/stateValidation';
import { seed } from '../src/data/seed';
import { saveDraft, setProfilePhoto } from '../src/domain/engine';
import type { State } from '../src/domain/types';

const repositories: LocalRepository[] = [];
const databases: string[] = [];
const create = (name = crypto.randomUUID()) => {
  databases.push(name);
  const repo = new LocalRepository(name);
  repositories.push(repo);
  return repo;
};
const fixture = () => seed('2026-10-05T08:00:00.000Z');
const sampleFetch = () =>
  vi.fn(
    async (url: string) =>
      new Response('fictional sample bytes', {
        headers: { 'Content-Type': url.endsWith('.png') ? 'image/png' : 'application/pdf' },
      }),
  );
beforeEach(() => vi.stubGlobal('fetch', sampleFetch()));
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(repositories.splice(0).map((repo) => repo.close()));
  await Promise.all([...new Set(databases.splice(0))].map((name) => deleteDB(name)));
});

describe('stored shape and relationships', () => {
  it('accepts current, legacy and rolled-forward optional fields without rewriting input', () => {
    const s = fixture();
    expect(() => assertStoredState(s)).not.toThrow();
    s.seedVersion = 1;
    const copy = structuredClone(s);
    expect(() => assertStoredState(s)).not.toThrow();
    expect(s).toEqual(copy);
  });
  it.each([
    (s: State) => {
      s.children = null as unknown as State['children'];
    },
    (s: State) => {
      s.children[0].dob = '2026-02-31';
    },
    (s: State) => {
      s.adults.push(s.adults[0]);
    },
    (s: State) => {
      s.children[0].guardians = [];
    },
    (s: State) => {
      s.children[0].classId = 'missing';
    },
    (s: State) => {
      s.entries[0].author = 'missing';
    },
    (s: State) => {
      s.attachments[0].owner = 'missing';
    },
    (s: State) => {
      s.revision = NaN;
    },
  ])('rejects malformed state or dangling relationships (%#)', (damage) => {
    const s = fixture();
    damage(s);
    expect(() => assertStoredState(s)).toThrow('storageInvalid');
  });
  it('distinguishes an unsupported version from damaged records', () => {
    expect(() => assertStoredState({ schema: 2 })).toThrow('storageVersion');
    expect(() => assertStoredState({ schema: 1 })).toThrow('storageInvalid');
  });
});

describe('IndexedDB transactions and recovery', () => {
  it('initializes once for simultaneous callers and preserves saved work across repository instances', async () => {
    const name = crypto.randomUUID();
    const repo = create(name);
    const [s, same] = await Promise.all([repo.load(), repo.load()]);
    expect(s).toEqual(same);
    expect(fetch).toHaveBeenCalledTimes(3);
    const next = saveDraft(s, 'alice', 'test', 'kept');
    await repo.save(next, s.revision);
    expect((await create(name).load()).drafts['alice:test']).toBe('kept');
  });
  it('serializes first load in two tabs without replacing the winning dataset', async () => {
    const name = crypto.randomUUID();
    const first = create(name),
      second = create(name);
    const [a, b] = await Promise.all([first.load(), second.load()]);
    expect(a).toEqual(b);
  });
  it('rejects a stale tab atomically and preserves the successful draft', async () => {
    const name = crypto.randomUUID();
    const first = create(name),
      second = create(name);
    const a = await first.load(),
      b = await second.load();
    const results = await Promise.allSettled([
      first.save(saveDraft(a, 'alice', 'test', 'first'), a.revision),
      second.save(saveDraft(b, 'alice', 'test', 'second'), b.revision),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason.message).toBe('storageConflict');
    const stored = await first.load();
    expect(stored.revision).toBe(a.revision + 1);
    expect(['first', 'second']).toContain(stored.drafts['alice:test']);
  });
  it('saves portrait bytes and metadata together, removes old bytes on replacement, and rejects stale file writes', async () => {
    const repo = create();
    const s = await repo.load();
    const target = { kind: 'adult', id: 'alice' } as const;
    const first = new Blob(['first photo'], { type: 'image/jpeg' });
    const one = setProfilePhoto(s, 'alice', target, {
      id: 'one',
      name: 'photo.jpg',
      type: first.type,
      size: first.size,
    });
    await repo.save(one, s.revision, [{ id: 'one', blob: first }]);
    expect(await (await repo.blob('one'))!.text()).toBe('first photo');
    const replacement = new Blob(['second photo'], { type: 'image/jpeg' });
    const two = setProfilePhoto(one, 'alice', target, {
      id: 'two',
      name: 'photo.jpg',
      type: replacement.type,
      size: replacement.size,
    });
    await repo.save(two, one.revision, [{ id: 'two', blob: replacement }]);
    expect(await repo.blob('one')).toBeUndefined();
    await expect(repo.save(one, s.revision, [{ id: 'one', blob: first }])).rejects.toThrow(
      'storageConflict',
    );
    expect(await repo.blob('one')).toBeUndefined();
    expect((await repo.load()).adults.find((a) => a.id === 'alice')!.photoId).toBe('two');
  });
  it('aborts state and files together if IndexedDB fails during a file write', async () => {
    const repo = create();
    const s = await repo.load();
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    const next = setProfilePhoto(
      s,
      'alice',
      { kind: 'adult', id: 'alice' },
      { id: 'broken', name: 'photo.jpg', type: blob.type, size: blob.size },
    );
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      if (this.name === 'files') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    });
    await expect(repo.save(next, s.revision, [{ id: 'broken', blob }])).rejects.toThrow('Full');
    vi.restoreAllMocks();
    expect((await repo.load()).revision).toBe(s.revision);
    expect(await repo.blob('broken')).toBeUndefined();
  });
  it('rejects invalid metadata without changing records or stored bytes', async () => {
    const repo = create();
    const s = await repo.load();
    const next = saveDraft(s, 'alice', 'test', 'not saved');
    await expect(
      repo.save(next, s.revision, [{ id: 'unknown', blob: new Blob(['x']) }]),
    ).rejects.toThrow('storageInvalid');
    expect((await repo.load()).revision).toBe(s.revision);
    expect(await repo.blob('unknown')).toBeUndefined();
  });
  it('preserves corrupt and unsupported stored data instead of silently reseeding', async () => {
    const name = crypto.randomUUID(),
      repo = create(name);
    await repo.load();
    const db = await openDB(name);
    for (const [value, code] of [
      [{ schema: 2, important: 'keep' }, 'storageVersion'],
      [{ schema: 1 }, 'storageInvalid'],
    ] as const) {
      await db.put('state', value, 'current');
      await expect(repo.load()).rejects.toThrow(code);
      expect(await db.get('state', 'current')).toEqual(value);
    }
    db.close();
  });
  it('resets atomically and prevents an earlier tab from resurrecting old work', async () => {
    const repo = create();
    const s = await repo.load();
    const edited = saveDraft(s, 'alice', 'test', 'remove me');
    await repo.save(edited, s.revision);
    const reset = await repo.reset();
    expect(reset.revision).toBeGreaterThan(edited.revision);
    expect(reset.drafts).toEqual({});
    await expect(
      repo.save(saveDraft(edited, 'alice', 'test', 'stale'), edited.revision),
    ).rejects.toThrow('storageConflict');
    expect((await repo.load()).drafts).toEqual({});
  });
  it('retries missing sample files after an offline first load without clearing edits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
    const repo = create();
    const s = await repo.load();
    expect(await repo.blob('sample-photo')).toBeUndefined();
    await repo.save(saveDraft(s, 'alice', 'offline', 'keep'), s.revision);
    vi.stubGlobal('fetch', sampleFetch());
    const loaded = await repo.load();
    expect(loaded.drafts['alice:offline']).toBe('keep');
    expect(await (await repo.blob('sample-photo'))!.text()).toBe('fictional sample bytes');
    expect(await repo.load()).toEqual(loaded);
  });
  it('supports raw Blob records from older WebKit-compatible releases', async () => {
    const name = crypto.randomUUID(),
      repo = create(name);
    await repo.load();
    const db = await openDB(name);
    await db.put('files', new Blob(['legacy'], { type: 'application/pdf' }), 'legacy');
    db.close();
    expect(await (await repo.blob('legacy'))!.text()).toBe('legacy');
  });

  it('rejects new attachment metadata without file bytes and non-advancing revisions', async () => {
    const repo = create();
    const s = await repo.load();
    await expect(repo.save(s, s.revision)).rejects.toThrow('storageInvalid');
    const next = setProfilePhoto(
      s,
      'alice',
      { kind: 'adult', id: 'alice' },
      { id: 'missing', name: 'photo.jpg', type: 'image/jpeg', size: 5 },
    );
    await expect(repo.save(next, s.revision)).rejects.toThrow('storageInvalid');
    expect((await repo.load()).revision).toBe(s.revision);
  });
  it('rolls back a failed reset, retaining the earlier draft and file bytes', async () => {
    const repo = create();
    let s = await repo.load();
    const next = saveDraft(s, 'alice', 'retained', 'survive failed reset');
    await repo.save(next, s.revision);
    s = next;
    const before = await (await repo.blob('sample-photo'))!.text();
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      if (this.name === 'files') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    });
    await expect(repo.reset()).rejects.toThrow('Full');
    vi.restoreAllMocks();
    expect(await repo.load()).toEqual(s);
    expect(await (await repo.blob('sample-photo'))!.text()).toBe(before);
  });
  it('upgrades legacy text/classes once and replaces only recognized original sample bytes', async () => {
    const name = crypto.randomUUID(),
      repo = create(name);
    const s = await repo.load();
    const old = structuredClone(s);
    old.seedVersion = 1;
    old.children[0].collectors = 'Responsables légaux / Legal guardians';
    old.drafts['alice:custom'] = 'A custom draft';
    const db = await openDB(name);
    await db.put('state', old, 'current');
    await db.put('files', new Blob(['old sample'], { type: 'image/png' }), 'sample-photo');
    db.close();
    const originalHash = hashes.fileHash;
    vi.spyOn(hashes, 'fileHash').mockImplementation(async (blob) =>
      (await blob.text()) === 'old sample'
        ? hashes.sampleFiles[0].previousHash
        : originalHash(blob),
    );
    const updated = await repo.load();
    expect(updated.seedVersion).toBe(2);
    expect(updated.children[0].collectors).toBe('Responsables légaux');
    expect(updated.drafts['alice:custom']).toBe('A custom draft');
    expect(await (await repo.blob('sample-photo'))!.text()).toBe('fictional sample bytes');
    expect(await repo.load()).toEqual(updated);
  });
});
