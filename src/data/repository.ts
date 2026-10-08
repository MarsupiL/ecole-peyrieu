import { openDB, type IDBPDatabase } from 'idb';
import type { State } from '../domain/types';
import { seed } from './seed';
import { upgradeClassRoster } from './classes';
import { upgradeDemoFrench, sampleFiles, fileHash } from './french';
export interface Repository {
  load(): Promise<State>;
  save(s: State): Promise<void>;
  putBlob(id: string, blob: Blob): Promise<void>;
  blob(id: string): Promise<Blob | undefined>;
  deleteBlob(id: string): Promise<void>;
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
    if (s) {
      const updated = await this.upgradeSampleFiles(upgradeDemoFrench(upgradeClassRoster(s)));
      if (updated !== s) await this.save(updated);
      return updated;
    }
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
    // Byte storage also works in WebKit where persisting a canvas Blob can fail.
    await db.put('files', { bytes: await blob.arrayBuffer(), type: blob.type }, id);
  }
  async blob(id: string) {
    const db = await this.open();
    const stored = (await db.get('files', id)) as
      Blob | { bytes: ArrayBuffer; type: string } | undefined;
    if (!stored) return undefined;
    // Preserve compatibility with files already saved by earlier schema-1 builds.
    return stored instanceof Blob ? stored : new Blob([stored.bytes], { type: stored.type });
  }
  async deleteBlob(id: string) {
    const db = await this.open();
    await db.delete('files', id);
  }
  private async seedFiles(s: State) {
    for (const { id, path } of sampleFiles) {
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
  private async upgradeSampleFiles(s: State): Promise<State> {
    let updated = s;
    for (const { id, path, previousHash } of sampleFiles) {
      if (!s.attachments.some((f) => f.id === id)) continue;
      const previous = await this.blob(id);
      if (!previous || (await fileHash(previous)) !== previousHash) continue;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) continue;
        const blob = await response.blob();
        if (blob.type !== previous.type || (await fileHash(blob)) === previousHash) continue;
        // Only byte-identical shipped samples are replaced, never uploaded files.
        await this.putBlob(id, blob);
        if (updated === s) {
          updated = structuredClone(s);
          updated.revision++;
        }
        updated.attachments.find((f) => f.id === id)!.size = blob.size;
      } catch {
        // An offline visitor keeps the sample; retry the upgrade on a later load.
      }
    }
    return updated;
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
