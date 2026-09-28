export interface Screen {
  readonly root: HTMLElement;
  /** `key` is normalized: lowercase letters, or names like 'Enter', 'Escape', 'Backspace'. */
  onKey(key: string): void;
  mounted?(): void;
  unmount?(): void;
}
