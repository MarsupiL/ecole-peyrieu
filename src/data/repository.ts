import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { State } from '../domain/types';
import { seed } from './seed';
import { upgradeClassRoster } from './classes';
import { upgradeDemoFrench, sampleFiles, fileHash } from './french';
import { assertStoredState, StorageError } from './stateValidation';

export interface FileWrite {
  id: string;
  blob: Blob;
}
type StoredFile = { bytes: ArrayBuffer; type: string };
interface DemoDatabase extends DBSchema {
  state: { key: string; value: unknown };
  files: { key: string; value: StoredFile | Blob };
}
export interface Repository {
  load(): Promise<State>;
  save(s: State, expectedRevision: number, files?: FileWrite[]): Promise<void>;
  blob(id: string): Promise<Blob | undefined>;
  reset(): Promise<State>;
}
const DB = 'peyrieu-school-demo-v1';
export class LocalRepository implements Repository {
  private connection?: Promise<IDBPDatabase<DemoDatabase>>;
  private loading?: Promise<State>;
  constructor(private readonly databaseName = DB) {}
  private open() {
    return (this.connection ??= openDB<DemoDatabase>(this.databaseName, 1, {
      upgrade(db) {
        db.createObjectStore('state');
        db.createObjectStore('files');
      },
      blocking: () => {
        void this.close();
      },
      terminated: () => {
        this.connection = undefined;
      },
    }).catch((error: unknown) => {
      this.connection = undefined;
      throw error;
    }));
  }
  async close() {
    const connection = this.connection;
    this.connection = undefined;
    (await connection)?.close();
  }
  load(): Promise<State> {
    // React StrictMode and simultaneous callers share initialization/migration work.
    return (this.loading ??= this.read().finally(() => {
      this.loading = undefined;
    }));
  }
  private async read(): Promise<State> {
    const db = await this.open();
    for (let attempt = 0; attempt < 3; attempt++) {
      const stored: unknown = await db.get('state', 'current');
      if (stored !== undefined) assertStoredState(stored);
      const original = stored ?? seed();
      const s = upgradeDemoFrench(upgradeClassRoster(original));
      const files = await this.prepareSamples(s, stored === undefined);
      const next = files.length ? structuredClone(s) : s;
      for (const file of files)
        next.attachments.find((f) => f.id === file.id)!.size = file.blob.size;
      if (stored && files.length && next.revision === stored.revision) next.revision++;
      if (stored && next === stored) return stored;
      try {
        await this.commit(next, stored?.revision, files);
        return next;
      } catch (error) {
        if (!(error instanceof StorageError) || error.code !== 'storageConflict') throw error;
        // Another tab completed initialization/migration first. Read its version.
      }
    }
    throw new StorageError('storageConflict');
  }
  async save(s: State, expectedRevision: number, files: FileWrite[] = []) {
    if (!Number.isSafeInteger(expectedRevision) || s.revision <= expectedRevision)
      throw new StorageError('storageInvalid');
    await this.commit(s, expectedRevision, files);
  }
  private async commit(s: State, expectedRevision: number | undefined, files: FileWrite[]) {
    assertStoredState(s);
    const prepared = await this.encodeFiles(s, files);
    const db = await this.open();
    const tx = db.transaction(['state', 'files'], 'readwrite');
    try {
      const current: unknown = await tx.objectStore('state').get('current');
      if (current !== undefined) assertStoredState(current);
      if (current?.revision !== expectedRevision) throw new StorageError('storageConflict');
      if (current) {
        for (const f of s.attachments)
          if (
            !current.attachments.some((old) => old.id === f.id) &&
            !prepared.some((upload) => upload.id === f.id) &&
            !(await tx.objectStore('files').get(f.id))
          )
            throw new StorageError('storageInvalid');
      }
      // State, file bytes and removal of replaced portraits commit or abort together.
      for (const f of current?.attachments ?? [])
        if (!s.attachments.some((next) => next.id === f.id))
          await tx.objectStore('files').delete(f.id);
      for (const { id, file } of prepared) await tx.objectStore('files').put(file, id);
      await tx.objectStore('state').put(s, 'current');
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The transaction may already have aborted. */
      }
      await tx.done.catch(() => {});
      throw error;
    }
  }
  private async encodeFiles(s: State, files: FileWrite[]) {
    if (new Set(files.map((f) => f.id)).size !== files.length)
      throw new StorageError('storageInvalid');
    return Promise.all(
      files.map(async ({ id, blob }) => {
        const metadata = s.attachments.find((f) => f.id === id);
        if (!metadata || metadata.size !== blob.size || metadata.type !== blob.type)
          throw new StorageError('storageInvalid');
        return { id, file: { bytes: await blob.arrayBuffer(), type: blob.type } };
      }),
    );
  }
  async blob(id: string): Promise<Blob | undefined> {
    const db = await this.open();
    const stored = await db.get('files', id);
    if (!stored) return undefined;
    // Preserve raw Blobs from older builds and byte storage required by WebKit.
    return stored instanceof Blob ? stored : new Blob([stored.bytes], { type: stored.type });
  }
  private async prepareSamples(s: State, initial: boolean): Promise<FileWrite[]> {
    const files: FileWrite[] = [];
    for (const { id, path, previousHash } of sampleFiles) {
      const metadata = s.attachments.find((f) => f.id === id);
      if (!metadata) continue;
      const previous = initial ? undefined : await this.blob(id);
      if (previous && (await fileHash(previous)) !== previousHash) continue;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) continue;
        const blob = await response.blob();
        if (blob.type !== metadata.type || !blob.size) continue;
        if (previous && (await fileHash(blob)) === previousHash) continue;
        files.push({ id, blob });
      } catch {
        // First-load/offline failures retain data; missing samples retry on next load.
      }
    }
    return files;
  }
  async reset(): Promise<State> {
    const s = seed();
    const files = await this.prepareSamples(s, true);
    for (const f of files) s.attachments.find((a) => a.id === f.id)!.size = f.blob.size;
    const prepared = await this.encodeFiles(s, files);
    assertStoredState(s);
    const db = await this.open();
    const tx = db.transaction(['state', 'files'], 'readwrite');
    try {
      const previous = await tx.objectStore('state').get('current');
      // Keep revisions monotonic so an old tab cannot resurrect pre-reset records.
      if (
        previous &&
        typeof previous === 'object' &&
        'revision' in previous &&
        typeof previous.revision === 'number' &&
        Number.isSafeInteger(previous.revision)
      )
        s.revision = Math.max(0, previous.revision) + 1;
      await tx.objectStore('files').clear();
      for (const { id, file } of prepared) await tx.objectStore('files').put(file, id);
      await tx.objectStore('state').put(s, 'current');
      await tx.done;
      return s;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* Already aborted. */
      }
      await tx.done.catch(() => {});
      throw error;
    }
  }
}
export const repository: Repository = new LocalRepository();
