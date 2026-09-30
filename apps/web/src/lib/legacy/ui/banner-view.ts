import { el } from './keyboard';
import type { Screen } from './screen';

/** Full-screen interstitial: act titles and boss intros. */
export class BannerScreen implements Screen {
  readonly root = el('div', 'screen banner');
  private ready = false;

  constructor(
    kicker: string,
    title: string,
    sub: string,
    private done: () => void,
    glyph = '',
  ) {
    if (glyph) this.root.append(el('div', 'banner-glyph', glyph));
    this.root.append(
      el('div', 'banner-kicker', kicker),
      el('h1', 'banner-title', title),
      el('p', 'banner-sub', sub),
      el('p', 'skip', 'press ENTER'),
    );
    this.root.addEventListener('click', () => this.onKey('Enter'));
    // Ignore the Enter that got us here.
    setTimeout(() => (this.ready = true), 250);
  }

  onKey(key: string): void {
    if (this.ready && key === 'Enter') this.done();
  }
}
