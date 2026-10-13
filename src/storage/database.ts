import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PersistedJob, TranscriptSegment } from '../domain/types';

interface TranscriptorSchema extends DBSchema {
  jobs: {
    key: string;
    value: PersistedJob;
    indexes: { 'by-updated': number };
  };
  segments: {
    key: [string, number];
    value: TranscriptSegment;
    indexes: { 'by-job': string };
  };
}

let databasePromise: Promise<IDBPDatabase<TranscriptorSchema>> | undefined;

function database(): Promise<IDBPDatabase<TranscriptorSchema>> {
  databasePromise ??= openDB<TranscriptorSchema>('transcriptor-web-local', 1, {
    upgrade(db) {
      const jobs = db.createObjectStore('jobs', { keyPath: 'id' });
      jobs.createIndex('by-updated', 'updatedAt');
      const segments = db.createObjectStore('segments', { keyPath: ['jobId', 'index'] });
      segments.createIndex('by-job', 'jobId');
    },
  });
  return databasePromise;
}

export async function listJobs(): Promise<PersistedJob[]> {
  const db = await database();
  const jobs = await db.getAllFromIndex('jobs', 'by-updated');
  return jobs.reverse();
}

export async function saveJob(job: PersistedJob): Promise<void> {
  const db = await database();
  await db.put('jobs', job);
}

export async function getSegments(jobId: string): Promise<TranscriptSegment[]> {
  const db = await database();
  return db.getAllFromIndex('segments', 'by-job', jobId);
}

export async function commitSegment(job: PersistedJob, segment: TranscriptSegment): Promise<void> {
  const db = await database();
  const transaction = db.transaction(['jobs', 'segments'], 'readwrite');
  await Promise.all([
    transaction.objectStore('segments').put(segment),
    transaction.objectStore('jobs').put(job),
    transaction.done,
  ]);
}

export async function saveEditedSegment(segment: TranscriptSegment): Promise<void> {
  const db = await database();
  await db.put('segments', segment);
}

export async function deleteJob(jobId: string): Promise<void> {
  const db = await database();
  const transaction = db.transaction(['jobs', 'segments'], 'readwrite');
  const segmentStore = transaction.objectStore('segments');
  let cursor = await segmentStore.index('by-job').openKeyCursor(IDBKeyRange.only(jobId));
  while (cursor) {
    await segmentStore.delete(cursor.primaryKey);
    cursor = await cursor.continue();
  }
  await transaction.objectStore('jobs').delete(jobId);
  await transaction.done;
}

export async function clearAllData(): Promise<void> {
  const db = await database();
  const transaction = db.transaction(['jobs', 'segments'], 'readwrite');
  await Promise.all([
    transaction.objectStore('jobs').clear(),
    transaction.objectStore('segments').clear(),
    transaction.done,
  ]);
}
