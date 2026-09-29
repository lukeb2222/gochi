# Gochi

Early invite-only community prototype. Google sign-in, Firestore chat, spaces and DMs, reactions, short voice notes and compressed images, friends, avatars, virtual credits and a shop, and events.

Build: `npm install && npm run build`. Deploy `dist` on Netlify with Functions from `netlify/functions`. The Firebase web config in `src.js` is public; keep Firebase service-account credentials and administrator codes out of the repository. Set those server-side values in Netlify environment settings.

Not ready for children or an unsupervised public launch. The phrase filter is basic, not AI moderation; it misses images, audio and many harmful messages. Privacy rules and admin permissions need a thorough review. Credits and points are virtual only, with no real-money purchases or cash-out.
