# ONI macro API

Available after world `ready` as `game.acONI`, or `game.modules.get('altered-carbon-oni').api`.

```js
// Open the currently controlled / assigned character's ONI.
game.acONI.open();

// Open a particular owned actor.
game.acONI.open(game.actors.get('ACTOR_ID'));

// Read only the current user's decrypted directory for an owned actor.
const contacts = game.acONI.contacts(game.user.character);

// Send as an owned PC to an already released directory channel.
await game.acONI.send({
  actorId: game.user.character.id,
  contactId: 'cold:C11',
  mode: 'message',
  title: 'Relay enquiry',
  body: 'Can you preserve the transit receipt?',
  media: {type: 'image', path: '', caption: ''}
});

// GM only: direct transmission to specified PC actor IDs.
await game.acONI.dispatch({
  contactId: 'cold:C11',
  actorIds: ['ACTOR_ID'],
  mode: 'message',
  title: 'Recovered receipt',
  body: 'Keep a copy outside the network.',
  evidenceId: 'cold:H01',
  verdict: 'Unverified'
});

// GM only: import or refresh the PC roster.
await game.acONI.importColdStorage();
await game.acONI.syncRoster();

// GM only: release a current contact to a prepared source-PC dossier.
// mode: release | history | verify | hide
await game.acONI.releaseContact({
  dossierId: 'PC01', contactId: 'cold:C11', mode: 'release'
});

// GM only: release a previously assigned lifetime file.
await game.acONI.releaseResearch({
  dossierId: 'PC01', researchId: 'cold:life:PC01-S1'
});

// GM only: publish Anik's complete past-life and historical-contact collection.
await game.acONI.releaseLifetimes({dossierId: 'PC07'});

// GM only: deliberately reveal every prepared current channel for this PC.
// This does not verify historical identity links.
await game.acONI.releaseContacts({dossierId: 'PC07'});

// GM only: restrict future private delivery to this player account.
// Adds native Owner permission if needed; does not change User.character.
await game.acONI.assignPlayer({dossierId: 'PC07', playerUserId: 'USER_ID'});

// GM only: resume cancelled archive delivery and republish already released
// contacts, research and evidence for Anik alone. Sealed files stay sealed.
await game.acONI.rebuildArchive({dossierId: 'PC07'});

// GM only: release a scene's contacts and evidence to selected PC dossiers.
await game.acONI.releaseScene({sceneId: 'ward', dossierIds: ['PC01', 'PC02']});

// Read the current user's delivered research for an owned actor.
const files = game.acONI.research(game.user.character);

// GM only: inspect diagnostics or perform additive source repairs.
const report = game.acONI.diagnostics();
await game.acONI.repair();
```

Mutation methods return the native request document ID after durable submission. They do not promise that a GM has processed the request or an offline target has received it. Read methods return decrypted local data synchronously. Check the GM queue / outbox for delivery progress. Changes still pass author, role, actor-ownership, grant and online-state validation.

For GM clients, `contacts()` and `research()` preview the published dossier immediately, even when player delivery is waiting. Players read only their decrypted deliveries. Contact history appears in the UI's Previous Lives view and in returned research files with category `Historical contacts`. Current callable cards remain the `contacts()` result.

Bulk releases and rebuild accept an optional native `actorId` as a stale-selection guard. If provided it must match the dossier's bound actor. Archive synchronization coalesces to one pending reference per initialized recipient PC. Missing keys leave released content stored; cancel / repair does not silently resume a paused archive.

Cold Storage `dossierId` values are the stable source IDs `PC01`–`PC08`, while `actorId` values are actual Foundry document IDs. Automatic import binds those two namespaces. Custom PC dossiers use `actor:ACTOR_ID`. Peer contacts use `team:PC01`–`team:PC08` for Cold Storage and `pc:ACTOR_ID` for custom actors. Prefer a contact ID read from the current directory over guessing it.

Scene IDs are `ward`, `breach`, `rainline`, `quiet`, `lotus`, `relay`, `anansi`, `virtuality`, and `spire`. These releases are deliberate GM disclosures; they do not automate Fray or identity verification.

The local hook `acONIChanged` fires with the runtime after changes. It is for trusted local module integrations; it is not an external broadcast or a way to access another user's decryption keys.
