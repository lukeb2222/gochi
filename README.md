# Gochi
Invite-only community prototype. Google sign-in, Firestore live chat, private groups and DMs, emoji, reactions, short voice memos and compressed image messages, friends, avatars, virtual credits and shop, events, and a basic text-review queue.

Build with `npm install && npm run build`. Deploy `dist` on Netlify. Firebase public web configuration is in `src.js`; never add service credentials to source control.

This is an early prototype, not a child-safety-certified platform. The phrase filter is NOT AI moderation and does not screen images or audio. Do not invite children into an unsupervised community until stronger moderation, reporting, and privacy review are in place. `LB` and `bazboy` are weak, guessable codes, not safe authentication. Admin rights need Google identity plus server-enforced permissions. Baz's verified Google email is needed. No real-money gambling, buying credits, credit grants, bans, or cash-out exists. Firebase project: gochi-6be0e.
