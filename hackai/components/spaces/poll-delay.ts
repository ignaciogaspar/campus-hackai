export const FIRST_POLL_MS = 5_000

export function nextPollDelay(previous: number, changed: boolean): number {
  return changed ? FIRST_POLL_MS : Math.min(previous * 2, 20_000)
}
