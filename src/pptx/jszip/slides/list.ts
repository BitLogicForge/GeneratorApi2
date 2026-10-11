import type JSZip from 'jszip';
import { deck } from './deck.ts';

/** Actual presentation order, including hidden slides; paths are stable slide handles. */
export async function listSlides(zip: JSZip): Promise<string[]> {
  return (await deck(zip)).entries.map((entry) => entry.path);
}
