# Changelog

## 1.2.0 — 13 October 2026

- Fix private recipient routing: broad default Owner permission no longer sends a PC's release to every player. Support an explicit per-PC private player selection and keep the header endpoint aligned with the GM dossier selector.
- Replace per-file research / directory / scene jobs with one coalesced encrypted archive per PC. Missing actors or keys leave published data stored in the dossier; initialized off-grid endpoints hold one job. An uninitialized additional owner no longer blocks the ready primary player.
- Retire legacy undelivered archive jobs on upgrade without broadening releases or clearing cancellation decisions. Add a named per-PC rebuild button and persistent archive pause controls.
- Show released current channels immediately in the GM's Contacts preview. Add player Current Channels and Previous Lives views, including ally / enemy / rival / loved-one filters and links to full Research files. Scene handouts populate Evidence.
- Preserve expanded details, inner and outer scroll, search focus and form drafts during updates. Skip unchanged background renders and wait for active editing / actions before refreshing.
- Serialize concurrent decrypts and prevent slower old vault updates from replacing new state. Reject saving transmissions that a newly assigned player never received.
- Default scene and outbox scope to the selected PC. Add explicit delivery status, scoped release summaries, cancellation diagnostics and updated 20-page in-world guides.
- Add real Chromium UI regressions against Anik's actual source data and a second PC's decrypted view. Include a portable browser runner in the source package.

Native Foundry / Forge multiplayer remains untested; `compatibility.verified` remains unset. Detailed results and remaining checks are in `docs/diagnostics.md`, `docs/qa-report.json` and `docs/live-validation.md`.

## 1.1.0 — 13 October 2026

- Automatically prepare all eight Cold Storage PC dossiers, including 160 relationships, 46 lifetimes and 177 source-backed research files.
- Add named per-PC contact lists and separate channel, historical-file and verified-identity releases.
- Add lifetime bulk release, individual file release, player research, personal notes, saved transmissions and GM-authored campaign knowledge.
- Add nine scene / lead contact and evidence bundles, including Marlowe's Anansi House AI channel.
- Bind imported actors automatically, prepare unowned / reserve dossiers, maintain owned teammate channels, and deliver released archives after ownership / key changes.
- Synchronize GM-authored relationship changes while preserving manual hides and ignoring player-authored identity-release triggers.
- Create eight-page player and twelve-page private GM guide journals.
- Add diagnostics, precise waiting reasons, additive repair and manual binding for copied actors.
- Use referenced archive jobs, coalesced directory snapshots and batched encrypted delivery checkpoints. Preserve v1.0.0 encrypted history and include research / dossiers in recovery.
- Keep the install manifest prominent in README and preserve its canonical raw URL in the publishing helper.

Live Foundry / Forge multiplayer and browser-renderer validation remain outstanding; `compatibility.verified` remains unset.

## 1.0.0 — 12 October 2026

Initial standalone ONI interface: token controls / HUD / keybind; per-PC encrypted inboxes; private contact, faction, benefactor and service channels; GM impersonation; calls and shared visual files; evidence, red herrings and analysis; Cold Storage import; native system netrunning, masking, deck bonuses and Depletion; authorization, off-grid / jam state; optional trace clock; endpoint and world backups; automated checks and live-validation guide.

Compatibility targets Foundry 14 and Altered Carbon RPG 2.4.9+. `verified` remains unset pending live server / browser validation.
