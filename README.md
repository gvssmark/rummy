# Family Rummy

A 13-card Rummy PWA for 2-6 players, built for family playing across
different places. One person hosts a room, shares the code over
WhatsApp, everyone joins and plays for points until someone crosses
the target score. $0 to run — GitHub Pages for hosting, Firebase's
free Spark plan for auth + realtime sync.

## House rules this app enforces

- Winning hand = 1 pure sequence + 1 sequence (joker allowed) + 2 sets, all app-validated
- Ace = 10 points; face cards = 10; numbers = face value
- Joker: game 1 and the last game of a round use a printed joker only;
  games in between use a cut (wildcard) joker — configurable per room
- First drop = 20, middle drop = 40, wrong show = 80, capped hand = 80
- An invalid declare ends the hand for everyone (declarer takes the
  wrong-show penalty, others are scored on their hand at that moment)

## One-time setup

### 1. Firebase project (free Spark plan — no billing needed)

1. Go to https://console.firebase.google.com → **Add project** → give
   it any name → you can skip Google Analytics.
2. **Build → Authentication → Get started → Sign-in method** → enable
   **Email link (passwordless sign-in)**.
3. Authentication → Settings → **Authorized domains** → add your
   GitHub Pages domain once you know it (see step 4 below), e.g.
   `yourname.github.io`.
4. **Build → Firestore Database → Create database** → start in
   **production mode** (our security rules handle access control) →
   pick any region close to your family.
5. Project settings (gear icon) → **General** → scroll to "Your apps"
   → click the **Web** icon (`</>`) → register an app (any nickname)
   → copy the `firebaseConfig` object shown.

### 2. Wire the config into the app

Paste the values from step 1.5 into `src/firebase/firebaseInit.js`,
replacing the `REPLACE_ME` placeholders. These values are not secret —
safe to commit to a public repo.

### 3. Add your family's emails

Edit `src/config/allowedFamilyMembers.js`:

```js
export const ALLOWED_FAMILY_MEMBERS = [
  { email: 'mom@example.com', displayName: 'Mom' },
  { email: 'dad@example.com', displayName: 'Dad' },
  // ...
];
```

Then push that list into Firestore (one-time, and again any time you
edit the list):

1. Firebase Console → Project Settings → **Service accounts** →
   **Generate new private key** → save the downloaded file as
   `scripts/serviceAccountKey.json` (already gitignored — never commit it).
2. `npm install firebase-admin --save-dev`
3. `node scripts/syncAllowlist.js`

### 4. Deploy the security rules

Easiest via the Firebase Console: **Firestore Database → Rules** tab →
paste the contents of `firestore.rules` from this repo → **Publish**.

(Alternatively, install the Firebase CLI: `npm install -g firebase-tools`,
`firebase login`, `firebase init firestore` in this folder pointing at
your project, then `firebase deploy --only firestore:rules`.)

### 5. Push to GitHub and enable Pages

1. Create a new GitHub repo (e.g. `rummy-pwa`) and push this project to it.
2. If your repo name isn't `rummy-pwa`, update the `base:` path in
   `vite.config.js` to match: `base: '/your-repo-name/'`.
3. Repo → **Settings → Pages → Build and deployment → Source** → select
   **GitHub Actions**. The included workflow
   (`.github/workflows/deploy.yml`) builds and deploys automatically on
   every push to `main`.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.
   Add that exact domain (just `<your-username>.github.io`) to Firebase
   Authentication's authorized domains list if you haven't already (step 1.3).

## Local development

```bash
npm install
npm run dev
```

## Running the game-logic test suite

The core rules (deck, joker modes, meld validation, scoring, turn
engine) are pure functions with no Firebase dependency, so they can be
checked anytime with plain Node — no browser or Firebase project needed:

```bash
node src/game/manualTest.js
node src/game/manualTest2.js
```

## Project structure

```
src/game/       pure game-logic functions (deck, joker, melds, scoring, turns) - fully unit tested
src/firebase/   Firestore + Auth integration, host-authoritative sync
src/hooks/      React hooks wrapping the above for components
src/screens/    the 5 app screens (login, lobby, waiting room, table, round-over)
src/components/ Card and the declare-arrangement modal
src/config/     the family email allow-list (.js file — edit this to add/remove players)
scripts/        one-time admin script to sync the allow-list to Firestore
```

See `FIRESTORE_SCHEMA.md` for the data model and `HOST_HANDOFF.md` for
how the app recovers if the host's phone disconnects mid-game.
