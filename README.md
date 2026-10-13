# Altered Carbon — ONI 1.2.0

A separate Foundry VTT module for **Altered Carbon RPG 2.4.9+**, targeting **Foundry 14**. It adds an eye button to the token control palette, an eye button on an owned token's HUD, and **Alt+O** to open a character's Optical Neural Interface.

Your system and Cold Storage installation remain separate. The ONI module uses the supplied system's skill checks, implant effects, deck bonuses and deck Depletion. Cold Storage is optional; its data is also present in your 2.4.9 system.

## Install manifest — Foundry / Forge

**Manifest URL:** [https://raw.githubusercontent.com/pacts-and-polyhedrals/Altered-Carbon-ONI/main/module.json](https://raw.githubusercontent.com/pacts-and-polyhedrals/Altered-Carbon-ONI/main/module.json)

1. In Foundry Setup, open **Add-on Modules → Install Module**; on Forge, use **Install from Manifest**.
2. Paste the manifest URL above into **Manifest URL**, then choose **Install**.
3. Open your Altered Carbon world and enable **Altered Carbon — ONI** in **Manage Modules**.

The manifest downloads the public repository's `main` ZIP. A GitHub release is not required for this installation route. Keep `module.json` at the repository root, and keep its `url`, `manifest` and `download` fields populated. The install manifest URL must remain visible in this README for every distributed version.

## Updating a world affected by the 1.1.0 release bugs

Version 1.2.0 fixes private recipient routing, missing contact sections, per-file outbox buildup, and lists jumping during background updates. Replace the module files with this release, restart Foundry and reload each browser. Existing endpoint keys and ONI world records remain usable. No Cold Storage reimport is needed.

1. Open **GM control → PC dossiers → Anik Rao**. The header endpoint and dossier now stay aligned.
2. Check **Private delivery**. Select Anik's actual player and click **Set private recipient** if needed. This selects one account and grants native actor ownership if missing.
3. Click **Rebuild Anik Rao’s released archive**. It resumes only Anik's already released files, including files cancelled from the old outbox. It leaves every other PC's releases and cancellations intact. The player must have connected once and the endpoint must be connected.
4. Find callable names in **Contacts → Current Channels**, released allies / enemies / rivals / loved ones in **Contacts → Previous Lives**, lifetime files in **Research**, and released handouts in **Evidence**.

To reveal additional content, use **Release past lives & historical contacts to this PC**, individual release buttons, or **Release all current channels to this PC** deliberately. Rebuilding restores published content without revealing still-sealed files or verifying identities. Old undelivered per-file jobs are retired automatically. Ordinary messages, scheduled deliveries and calls retain their delivery jobs. The updated journals explain these controls in the world.

## What it includes

- Individual PC inboxes with private notifications, unread counts, saved history and offline delivery.
- Contacts, PCs, benefactors, factions, AI identities and service / database endpoints.
- A GM directory with per-PC grants, availability, clearance, difficulty and private agendas.
- Automatic preparation of **all eight Cold Storage PC dossiers**, including 160 relationship links, 46 lifetime records and **177 research files**. Unowned and reserve PCs retain their assignments.
- Named per-PC contact lists with **Release channel**, **Release history**, **Verify identity link** and **Hide channel** controls, searchable lifetime files and bulk release.
- A player **Research** archive with private briefings, continuity indexes, reference primers, recovered lifetimes, historical relationships, personal notes and saved transmissions.
- Nine scene / lead bundles for one-action contact and evidence releases, with a preview and per-PC duplicate prevention.
- Automatic actor binding, teammate channels, ownership / key changes, and GM-authored Cold Storage relationship reveals.
- In-world **ONI · Player Guide** and private **ONI · GM Operations Guide**, covering every interface section in 20 pages.
- Visible per-PC private recipients, archive status, targeted rebuild, stable expandable lists, diagnostics and additive **Prepare / repair**.
- Incoming / outgoing audio and video call sessions with ringing, answer, decline, busy checks, missed calls, dialogue, shared visual files and hang-up.
- Animated ONI iris, connection orbit, channel visualizer, incoming notices and file reveals. Optional tones, do-not-disturb and reduced-motion controls.
- Text, image, recorded video, audio and document attachments.
- Evidence recovery, preservation, forwarding and analysis requests. Genuine evidence, forgeries and red herrings use the same player-facing presentation.
- GM roleplay as a selected contact; targeted broadcasts; delayed messages and evidence.
- Authorized network searches, history, navigation, evidence analysis, intrusion, identity masking and tracing.
- Signal blocking, off-grid operation, clearance grants and an optional six-segment trace clock.
- Import of 20 Cold Storage NPC contacts, six factions, three benefactors, Marlowe's Anansi House channel and 16 handouts. Six additional service templates are newly authored for this module.
- Browser endpoint-key backups and GM world-data export / recovery.

**Calls are tabletop call sessions.** The module does not replace Discord or Foundry voice/video. The shared-sight feature transmits a scene image, recording or uploaded clip. It does not open a webcam, stream a player's desktop, or mirror the Foundry canvas.

## Manual installation and first-world setup

1. Extract the installation ZIP. Place its `altered-carbon-oni` folder in your Foundry user-data `Data/modules/` directory.
2. Restart Foundry, open your Altered Carbon world and enable **Altered Carbon — ONI** in **Manage Modules**.
3. Connect using **HTTPS**, including your usual Forge URL, or `localhost`. The encrypted transport requires WebCrypto.
4. Assign each user's Character and native Owner permission, or choose **Set private recipient** in PC dossiers. Broad default Owner permission is never treated as a party-wide private recipient list. Each player should connect once to register an endpoint. Released archives stay stored under their own PC until an eligible player initializes; no individual file jobs accumulate.
5. Import Cold Storage normally. ONI automatically prepares all eight dossiers after import settles. Existing worlds are prepared when a GM connects. If needed, use **GM control → Prepare / repair Cold Storage**; no separate roster-sync step is required.
6. Open **GM control → PC dossiers**. Choose a PC by name and release contacts or past-life files. **Scene releases** previews and releases a scene's discoveries to selected PCs in one action.
7. Players open **Research** for their private card, continuity index and player reference library. Read the automatically installed **ONI · Player Guide** and **ONI · GM Operations Guide** using the Guide button or Journals sidebar.
8. Each user should download **Endpoint → Download endpoint key backup** and keep it privately with their other backups.

The manifest installation above works from the public repository's main branch. The optional [release publishing guide](publishing/README.md) describes version-pinned release archives.

## PC contacts and lifelong research

Preparation assigns every authored historical relationship and potential adventure channel to the appropriate GM dossier. Each PC has its own list of NPCs, historical names, relationship roles and former sleeves. Active imported teammates receive one another's channels automatically; reserve characters are not automatically presented as live teammates. Dossiers are prepared before their actors exist and retain releases while waiting for import or ownership. GM views show published content immediately, independently of player connection status; player views contain only privately delivered records.

| GM action | What this PC receives |
| --- | --- |
| Release channel | The contact's current public card and callable / message address. |
| Release history | This PC's historical relationship in Contacts → Previous Lives and Research, without a current-sleeve identity link. |
| Verify identity link | An explicit connection between historical names and the current card, plus the related history file. |
| Hide channel | Removes future directory access; already delivered knowledge remains in the archive. |
| Release file | A selected past-life or custom research file. |
| Release past lives & historical contacts | All prepared lifetime and historical relationship files for this PC, with disputed claims still labelled. |
| Release all current channels | All listed callable contact cards for this PC; historical identity links remain sealed. |
| Rebuild released archive | Republish only this PC's released contacts, research and evidence; resume its cancelled archive deliveries. |

The initial library contains a **private character card**, **continuity index** and **18 player-safe reference primers**. The full vault also holds 46 lifetime records and 97 per-PC historical-contact files grouping all 160 relationship links. Detailed histories are prepared and sealed for GM-controlled pacing. Historical memories do not automatically prove current identities, reveal NPC agendas, or grant skill bonuses.

Player **Contacts** has separate **Current Channels** and **Previous Lives** views. Historical cards can be filtered by Allies, Enemies, Rivals or Loved ones and opened directly in Research. Expanded cards, scroll position, search focus and edited drafts survive incoming updates. Unchanged background cycles leave the DOM alone.

Each PC's published library travels in one encrypted archive snapshot; one pending snapshot replaces older pending versions for that PC. Starter loads and ownership refreshes are silent. Deliberate releases notify that PC and open the relevant section. Missing keys leave content in the dossier. Off-grid or signal-blocked initialized endpoints hold one archive job until reconnection. Cancelling it pauses that PC's archive and survives repair; rebuild is the explicit way to resume.

GM-authored reveals in the Cold Storage relationship dashboard synchronize with ONI. Familiar / suspected / hostile / reconciled entries publish the current channel; confirmed non-disputed entries also publish their history and identity link. Player-authored relationship updates do not trigger identity reveals. A deliberate ONI hide survives unchanged source states and reimport.

Use **GM control → Research** to create and assign additional knowledge from previous lives or your campaign. Players can make private PC notes and save inbox / network replies to Research. Import preserves existing ONI notes, edited file bodies, grants, verified links and delivery receipts. It reads installed source data and does not create actors or overwrite their sheets.

## Scene releases and diagnostics

**GM control → Scene releases** includes Ward, Recovery team, Rainline, Quiet Archive, Blue Lotus, Relay Seventeen, Anansi House, Virtuality and Spire / council bundles. Choose recipients and review the exact contact and handout list before releasing. Each bundle is delivered once per selected PC. Bundles do not verify identities, activate Fray, or require a particular adventure route.

**Diagnostics** reports actor bindings, duplicate source IDs, ownership, missing endpoint keys, guides, source counts, missing research and vault capacity. **Outbox** shows each packet's actual waiting reason. **Prepare / repair** adds missing source files and guides, rebinds unique source actors, removes grants to deleted actors, republishes directories and queues released research. Use Bind actor for a copied or custom PC. Ownership and missing private keys still require the appropriate user or GM to act.

Archive delivery uses small file references and batched encrypted checkpoints. Starter-library deliveries are silent; manual knowledge releases generate notifications. Repeating import, scene release or reconnect does not duplicate a delivered source-file revision. See [the diagnostics report](docs/diagnostics.md) for findings and source coverage.

## First transmission

1. **GM control → Evidence vault:** create an evidence record with player-visible title, source, text and optional media. Put its actual meaning and truth classification in the GM fields.
2. **GM control → Send:** choose a sender, recipient PCs, subject and message. Attach the evidence and transmit.
3. The chosen players receive an ONI notification and the file appears in their character's Inbox and Evidence tabs. Other players cannot decrypt that delivery.
4. Players can forward received evidence to released PC channels. They cannot forward an undiscovered GM-vault record.

## Conversations and calls

Players select a channel in **Directory**, choose message / audio call / video call / service, and transmit. PC-to-PC messages and calls are routed to the target PC's owners. NPC, faction and service enquiries arrive in the GM's private queue.

The GM can answer a PC's outgoing call from **GM control → Queue**, or start an incoming call from **Send**. In **GM control → Live calls**, speak as the contact and send visual files. The participant view is **Calls & sight**.

One scripted call per PC is supported. For a group call, the first receiver's answer connects the group; a participant ending the call ends that scripted session. Ringing expires after the configured timeout. Delayed delivery applies to messages and files; calls start immediately.

## Mechanics

| Function | Integration |
| --- | --- |
| Netrunning / remote research | Native Digital Networking, History or Navigation check, with `oni-netrunning` activation context. The existing active AUG011 effect provides its +2; this module never adds a second +2. |
| Analysis / intrusion | Native Data Analysis or Data Engineering. These do not receive the implant's netrunning modifier. |
| Identity masking | Digital Networking with `mask-oni` and an equipped, non-exhausted deck. The system resolves owned masking Traits. Successful checks record a masked narrative state. |
| Deck operation | Uses the selected equipped catalog deck's Gear Bonus, Bonus Dice and native `useDepletion` procedure for computer operations. History and navigation use the implant without automatically consuming a deck. |
| Authorization | Per-channel GM grants plus clearance; successful intrusion grants that PC access to the channel's required clearance. The information itself still comes from the GM. |
| Off-grid | Queues incoming deliveries and blocks outgoing operations. Deactivates the current sleeve's ONI item and restores only the items this toggle previously deactivated on reconnection. |
| Signal blocking | GM-controlled, per-PC jamming. Holds incoming packets and prevents transmission; cached evidence remains readable. |
| Tracing | Native Digital Networking check; the GM supplies the actual route or result. The optional six-segment exposure clock is a module house rule. |
| Comm / ordinary messages | No extra software roll for routine authorized communication. Apply the RPG's action / Intent costs in the existing combat workflow when timing matters. This interface does not automatically spend Speed Dice. |
| Favors, payments, virtuality and benefactor services | A targeted service request with a GM response. Money, Influence, clinical actions and virtual sessions remain adjudicated through the existing system tools. |

The GM rolls a requested operation once, then sends its result or associated evidence. A successful check never automatically reveals a hidden identity or a red-herring label. A manual GM ruling can resolve a request without a roll.

**Require an active ONI implant** is off by default so a character can use a paired terminal. Switch it on in Module Settings for strict implant access. Only an actual active implant gets its system bonus. The **optional trace clock** is off by default.

See [docs/research-and-mechanics.md](docs/research-and-mechanics.md) for the source / adaptation distinctions.

## Privacy and persistence

ONI records use AES-256-GCM, per-recipient RSA-OAEP key wrapping and an ECDSA signature checked against the native Foundry message author. Private keys stay in the user's browser; only public keys are published in user flags. Native whisper recipients also restrict the normal chat view. The payload is encrypted even if a Foundry client can inspect hidden chat-document flags.

The GM vault is encrypted for registered GMs. Public contacts and evidence are projected through explicit field allowlists before delivery. Private agendas and truth labels never enter the player projection. At least one registered GM must be online to process requests and dispatch queued packets; players may submit requests while that GM is offline.

**Keep your endpoint-key backup.** A different browser cannot open the old private inbox without that key. The module refuses to silently replace an existing endpoint key. The original GM must be present to wrap a newly registered co-GM's key into the vault before that co-GM can take over.

ONI history and the encrypted vault are stored in world ChatMessages, hidden from the normal chat display. **Do not clear the world's chat archive while using ONI.** Export ONI world data first, and retain a normal Foundry world backup. Endpoint keys and world-data exports are different backups; retain both.

A new owner automatically receives the dossier's released research and directory; removing ownership does not make previously revealed information unknowable. Shared media paths are encrypted in the ONI packet, but the media file itself is still served by Foundry / Forge or its external host. This module does not add access control to that file server. Masked identity is a tabletop state, not anonymous Foundry-account networking.

## Compatibility and validation

- Built against the attached **Altered Carbon RPG 2.4.9**, **Cold Storage 1.9.0** and Foundry's documented v14 APIs.
- Automated protocol, cryptography, permissions, delivery, call, recovery, rendering-output and system-effect contract checks are included.
- Browser regressions run in real Chromium with native DOM, scrolling, forms and WebCrypto against simulated Foundry documents. They exercise actual Anik data and a second PC's private view. A licensed live Foundry server / Forge multiplayer session is still unavailable; the manifest intentionally omits `compatibility.verified`.
- Complete the short [live validation guide](docs/live-validation.md) in a copy of your world before using it for a paid session. Especially check TokenHUD markup, whisper permission, ApplicationV2 form handling and two simultaneous browsers on your exact Foundry / Forge build.

This is unofficial fan tooling. It contains original interface code and reads your existing adventure installation; it does not bundle the rulebook, the TV show's graphics, or the full Cold Storage adventure.

## Developer checks

```sh
node scripts/validate.mjs
node --test tests/*.test.mjs
```

For the additional contracts against your installed system and Cold Storage source repository:

```sh
AC_SYSTEM_PATH=/absolute/path/to/Data/systems/altered-carbon-rpg AC_COLD_PATH=/absolute/path/to/Cold-Storage-source node --test tests/*.test.mjs
```

No npm packages are required by the module or its unit tests. [docs/API.md](docs/API.md) describes the macro API.

For reproducible UI regressions, install optional development tools and run:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
AC_COLD_PATH=/absolute/path/to/Cold-Storage-source node tests/browser/run.cjs
```

Set `ONI_CHROMIUM_EXECUTABLE` to use an existing Chromium, `ONI_PLAYWRIGHT_PATH` for an external Playwright installation, or `ONI_BROWSER_OUTPUT` for screenshots and the JSON result. These tools are not runtime dependencies and are excluded from the installation archive.
