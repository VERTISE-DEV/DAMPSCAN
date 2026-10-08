/**
 * npm run vapid-keys
 *
 * Prints a fresh VAPID key pair for phone notifications (lib/push.js). Paste
 * the three lines into Vercel, Settings, Environment Variables, and redeploy.
 * Nothing is written anywhere: the repository is public, so the private key
 * must only ever live in Vercel. Making a new pair later signs everybody out
 * of notifications; they tap "Turn on notifications" again.
 */
import { generateVapidKeys } from '../lib/webpush.js';

const { publicKey, privateKey } = generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com   (change to your own email address)');
