# ONI workflow diagnostics — v1.2.0

This review reproduced the 1.1.0 recipient, outbox, archive-section and list-reset defects using the supplied Altered Carbon RPG 2.4.9 and Cold Storage 1.9.0 data. The published runtime matched the previous supplied build. Verification includes real Chromium DOM and WebCrypto with simulated Foundry documents; a licensed Foundry / Forge multiplayer session was unavailable.

| Finding in v1.1.0 | Implemented change |
| --- | --- |
| Broad default Owner permissions treated every user as a private recipient. | Assigned characters and explicit ownership determine private recipients; a per-PC player picker provides an exact override. Encryption includes only eligible initialized recipients and registered GMs. |
| Releasing one dossier traversed unrelated unfinished libraries. | Release actions queue only their selected dossier. Unrelated lifetime and NPC grants remain unchanged; background starter synchronization stays silent. |
| The header actor and dossier selector could describe different PCs. | Both selectors stay aligned; native actor IDs optionally guard against stale requests. Scope and actual private recipients are visible. |
| Research required one queued delivery per file and could wait on an uninitialized additional owner. | One coalesced archive per initialized PC; missing keys leave released data stored in the dossier. A ready primary player can receive immediately. |
| GM Contacts / Research depended on successful delivery to a player. | GM views preview canonical published data immediately. Player views continue to require actual private delivery. |
| Historical files never appeared as a contact section. | Contacts has Current Channels and Previous Lives, searchable category views and full Research links. |
| Periodic DOM replacement reset expanded clues and list scrolling. | Capture and restore details, inner / outer scroll, focus and dirty drafts; avoid idle rerenders and defer updates while editing. |
| Concurrent native hooks raced decrypts; old decrypts could overwrite new state. | Shared in-flight decrypt promises and signature rechecks keep the newest state. |
| Cancelled file jobs could be regenerated during repair. | Persistent archive pauses survive repair. Targeted rebuild deliberately resumes only one PC's released collection. |
| Scene recipient defaults selected the entire roster. | Start with the currently selected PC checked; additional recipients require deliberate selection. |
| A newly assigned player could request saving a packet decrypted only by the GM. | Saving requires that player's key to be an actual recipient of the original transmission. |
| Instructions described the previous queue mechanics. | Upgrade the existing 20-page journals and document private routing, correct destinations, pauses and Anik recovery. |

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

All **75 automated tests pass**, with no skips, including actual supplied source and system contracts. Coverage includes cryptographic isolation, broad default ownership, staged releases, every source link / lifetime, off-grid archives, late actor import, missing keys, changed owners, repeat imports, scenes, GM reveals, recovery, native delivery failures, crash deduplication and native implant / deck mechanics.

The Chromium **153.0.8010.0** regression uses eight actual source PCs with deliberately permissive default ownership. It selects Anik through the real dropdowns, releases his lifetime / historical collection and current channels, then independently decrypts Anik's and Nia's player views. Anik receives **37 research files** (20 starters + 6 lifetimes + 11 relationship files), **11 historical-contact cards**, and **43 current channels** after the deliberate all-channel release. Nia retains 20 starters, 7 teammate channels and no historical files; the other six dossiers gain no lifetime or NPC grants. Expanded recognition clues, both scroll positions, historical enemy cards, edited drafts and search focus remain stable. Idle cycles do not rerender; a 650-pixel viewport has zero horizontal overflow and no browser errors.

The full-source eight-PC stress fixture releases every assigned research file and creates **8 archive references**, one per PC, replacing the previous 303 per-file intents. Its GM state is **404,035 bytes**, below the **700,000-byte** encrypted record limit. No archive bodies are duplicated in Outbox. Native HTML-to-text conversion can change whitespace size; Diagnostics reports actual world usage. Delivered versions remain in world chat history.

The upgrade retires obsolete directory / research / scene archive references without broadening sealed knowledge or resuming cancelled files. Ordinary message and call jobs remain. Automatic repair preserves edits and cancellations. To recover Anik after deleting his queued files, select PC07, check the exact player, and use **Rebuild Anik Rao’s released archive**. It resumes already released material for PC07 only. Current cards populate Contacts → Current Channels, relationship history populates Previous Lives and Research, lifetime records populate Research, and handouts populate Evidence. Rebuild does not verify identities or reveal sealed files.

A live v14 / Forge multiplayer session remains untested. The real browser fixture simulates ApplicationV2 rendering, hooks and document permissions; it cannot certify native server behavior. The manifest omits `compatibility.verified`. Use [live-validation.md](live-validation.md) for those checks; [qa-report.json](qa-report.json) records completed verification and [../tests/browser/README.md](../tests/browser/README.md) describes the reproducible browser regression.
