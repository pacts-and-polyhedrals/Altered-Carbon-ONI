# Altered Carbon — ONI 1.0.0

A separate Foundry VTT module for **Altered Carbon RPG 2.4.9+**, targeting **Foundry 14**. It adds an eye button to the token control palette, an eye button on an owned token's HUD, and **Alt+O** to open a character's Optical Neural Interface.

Your system and Cold Storage installation remain separate. The ONI module uses the supplied system's skill checks, implant effects, deck bonuses and deck Depletion. Cold Storage is optional; its data is also present in your 2.4.9 system.

## What it includes

- Individual PC inboxes with private notifications, unread counts, saved history and offline delivery.
- Contacts, PCs, benefactors, factions, AI identities and service / database endpoints.
- A GM directory with per-PC grants, availability, clearance, difficulty and private agendas.
- Incoming / outgoing audio and video call sessions with ringing, answer, decline, busy checks, missed calls, dialogue, shared visual files and hang-up.
- Animated ONI iris, connection orbit, channel visualizer, incoming notices and file reveals. Optional tones, do-not-disturb and reduced-motion controls.
- Text, image, recorded video, audio and document attachments.
- Evidence recovery, preservation, forwarding and analysis requests. Genuine evidence, forgeries and red herrings use the same player-facing presentation.
- GM roleplay as a selected contact; targeted broadcasts; delayed messages and evidence.
- Authorized network searches, history, navigation, evidence analysis, intrusion, identity masking and tracing.
- Signal blocking, off-grid operation, clearance grants and an optional six-segment trace clock.
- Import of 20 Cold Storage contacts, six factions, three benefactors and 16 handouts. Six additional service templates are newly authored for this module.
- Browser endpoint-key backups and GM world-data export / recovery.

**Calls are tabletop call sessions.** The module does not replace Discord or Foundry voice/video. The shared-sight feature transmits a scene image, recording or uploaded clip. It does not open a webcam, stream a player's desktop, or mirror the Foundry canvas.

## Install

1. Extract the installation ZIP. Place its `altered-carbon-oni` folder in your Foundry user-data `Data/modules/` directory.
2. Restart Foundry, open your Altered Carbon world and enable **Altered Carbon — ONI** in **Manage Modules**.
3. Connect using **HTTPS**, including your usual Forge URL, or `localhost`. The encrypted transport requires WebCrypto.
4. Assign PCs to their Foundry users with Owner permission. Each player should connect once so ONI can register their private endpoint. Nothing is sent in plaintext when a key is missing; the packet waits in the GM outbox.
5. Open ONI with the eye button. In **GM control**, click **Import Cold Storage**, then **Sync PC roster**.
6. In **GM control → contacts**, edit each NPC / faction / service you want available, check the recipient PCs and choose **Save & publish selected grants**.
7. Each user should download **Endpoint → Download endpoint key backup** and keep it privately with their other backups.

For Forge or manifest installation, publish the included source to a GitHub release first; see [publishing/README.md](publishing/README.md). This ZIP does not claim a hosted manifest URL that has not been published.

## First transmission

1. **GM control → evidence:** create an evidence record with player-visible title, source, text and optional media. Put its actual meaning and truth classification in the GM fields.
2. **GM control → dispatch:** choose a sender, recipient PCs, subject and message. Attach the evidence and transmit.
3. The chosen players receive an ONI notification and the file appears in their character's Inbox and Evidence tabs. Other players cannot decrypt that delivery.
4. Players can forward received evidence to released PC channels. They cannot forward an undiscovered GM-vault record.

## Conversations and calls

Players select a channel in **Directory**, choose message / audio call / video call / service, and transmit. PC-to-PC messages and calls are routed to the target PC's owners. NPC, faction and service enquiries arrive in the GM's private queue.

The GM can answer a PC's outgoing call from **GM control → queue**, or start an incoming call from **dispatch**. In **GM control → calls**, speak as the contact and send visual files. The participant view is **Calls & sight**.

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

A new owner can receive newly issued records; removing ownership does not make previously revealed information unknowable. Shared media paths are encrypted in the ONI packet, but the media file itself is still served by Foundry / Forge or its external host. This module does not add access control to that file server. Masked identity is a tabletop state, not anonymous Foundry-account networking.

## Compatibility and validation

- Built against the attached **Altered Carbon RPG 2.4.9**, **Cold Storage 1.9.0** and Foundry's documented v14 APIs.
- Automated protocol, cryptography, permissions, delivery, call, recovery, rendering-output and system-effect contract checks are included.
- A licensed live Foundry server and working browser renderer were not available for end-to-end validation. The manifest intentionally omits `compatibility.verified`.
- Complete the short [live validation guide](docs/live-validation.md) in a copy of your world before using it for a paid session. Especially check TokenHUD markup, whisper permission, ApplicationV2 form handling and two simultaneous browsers on your exact Foundry / Forge build.

This is unofficial fan tooling. It contains original interface code and reads your existing adventure installation; it does not bundle the rulebook, the TV show's graphics, or the full Cold Storage adventure.

## Developer checks

```sh
node scripts/validate.mjs
node --test tests/*.test.mjs
```

For the two additional checks against your installed system:

```sh
AC_SYSTEM_PATH=/absolute/path/to/Data/systems/altered-carbon-rpg node --test tests/*.test.mjs
```

No npm packages are required by the module or its unit tests. [docs/API.md](docs/API.md) describes the macro API.
