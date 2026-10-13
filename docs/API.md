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
```

Methods return the native request document ID after it has been durably submitted. They do not promise that a GM has processed the request or that an offline target has received it. Check the GM queue / outbox for delivery progress. All changes still pass author, role, actor-ownership, grant and online-state validation.

The local hook `acONIChanged` fires with the runtime after changes. It is for trusted local module integrations; it is not an external broadcast or a way to access another user's decryption keys.
