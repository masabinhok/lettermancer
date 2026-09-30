import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

/** Navigate within the app. Paths are checked against the real routes, query strings included. */
export function nav(...route: Parameters<typeof resolve>): void {
  void goto(resolve(...route));
}
