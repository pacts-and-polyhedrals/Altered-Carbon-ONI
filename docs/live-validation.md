# First-world validation

Run this in a backup copy of the world using Foundry 14 and your exact Forge build. Unit and real Chromium regressions cover the module with simulated Foundry documents; native UI integration and live multiplayer still need this check.

1. Enable ONI and connect one GM and two different player accounts in separate browsers. Give each player ownership of one character and open the eye button. Export all three endpoint-key backups.
2. Confirm the eye tool is present under token controls for each account, and on the owned token HUD. Confirm Alt+O opens the same application. Check resizing and both Foundry themes.
3. Import Cold Storage with ONI enabled. Wait for automatic preparation. Confirm all eight named dossiers, reserve / unowned records, teammate channels, 177 research files, and both guide journals. Release one NPC to Player A from PC dossiers; B must not receive it. Release history separately, then verify the identity link. Each stage must disclose only that stage's information.
   - Choose Anik in the header, then in PC dossiers; both selectors must follow each other. Check his private player. Even with default Owner permission on every actor, only that player receives his private release.
   - Release his past lives: expect 6 lifetime files and 11 historical-contact files, 37 total Research files including the 20 starter files. Other PCs retain their original libraries.
   - Check Contacts → Previous Lives, filter Allies / Enemies, expand a card and wait through two delivery cycles. The card and scroll position must stay put. Verify current channels appear separately and handouts appear in Evidence.
   - Put Anik off-grid, rebuild his archive, then pause it from Outbox. Safe repair must preserve the pause. Rebuild Anik only and reconnect; it must deliver once without resuming another paused PC.
4. Create a forgery with GM notes and a red-herring truth label. Deliver it to A. Confirm A sees its intended title / content and “Unverified”; B receives nothing. Verify the ONI flag contains only ciphertext, wrapped keys and signature metadata.
5. Send a PC-to-PC message. Confirm the recipient notification, unread count and correct actor endpoint. Open it and mark it read. Refresh the recipient page and confirm the file remains.
6. Start a GM-to-A video call. A answers; the GM sends NPC dialogue and an image. Confirm both call-state transitions and the image. End the call. Repeat with decline and an unanswered call.
7. Start an A-to-B call. A must not be offered “Answer” for its outgoing call. B answers. Confirm A sees B's identity in the call panel. Confirm starting a second overlapping call is rejected.
8. Put A off-grid. Confirm their active ONI implant item is disabled; a GM message remains held in the outbox. Reconnect A and confirm the implant is restored and the message arrives once. Repeat with GM signal blocking. Cached evidence remains readable.
9. Request a network search. GM rolls it through the queue. Compare the native roll with an ordinary system check using `oni-netrunning`. Confirm the implant adds exactly its existing +2, and confirm applicable deck Bonus Dice / Depletion.
10. Try masking with an unequipped or exhausted deck; it must be rejected. Equip a valid SW001 / SW002 deck and repeat. Confirm the Trait context is applied.
11. Disconnect the recipient, deliver a message, then reconnect. Confirm inbox recovery and the unread notice. Also test an account that has never registered a key: the packet must remain queued until its first ONI initialization.
12. Disconnect the elected GM. Confirm player requests wait. Reconnect that GM, or a co-GM whose key was already wrapped into the vault, and confirm queued processing happens once.
13. Back up ONI world data, reload the page and restore an endpoint key in another browser. Confirm the same private history can be read. Test world-data recovery only in the disposable copy.
14. Use a player account with no Whisper Private Messages permission. Confirm native creation fails visibly and the application never falls back to public content. Restore the permission for normal play.
15. Turn on Do not disturb and reduced motion. Confirm unread data is preserved while toasts are suppressed, and that the animated iris / call rings stop.
16. Release a Ward scene bundle to A only. Repeat the action: H01 should arrive once. Select an unowned / reserve dossier deliberately; its pending discovery must arrive after actor binding, ownership and endpoint initialization.
17. Open Research as A and confirm only A's private card, timeline, primers and released memories. Search, filter, save a note, save a network response, and reopen while off-grid. Confirm historical files do not reveal current NPC identities unless explicitly verified.
18. Change a historical relationship to familiar and confirmed using the GM Cold Storage dashboard. Confirm ONI updates automatically. Make the same change as a player: it must not trigger an ONI identity release. Hide a channel manually, then reimport unchanged source data; it must stay hidden.
19. Edit a research file and contact, add a player note, and run Prepare / repair. Confirm edits, release states, private notes and verified links survive. Reassign A's actor to another initialized player and confirm its released research archive is resealed to that owner.
20. Check Diagnostics and Outbox with one missing owner, one missing key and one jammed PC. Check both Guide buttons, page permissions, copied-actor binding, long contact lists, keyboard search focus, file notifications and resizing.

The most important native integration points are ApplicationV2 action delegation, plain HTML form submission, token-HUD DOM selectors, user flag permissions, hidden ChatMessage rendering, and exact-envelope ChatMessage updates during co-GM handoff.

Report errors with the module / system / Foundry versions, the browser console message, which account performed the action and whether an outbox job remained. Never include private key backups in a bug report.
