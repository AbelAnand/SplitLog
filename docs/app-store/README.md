# App Store submission kit

The app is called SplitLog. The bundle id, the URL scheme, the repository and the web address keep `fitlog`; that is invisible to users and to App Review.

Everything needed to submit SplitLog 1.0, in the order you will need it.

SplitLog keeps its data on the iPhone. There is no server, no account and nothing to configure, so
the only things to do before submitting are to publish the public pages and test on a real phone.

## 1. Before you archive

| Step | Where | Why |
|---|---|---|
| Push to `main` | GitHub | Publishes the pages in `site/`: overview, how-to guide, privacy policy, support. The listing links to them. |
| Check the three addresses in section 3 open | A browser | Apple rejects listings whose links do not load. |
| Run the phone checklist in section 6 | TestFlight | Some behaviour cannot be tested in the simulator. |

## 2. Build and upload

```bash
npm test             # unit tests
npm run build:ios    # production bundle into ios/
npm run ios          # opens Xcode
```

In Xcode choose **Any iOS Device**, then **Product → Archive → Distribute App → App Store Connect**.
The project is set to version 1.1.0 (build 3); 1.0 (1) was approved on 2026-10-07, iPhone only, portrait, no export-compliance prompt. 1.0.1 (build 2) was prepared but never uploaded; its link fix ships in 1.1.0.
Raise the build number for every later upload (build 1 was uploaded on 2026-10-07; the next is 2).

Do not archive after `vite build --mode simtest`: that bundle contains the simulator test tools.
`npm run build:ios` always produces a clean one.

## 3. Listing

| Field | Value |
|---|---|
| Name | SplitLog (fallback if taken: "SplitLog: Workout Tracker") |
| Subtitle | Private workout & PR tracker |
| Category | Health & Fitness |
| Age rating | 4+ (answer "None" to every content question) |
| Price | Free |
| Privacy Policy URL | https://abelanand.github.io/SplitLog/privacy.html |
| Support URL | https://abelanand.github.io/SplitLog/support.html (ticket form, delivered to dvapptester1@gmail.com) |
| Marketing URL | https://abelanand.github.io/SplitLog/ |
| Copyright | 2026 Abel Anand |

On 2026-10-13 version 1.1.0 was created in App Store Connect with the text below, and the Support, Marketing and Privacy Policy URLs were moved to the SplitLog site address (1.0 still carried the dead /FitLog/ links). The App Review notes and contact were carried over from 1.0.

**Subtitle** (30 max)

> Private workout & PR tracker

**Promotional text** (170 max)

> Log sets in seconds. No account, no ads, no subscription. Your workouts stay on your phone.

**Keywords** (100 max)

> workout,gym,log,tracker,lifting,weights,strength,sets,reps,PR,streak,split,cardio,private,offline

**Description** (rewritten 2026-10-13 after feedback that the first one read like a machine wrote it)

> SplitLog is a workout log with nothing in the way. Open it, tap a title, type weight and reps. No account to make, no ads, no subscription, nothing locked behind a paywall. It works in a basement gym with no signal, because it never needs one.
>
> Your log stays on your phone. SplitLog has no server and makes no network requests, so nobody can see your training, including the person who made it. Save a backup file whenever you like and restore it on a new phone. Export a spreadsheet if you want to crunch the numbers yourself.
>
> LOGGING
> • Warm-ups, drop sets, sets to failure
> • Fill down, quick fill, and last session's numbers right where you type
> • Hold and drag to reorder sets
> • Cardio with the figures you care about: time, distance, speed, incline, heart rate and more
> • Notes per exercise and per workout
>
> PROGRESS
> • A PR badge the moment you beat your best
> • Top-weight charts for every exercise
> • A weekly streak built around the number of days you choose to train
>
> PLANNING
> • Plan workouts ahead and check exercises off on the day
> • Save your split, Push Pull Legs Rest or whatever you run, and fill the calendar with it
> • Duplicate any workout onto other days
>
> SHARING
> • Send a session as a clean image, as text, or as a file a friend can open straight into their calendar
>
> MADE FOR IPHONE
> • Home Screen and Lock Screen widgets, and a Start workout button for Control Center
> • Reminders that run on your phone, only if you turn them on
> • Six themes, or make your own and share it as a code
> • Pounds or kilograms, miles or kilometres
>
> Built by one person who uses it every week.

**What's New** (for 1.1.0)

> Share a workout as an image, as text, or as a file a friend can open in SplitLog.
> Save your split and fill the calendar with it. Duplicate any workout onto other days.
> Make your own themes and share them as a code.
> Hold and drag to reorder sets. Add set now starts empty.
> The History tab is now Calendar.
> Fixed the help and privacy links.

**What's New** (for 1.0)

> First release.

**Screenshots**: `screenshots/` holds five 1320 × 2868 images (iPhone 6.9") and `screenshots-6.3/` the same five at 1206 × 2622, which is what the iPhone 6.1"/6.3" box in App Store Connect accepts. In order: Home, a workout,
Progress, the Year view of History, and Settings with the backup tools. That one size covers every iPhone.
They show example data made by the simulator test build, not anyone's real log. Refreshed 2026-10-06.

## 4. App Privacy answers

"Do you or your third-party partners collect data from this app?" **No.**

That gives the listing the "Data Not Collected" label. It matches `PrivacyInfo.xcprivacy`, which
declares no collected data and no tracking. The app makes no network requests at all.

## 5. App Review information

- **Sign-in required:** no. There are no accounts, so no demo account is needed.
- **Notes for the reviewer:**

> SplitLog is a workout log. It opens straight to the Home screen with nothing to sign in to.
> Tap "Start workout", choose a title, add an exercise and type a weight and reps.
> All data is stored on the device. The app makes no network requests and collects no data.
> Backup, restore and erase are in Settings → Your data.
> Reminders are local notifications; permission is requested only when the user turns them on in Settings.
> A finished workout or a plan opens for editing: changes are kept on screen until Save, and leaving asks Save or Discard. Workouts in progress save as you go.
> The app has no purchases, ads, or tracking.

## 6. Check on a real phone first

Install the archive through TestFlight and run this once.

1. With the keyboard open, tap **Add set**, **Create "…"** in the exercise picker, and a built-in exercise. Each must respond to a single tap. This could not be tested in the simulator.
2. Turn on Airplane Mode and log a workout. Everything must work as normal.
3. Log a weight above your best: the PR badge shows in full.
4. Settings → **Save a backup** → Save to Files. Then **Restore from a file** and pick it. The sheet must list your workouts.
5. Force-quit SplitLog and open it again. Your workouts are there.
6. Add both widgets to the Home Screen and tap each. Add the Start workout widget to the Lock Screen, and the Start workout control to a Lock Screen corner (hold the Lock Screen, Customize, tap the corner button). Each must open the start sheet.
7. Turn on a reminder and confirm iPhone asks for permission. On a fresh install, the permission question must not appear at launch or when starting a workout: it appears only from the Settings toggles.
8. Open a finished workout, change a set, and swipe from the left edge: nothing should happen while the change is unsaved. Tap back: the Save / Discard question appears. Discard, reopen the workout, and confirm the set is unchanged.
9. Open a finished workout, change a set, tap Save, then force-quit and reopen: the change is there.

## 7. Moving your own data into this version

Your workouts from the online version were copied to
`~/Documents/SplitLog Backups/fitlog-backup-2026-09-29-server-copy.json` on 2026-09-29, and the
server still holds them.

1. If you logged anything after that copy was made, take a fresh one: `npm run export:server`.
2. Send the newest file to your iPhone: AirDrop it, or put it in iCloud Drive.
3. Install this version on the phone. It starts empty.
4. Settings → **Restore from a file** → pick the file → **Restore**.
5. Check Home and History, then save a backup from the app itself and keep it in iCloud Drive.

Do not pause or delete the Supabase project until step 5 is done on the phone you are keeping.

## 8. Security

There is no server to attack and no account to take over. What remains:

- **Someone holding the unlocked phone** can open the app. The log is in the app's private storage, which iOS encrypts while the phone is locked.
- **Backup files are not encrypted.** They go wherever the user sends them.
- **A restored file is untrusted input.** Every record in it is checked and clamped before it is stored; see `src/db/clean.ts` and the hostile-file test in `src/__tests__/db.test.ts`.
