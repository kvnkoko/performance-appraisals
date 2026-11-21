/**
 * While an admin is using "View as", the app must not change any data. Every write path calls
 * assertWritable(), and the Supabase client refuses writes as a second line of defence.
 */
export class ReadOnlyModeError extends Error {
  constructor() {
    super('You are viewing the app as someone else, which is read-only. Exit "View as" to make changes.');
    this.name = 'ReadOnlyModeError';
  }
}

let readOnly = false;

export function setReadOnlyMode(on: boolean): void {
  readOnly = on;
}

export function isReadOnlyMode(): boolean {
  return readOnly;
}

export function assertWritable(): void {
  if (readOnly) throw new ReadOnlyModeError();
}
