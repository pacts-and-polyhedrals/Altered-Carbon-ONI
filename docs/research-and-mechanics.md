# ONI research and mechanical mapping

Research date: 12 October 2026. Names vary across adaptations; this interface uses **Optical Neural Interface**, following the TV-series interface designers. This document separates confirmed source behavior, your existing tabletop implementation, and original module adaptations. It does not claim every novel / show / RPG version has identical features.

## Primary sources

1. [Fraser Macedo — Altered Carbon UI Design](https://www.behance.net/gallery/57737495/Altered-Carbon-UI-Design), published 24 April 2018. The credited concept designer describes corneal-interface graphics, data-stream access, contacting people and remotely seeing another person's view. The site was indexed; direct retrieval was restricted. Its graphics have not been copied into this module.
2. [Guy Hancock — interview about the show's screen graphics](https://www.pushing-pixels.org/2018/06/05/the-art-and-craft-of-screen-graphics-interview-with-guy-hancock.html), published 5 June 2018. Firsthand discussion by the screen-graphics artist: everyday calls / browsing, police-specific applications, modular document / database / address workflows, arc-shaped ONI concepts and variation between police and wealthy Meth interfaces.
3. [Hunters Entertainment — Altered Carbon RPG](https://www.huntersentertainment.com/ac). Establishes the official tabletop game's relationship to the Netflix adaptation. The publisher page alone is not a detailed ONI mechanical specification.
4. Supplied **Altered Carbon RPG 2.4.9** source: `data/item-catalog.json` (AUG011, SW001, SW002); `data/core-augmentations.json`; `module/core-augmentation-effects.mjs`; `module/core-trait-effects.mjs`; `module/effects.mjs`; `module/rolls.mjs`; `module/documents.mjs`. These are the executable rules this module integrates with. The user's catalog cites the 2020 Core Rulebook pp.246–248 and p.264.
5. Supplied **Cold Storage 1.9.0** source: contacts, factions, benefactors, journals and actor `cold-storage.sourceId` flags. Current source content takes precedence over remembered campaign summaries.

## Function coverage

| ONI function | Evidence basis | Implementation / scope |
| --- | --- | --- |
| Personal augmented interface | Designer accounts | Original dark HUD, iris / orbit graphics and separate everyday / GM controls. These are newly written interface assets. |
| Calls and communication | Designer accounts and AUG011 | Address book, private text / attachments, ringing and connection state, roleplayed call dialogue, call logs, decline and hang-up. Existing table audio remains the voice channel. |
| Data stream / remote databases | Designer account and AUG011 | Controlled service endpoints and native netrunning checks with explicit GM-returned information. No real internet scraping or arbitrary remote execution. |
| Remotely viewing another person's sight | Macedo's firsthand design description | Image / recording / clip transmission to call participants and direct GM feeds. Continuous webcam or live screen streaming is not implemented. |
| Police document / record / address workflow | Hancock's firsthand account | Evidence inbox, journal-page copying, provenance text, contacts, channel searches and analysis requests. |
| Specialized organizations and wealthy patrons | Hancock's interface distinctions; Cold Storage sources | Contact types for faction, benefactor, AI, PC and system; per-PC release and roleplay identities. |
| ONI netrunning modifier | Existing AUG011 rules | +2 to Digital Networking, History, Navigation, through the system's existing context. Numeric effect contract tests were run against the supplied source. |
| Masking and deck tasks | Existing Trait 149, deck entries and native equipment procedure | Equipped deck requirement, mask context, native Gear / Bonus Dice, Depletion, successful narrative mask state. |
| Disabling the interface | Supplied AUG011 entry | Off-grid state, active implant toggle, blocked outgoing transmissions, cached local history and held incoming outbox. |
| Intrusion, analysis and tracing | Native system skill catalog | GM-set difficulty, native checks, access grants on successful intrusion, deliberate information release. No automatic magical lie detector. |
| Notification, encryption, clearance and delay | Original tabletop workflow adaptations | Private recipients, cryptographic envelopes, per-PC grants, unread history, jamming and real-time delayed packets. These are implementation mechanics rather than claims about a canonical encryption algorithm. |
| Six-segment exposure clock | Original optional house rule | Disabled by default. Failed intrusion / mask / trace checks add one segment; the GM decides the consequences at six. |

## Boundaries

The implant is an interface, not a replacement cortical stack. Ordinary communications do not perform resleeving, DHF duplication, needlecasting, forced virtuality, psychosurgery or account payments. ONI service requests can initiate those scenes, and the GM can use the already-installed system's workflows to resolve them. Those procedures have their own costs, infrastructure, permissions and rules.

The module does not invent action costs missing from the supplied ONI summaries. Skill bonuses and equipment Depletion are automatic; tactical timing and Comm / Netrunning Intent costs remain in the existing combat console. Installing a new implant remains a system equipment / augmentation process rather than a free module benefit.

Native dice cards retain the supplied system's own handling and GM visibility. ONI content, contact secrets, evidence truth labels and world-vault data use this module's encrypted transport.

Public cover-role descriptions for imported NPCs were written deliberately. Their source `presentFunction` values can disclose adversaries and secret benefactors, so those values are imported into GM notes rather than copied into player contact cards. Even public cards begin with no PC grants; the GM determines who knows whom.
