# Credits and third-party licenses

Keycraft's code is MIT-licensed (see [LICENSE](../LICENSE)). Everything the game ships besides its own code is listed
here with its license. All of these licenses allow Keycraft to be open source and redistributed.

| What                    | Source                                                         | License                        |
| ----------------------- | -------------------------------------------------------------- | ------------------------------ |
| Cinzel (display font)   | Natanael Gama, via `@fontsource-variable/cinzel`               | SIL Open Font License 1.1      |
| Alegreya Sans (text)    | Huerta Tipográfica, via `@fontsource/alegreya-sans`            | SIL Open Font License 1.1      |
| Cormorant Garamond      | Christian Thalmann, via `@fontsource/cormorant-garamond`       | SIL Open Font License 1.1      |
| JetBrains Mono (typing) | JetBrains, via `@fontsource-variable/jetbrains-mono`           | SIL Open Font License 1.1      |
| English word list       | `wordlist-english` by Jackson Ray Hamilton, derived from SCOWL | MIT; SCOWL's permissive notice |
| Practice quotes         | Works in the public domain (sources shown with each quote)     | Public domain                  |
| Sound and music         | Synthesized at runtime with the Web Audio API; no audio files  | Part of Keycraft (MIT)         |
| Art (glyphs, ornaments) | Drawn in CSS and SVG in this repository                        | Part of Keycraft (MIT)         |

The filtered word list lives in `packages/engine/src/content/words.json`. It comes from SCOWL (Copyright 2000-2016 by
Kevin Atkinson, and the other copyright holders it names). SCOWL's notice asks for its copyright and permission text
to travel with the words, so the full text is in [licenses/SCOWL.txt](licenses/SCOWL.txt).

If you add an asset, add a row here, and make sure its license is compatible with MIT redistribution. If you
contribute commissioned art that can't be relicensed, keep it in a separate folder with its own license file.
