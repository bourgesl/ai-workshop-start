import { AtlasError } from './errors.ts';
import { scan, type ScanResult, type Source } from './scan.ts';

export type Account = { id: string; url: string };
export type AccountSource = {
  account: Account;
  repositories: { id: string; url: string; open(): Promise<Source> }[];
};
export type InputSource = Source | AccountSource;
export type RepositoryScan = { id: string; url: string } & (
  { result: ScanResult; error?: never } | { result?: never; error: string }
);
export type AccountResult = { account: Account; repositories: RepositoryScan[]; warnings: string[] };

/** Scan all listed repositories, with at most four repositories in flight. */
export async function scanInput(source: InputSource): Promise<ScanResult | AccountResult> {
  if (!('account' in source)) return scan(source);
  const entries = source.repositories;
  const repositories: RepositoryScan[] = new Array(entries.length);
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const index = next++;
      const { id, url, open } = entries[index];
      try {
        repositories[index] = { id, url, result: await scan(await open()) };
      } catch (error) {
        if (!(error instanceof AtlasError)) throw error;
        repositories[index] = { id, url, error: error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  return {
    account: source.account,
    repositories,
    warnings: repositories.flatMap(({ id, result, error }) =>
      error ? [`${id}: ${error}`] : (result?.warnings ?? []).map((warning) => `${id}: ${warning}`)),
  };
}
