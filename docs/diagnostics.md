# ONI workflow diagnostics — v1.1.0

This review used the supplied Altered Carbon RPG 2.4.9 system and Cold Storage 1.9.0 source data. It covers import structure, release workflow, privacy, repeat safety, delivery and UI output. It does not certify live Foundry / Forge browser behavior.

| Finding in v1.0.0 | Implemented change |
| --- | --- |
| Import populated one global directory and left every NPC grant empty. | Eight complete per-PC dossiers with all potential adventure channels and source-backed historical relationships. |
| Roster sync was a separate manual step and rebuilt PC entries. | Automatic stable actor binding and owned, active teammate channels; explicit hides persist. |
| No lifetime research archive existed. | 177 prepared research files, including every supplied lifetime and relationship, plus personal knowledge and saved transmissions. |
| Contact grant editing required repeated checkbox forms. | A named PC selector, historical-name search, direct release buttons, per-file release and bulk lifetime release. |
| Contact recognition could reveal too much at once. | Separate current channel, historical file and verified identity releases. Disputed claims retain their labels. |
| Repeating scene delivery could duplicate evidence. | Nine source-chapter bundles tracked independently for every PC. |
| Unowned PCs could not be prepared for later players. | Unbound and reserve dossiers keep assignments and release intents until binding and ownership. |
| Ownership / browser-key changes needed manual refresh. | Automatic released-library resealing and directory refresh for current owners. |
| Outbox displayed only a generic waiting message. | Specific scheduling, deleted actor, ownership, missing key, off-grid and jam reasons. |
| Full research deliveries could duplicate large payloads in the vault. | Small reference jobs; shared primers stored once; directory jobs coalesce; delivery acknowledgements checkpoint in batches of 12. |
| No in-world instructions or diagnostic view existed. | Eight-page player guide, twelve-page private GM guide, exported diagnostic report and additive repair. |
| The publishing helper could replace the documented manifest URL. | Canonical raw manifest remains prominent in README and stable for main or version-pinned downloads. |

## Source coverage

| PC | Recorded lifetime files | Historical links | Distinct historical contacts |
| --- | ---: | ---: | ---: |
| Nia Calder | 5 (1 disputed) | 20 | 15 |
| Tomas “Latch” Araya | 5 | 20 | 12 |
| Sabine Kade | 6 | 20 | 13 |
| Imani Voss | 7 | 20 | 11 |
| Cass Ren | 5 (1 disputed) | 20 | 11 |
| Dr Edda Sorn | 5 | 20 | 11 |
| Anik Rao | 6 | 20 | 11 |
| Solenne Pryce | 7 | 20 | 13 |
| Total | 46 | 160 | 97 per-PC contact groups |

The 177 research files comprise 8 continuity indexes, 8 private character cards, 46 lifetime files, 97 historical-contact files and 18 shared player primers. Each PC receives its own card and index plus the primers initially. Detailed lifetime / relationship files are prepared but sealed. Eight historical links belong to the two disputed claims; they are retained with warnings.

The potential-contact pool contains the 20 authored NPCs, 6 factions, 3 Benefactors, Marlowe's existing Anansi House channel, 6 newly authored generic service templates and PC channels. Source public cover roles are used in player projections; hidden historical identities, agendas and Benefactor roots stay in the encrypted GM vault until an explicit disclosure.

## Verification and practical limits

The automated suite covers cryptographic isolation, role / ownership checks, staged releases, all source links and lifetimes, off-grid archives, actor import after release, missing keys, changed owners, repeat imports, scene deduplication, GM relationship synchronization, world recovery, batch-checkpoint crash recovery, escaped UI output and actual system implant / deck contracts.

The full-source eight-PC stress fixture releases every assigned research file and creates 303 small delivery intents. Its GM state is approximately **480 KiB**, below the existing **700,000-byte** encrypted record limit. Native HTML-to-text conversion can produce slightly different whitespace sizes; Diagnostics reports the actual world size. Growing custom notes or catalogs still need capacity review. Existing delivered packets stay in world chat history, which must be backed up rather than cleared.

Automatic repair preserves edited ONI content and restores missing source records / guides. It cannot choose between duplicate source actors, assign a player by guesswork, generate another user's private key, undo prior knowledge, or infer that an NPC has been met without a GM disclosure. Scene bundles and the Cold Storage GM relationship dashboard supply those disclosures.

Live v14 / Forge multiplayer and browser rendering remain untested. The manifest omits `compatibility.verified`; use [live-validation.md](live-validation.md) for the native checks. Journal document integration follows the [Foundry v14 JournalEntry API](https://foundryvtt.com/api/v14/classes/foundry.documents.JournalEntry.html), and document metadata follows the [DocumentStatsField API](https://foundryvtt.com/api/v14/classes/foundry.data.fields.DocumentStatsField.html).
