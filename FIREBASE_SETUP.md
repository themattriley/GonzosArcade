# Firebase Setup Guide — Mini Arcade Leaderboard

Follow these steps to enable a universal leaderboard that works across all browsers and devices.

---

## Step 1 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name it (e.g. `my-arcade`) and click through the setup wizard
4. You do **not** need Google Analytics

---

## Step 2 — Create a Realtime Database

1. In your project sidebar, click **Build → Realtime Database**
2. Click **Create Database**
3. Choose a region (pick the one closest to your players)
4. When asked about rules, select **Start in test mode** *(we'll tighten this in Step 4)*

---

## Step 3 — Get your Database URL

1. In the Realtime Database panel, your URL is shown at the top:
   ```
   https://my-arcade-default-rtdb.firebaseio.com
   ```
2. Copy that URL

---

## Step 4 — Set security rules

In the Realtime Database console, click the **Rules** tab and paste this:

```json
{
  "rules": {
    "leaderboard": {
      ".read": true,
      "$game": {
        ".write": true,
        ".validate": "newData.isString() || newData.hasChildren()"
      }
    }
  }
}
```

Click **Publish**. This allows anyone to read scores and post scores, but nothing outside the `leaderboard` path can be touched.

---

## Step 5 — Configure your arcade

Open `firebase-config.js` and replace `YOUR_DATABASE_URL_HERE` with your URL:

```javascript
window.ARCADE_FIREBASE_CONFIG = {
  databaseURL: 'https://my-arcade-default-rtdb.firebaseio.com',
};
```

---

## Step 6 — Deploy

Upload `firebase-config.js` to your GitHub repo alongside all the game files. That's it — scores will now sync globally.

---

## Notes

- **Free tier limits**: Firebase's free Spark plan allows 1 GB storage and 10 GB/month download. A leaderboard with 10 entries per game is tiny — you'd need millions of players to hit these limits.
- **Offline fallback**: If Firebase is unreachable, scores save to `localStorage` automatically and show without error.
- **Local-only mode**: If you prefer not to use Firebase at all, just leave `firebase-config.js` as-is with `YOUR_DATABASE_URL_HERE`. All scores will continue saving locally per browser.
- **Resetting scores**: To wipe the global leaderboard, delete the `leaderboard` node in the Firebase console.
