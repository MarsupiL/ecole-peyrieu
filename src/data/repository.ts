import { openDB, type IDBPDatabase } from 'idb';
import type { State } from '../domain/types';
import { seed } from './seed';
export interface Repository {
  load(): Promise<State>;
  save(s: State): Promise<void>;
  putBlob(id: string, blob: Blob): Promise<void>;
  blob(id: string): Promise<Blob | undefined>;
  reset(): Promise<State>;
}
const DB = 'peyrieu-school-demo-v1';
export class LocalRepository implements Repository {
  private db?: IDBPDatabase;
  private async open() {
    return (this.db ??= await openDB(DB, 1, {
      upgrade(db) {
        db.createObjectStore('state');
        db.createObjectStore('files');
      },
    }));
  }
  async load() {
    const db = await this.open();
    const s = (await db.get('state', 'current')) as State | undefined;
    if (s && s.schema !== 1) throw new Error('storageVersion');
    if (s) return s;
    const initial = seed();
    await this.seedFiles(initial);
    await this.save(initial);
    return initial;
  }
  async save(s: State) {
    const db = await this.open();
    await db.put('state', s, 'current');
  }
  async putBlob(id: string, blob: Blob) {
    const db = await this.open();
    await db.put('files', blob, id);
  }
  async blob(id: string) {
    const db = await this.open();
    return db.get('files', id) as Promise<Blob | undefined>;
  }
  private async seedFiles(s: State) {
    for (const [id, path] of [
      ['sample-photo', 'sample-image.png'],
      ['sample-evidence', 'sample-evidence.pdf'],
      ['sample-work', 'sample-worksheet.pdf'],
    ]) {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) continue;
        const blob = await response.blob();
        await this.putBlob(id, blob);
        const f = s.attachments.find((f) => f.id === id);
        if (f) f.size = blob.size;
      } catch {
        /* The UI reports a missing sample if first-load networking fails. */
      }
    }
  }
  async reset() {
    const db = await this.open();
    const tx = db.transaction(['state', 'files'], 'readwrite');
    await tx.objectStore('files').clear();
    await tx.objectStore('state').clear();
    await tx.done;
    const s = seed();
    await this.seedFiles(s);
    await this.save(s);
    return s;
  }
}
export const repository = new LocalRepository();
