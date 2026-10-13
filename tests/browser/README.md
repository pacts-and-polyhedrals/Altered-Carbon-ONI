# Browser regressions

The runner exercises the module's real UI, crypto and actual Cold Storage source data in Chromium. Foundry documents and ApplicationV2 part replacement are simulated in `oni-regression.mjs`; this is not a licensed Foundry multiplayer test.

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
AC_COLD_PATH=/absolute/path/to/Cold-Storage-source node tests/browser/run.cjs
```

`AC_COLD_PATH` must contain `content-src/pregens.json` and the other Cold Storage source JSON files. Optional `AC_SYSTEM_PATH` supplies the system source fallback. Nothing is imported into a live world. The source data itself is not bundled here.

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `ONI_PLAYWRIGHT_PATH` | Absolute path to an external Playwright package. |
| `ONI_CHROMIUM_EXECUTABLE` | Existing Chromium executable instead of Playwright's installed browser. |
| `ONI_BROWSER_OUTPUT` | Output directory for two screenshots and `result.json`; defaults to the temporary directory. |

Assertions cover aligned actor / dossier selection, Anik-only lifetime and channel release, recipient decryption, untouched unrelated dossiers, previous-life categorization, expanded recognition clues, inner and outer scroll, idle refresh, draft preservation, search focus, narrow-screen overflow and browser errors. The runner closes its browser and local fixture server after completion.
