/**
 * Web Push, the protocol, with nothing but node:crypto.
 *
 * Two standards make a push: VAPID (RFC 8292), a short ES256-signed token
 * that tells the browser's push service which server is sending, and the
 * aes128gcm payload encryption (RFC 8188 and RFC 8291), so that the push
 * service carries the words without being able to read them. Both are a
 * few dozen lines on node:crypto, which is why this is not the web-push
 * package: one less dependency in a public repository that handles money.
 *
 * Keys come from the environment only: VAPID_PUBLIC_KEY (the 65 byte
 * uncompressed P-256 point, base64url) and VAPID_PRIVATE_KEY (the 32 byte
 * scalar, base64url), as printed by db/vapid-keys.js. VAPID_SUBJECT is a
 * mailto: or https: address the push services can complain to.
 */
import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign } from 'node:crypto';

const TIMEOUT_MS = 5000;
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s || ''), 'base64url');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** The VAPID keys, or null when push is not set up, which means do nothing. */
export function vapidConfig(env = process.env) {
  const publicKey = (env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (env.VAPID_SUBJECT || '').trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (unb64u(publicKey).length !== 65 || unb64u(privateKey).length !== 32) return null;
  return { publicKey, privateKey, subject };
}

/** A fresh key pair, for db/vapid-keys.js. */
export function generateVapidKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  /* A scalar with leading zero bytes comes back short; the key is always 32. */
  const d = ecdh.getPrivateKey();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(Buffer.concat([Buffer.alloc(32 - d.length), d])) };
}

/** The Authorization header value for one push service. */
export function vapidAuth(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const pub = unb64u(publicKey);
  const key = createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  /* Twelve hours: the services accept at most twenty-four. */
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const sig = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

/**
 * The encrypted body for one subscription (RFC 8291), as a single record.
 * `keys` is the subscription's {p256dh, auth}.
 */
export function encryptPayload(plaintext, keys, { salt = randomBytes(16), ecdh } = {}) {
  const uaPublic = unb64u(keys.p256dh);
  const auth = unb64u(keys.auth);
  if (uaPublic.length !== 65 || auth.length < 16) throw new Error('bad subscription keys');
  const local = ecdh || createECDH('prime256v1');
  if (!ecdh) local.generateKeys();
  const asPublic = local.getPublicKey();
  const secret = local.computeSecret(uaPublic);
  const ikm = hmac(hmac(auth, secret), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  /* 0x02 marks the last (and only) record; no further padding. */
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21);
  salt.copy(head, 0);
  head.writeUInt32BE(4096, 16);
  head.writeUInt8(asPublic.length, 20);
  return Buffer.concat([head, asPublic, body]);
}

/**
 * Sends one push. Returns {ok, gone, status}: gone is true when the push
 * service says the subscription no longer exists (404 or 410), which is the
 * caller's cue to forget it.
 */
export async function sendPush(subscription, payload, config, { ttl = 86400 } = {}) {
  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuth(subscription.endpoint, config),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttl),
        Urgency: 'high'
      },
      body: encryptPayload(JSON.stringify(payload), subscription.keys),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    return { ok: res.ok, gone: res.status === 404 || res.status === 410, status: res.status };
  } catch (err) {
    console.warn('web push failed:', err.message);
    return { ok: false, gone: false, status: 0 };
  }
}
