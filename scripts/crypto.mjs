/** Ciphertext-only Foundry transport. Private endpoint keys stay in this browser. */
import {ID, SCHEMA} from './domain.mjs';
const utf8=new TextEncoder();
const str=new TextDecoder();
const b64=bytes=>{const u=new Uint8Array(bytes);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(s);};
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export class EndpointKeys {
  constructor({crypto=globalThis.crypto, storage=globalThis.localStorage, user, worldId}) {
    this.crypto=crypto;this.storage=storage;this.user=user;this.path=`${ID}:endpoint:${worldId}:${user.id}`;
  }
  async init() {
    if (!this.crypto?.subtle) throw new Error('ONI encryption needs HTTPS or localhost. Open the secure Foundry / Forge URL.');
    const saved=this.storage.getItem(this.path), published=this.user.getFlag(ID,'publicKey');
    if (saved) return this.restore(JSON.parse(saved),false);
    if (published?.kid) throw new Error('This endpoint is registered in another browser. Import your ONI key backup here to open its private inbox.');
    return this.generate();
  }
  async generate() {
    const subtle=this.crypto.subtle;
    const enc=await subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
    const sign=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const bundle={schema:SCHEMA,userId:this.user.id,kid:this.crypto.randomUUID(),
      encPrivate:await subtle.exportKey('jwk',enc.privateKey),encPublic:await subtle.exportKey('jwk',enc.publicKey),
      signPrivate:await subtle.exportKey('jwk',sign.privateKey),signPublic:await subtle.exportKey('jwk',sign.publicKey)};
    await this.restore(bundle,true);return this;
  }
  async restore(bundle,publish=false) {
    if (bundle.schema!==SCHEMA || bundle.userId!==this.user.id || !bundle.kid) throw new Error('This key backup belongs to a different Foundry user.');
    const published=this.user.getFlag(ID,'publicKey');
    if (!publish && published?.kid && bundle.kid!==published.kid) throw new Error('This backup does not match the current endpoint key.');
    if (!publish && published?.kid && (published.enc?.n!==bundle.encPublic?.n || published.sign?.x!==bundle.signPublic?.x || published.sign?.y!==bundle.signPublic?.y)) throw new Error('This backup does not match the registered public keys.');
    const subtle=this.crypto.subtle;
    this.privateEnc=await subtle.importKey('jwk',bundle.encPrivate,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
    this.privateSign=await subtle.importKey('jwk',bundle.signPrivate,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    // Validate that the imported public/private pair actually belongs together.
    const ep=await subtle.importKey('jwk',bundle.encPublic,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
    const sp=await subtle.importKey('jwk',bundle.signPublic,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const challenge=this.crypto.getRandomValues(new Uint8Array(32));
    const roundtrip=await subtle.decrypt({name:'RSA-OAEP'},this.privateEnc,await subtle.encrypt({name:'RSA-OAEP'},ep,challenge));
    const sig=await subtle.sign({name:'ECDSA',hash:'SHA-256'},this.privateSign,challenge);
    if (b64(roundtrip)!==b64(challenge) || !await subtle.verify({name:'ECDSA',hash:'SHA-256'},sp,sig,challenge)) throw new Error('Invalid endpoint key pair.');
    this.bundle=bundle;
    if (publish || !published?.kid) await this.user.setFlag(ID,'publicKey',{schema:SCHEMA,kid:bundle.kid,enc:bundle.encPublic,sign:bundle.signPublic});
    this.storage.setItem(this.path,JSON.stringify(bundle));return this;
  }
  backup() { if(!this.bundle)throw new Error('Endpoint not initialized.');return JSON.stringify(this.bundle,null,2); }
  async seal(payload,users) {
    if (!this.bundle) throw new Error('Initialize your ONI endpoint first.');
    const recipients=[...new Map(users.map(u=>[u.id,u])).values()];
    if (!recipients.length) throw new Error('A private transmission needs recipients.');
    const subtle=this.crypto.subtle;
    const aes=await subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
    const iv=this.crypto.getRandomValues(new Uint8Array(12)),raw=await subtle.exportKey('raw',aes);
    const clear=utf8.encode(JSON.stringify(payload));if(clear.byteLength>700000)throw new Error('ONI record exceeds 700 KB. Export your world data and shorten the catalog or message before retrying.');
    const packet={schema:SCHEMA,alg:'RSA-OAEP/AES-256-GCM/ECDSA-P256',author:this.user.id,kid:this.bundle.kid,
      iv:b64(iv),cipher:b64(await subtle.encrypt({name:'AES-GCM',iv},aes,clear)),keys:{}};
    for(const u of recipients){
      const p=u.getFlag(ID,'publicKey');
      if(!p?.enc||!p?.kid)throw new Error(`${u.name}: open ONI once to register this endpoint. The transmission has not been sent.`);
      const key=await subtle.importKey('jwk',p.enc,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
      packet.keys[u.id]={kid:p.kid,wrapped:b64(await subtle.encrypt({name:'RSA-OAEP'},key,raw))};
    }
    const signature=await subtle.sign({name:'ECDSA',hash:'SHA-256'},this.privateSign,utf8.encode(JSON.stringify(packet)));
    return {...packet,signature:b64(signature)};
  }
  async open(envelope,author) {
    const recipient=envelope?.keys?.[this.user.id];
    if (!recipient || recipient.kid!==this.bundle?.kid) return null;
    if (envelope.schema!==SCHEMA || envelope.author!==author?.id || envelope.cipher?.length>1000000) throw new Error('Invalid private transmission.');
    const pub=author.getFlag(ID,'publicKey');
    if (!pub?.sign || pub.kid!==envelope.kid) throw new Error('Transmission signing key is no longer registered.');
    const {signature,...signed}=envelope;
    const subtle=this.crypto.subtle,key=await subtle.importKey('jwk',pub.sign,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    if (!await subtle.verify({name:'ECDSA',hash:'SHA-256'},key,un64(signature),utf8.encode(JSON.stringify(signed)))) throw new Error('ONI signature verification failed.');
    const raw=await subtle.decrypt({name:'RSA-OAEP'},this.privateEnc,un64(recipient.wrapped));
    const aes=await subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);
    const clear=await subtle.decrypt({name:'AES-GCM',iv:un64(envelope.iv)},aes,un64(envelope.cipher));
    return JSON.parse(str.decode(clear));
  }
}
