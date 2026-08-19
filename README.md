# Family Health

A private, offline-first portal for recording medical checkups and appointments for your whole family — installable as a mobile web app, no server, no account, no tracking.

## Features

- 👥 **Family profiles** — Create a profile for each family member with a custom name, emoji avatar, and colour.
- 📅 **Visit timeline** — Record any type of visit: GP, specialist, hospital emergency, dentist, dental hygiene, vaccination, blood test, imaging, physiotherapy, eye, mental health, and more.
- 👨‍⚕️ **Doctor & advice** — Log the doctor's name, clinic, and their advice/recommendations.
- 📷 **Photo attachments** — Attach photos of exam results, prescriptions, or e-receipts. Images are compressed and stored on-device only.
- 🔍 **Filter & search** — Filter visits by type on each person's page.
- 📤 **Backup & restore** — Export everything to a single JSON file; import it back at any time.
- 📴 **Works offline** — A service worker caches the app shell so it loads even without internet.
- 📱 **Installable PWA** — Add to your phone's home screen from the browser share/install menu.

## How to use

1. Open the app URL in your mobile browser.
2. Tap **Add person** to create family member profiles.
3. Tap **+ New visit** (bottom-right button) to record a checkup.
4. Tap any visit card to see the full detail, photos, and doctor's advice.
5. Go to **Settings → Export backup** regularly to save a copy of your data.

## Deploy to GitHub Pages (free)

1. Push this repository to GitHub.
2. Go to **Settings → Pages** in your GitHub repository.
3. Under *Source*, choose **Deploy from a branch** → select your branch → `/ (root)`.
4. GitHub will give you a URL like `https://yourusername.github.io/my-health-/`.
5. Open that URL on your phone and tap *Add to Home Screen* from the browser menu.

## Data & privacy

All data is stored in your browser's **IndexedDB** — it never leaves your device. Clearing browser site data will erase everything, so export a backup regularly. Use *Settings → Request persistent storage* to tell the browser to protect your data from automatic cleanup.

## Tech

Pure vanilla HTML + CSS + ES Modules — no build step, no dependencies, no bundler. Works on any modern browser.
