# Publishing the Android app

The Android app is a **Trusted Web Activity (TWA)**: a small Play Store app
that opens the web app full-screen inside Chrome. This is deliberate — a
normal WebView wrapper can't do Web Bluetooth, so the WitMotion sensor
wouldn't work. Running inside Chrome keeps Bluetooth and the microphone
working with no code changes.

A useful consequence: **changes to the web app go live on everyone's phone
without a new Play Store release.** You only upload a new build when
something in `android/` changes.

```
android/                 Android project (TWA shell around the hosted web app)
.github/workflows/
  pages.yml              Publishes the web app to GitHub Pages
  android.yml            Builds the debug APK and (once signing is set up) the Play bundle
store/                   Play Store listing assets (icon, feature graphic, screenshots)
privacy.html             Privacy policy (Play requires one because the app uses the microphone)
```

## 1. Turn on GitHub Pages (hosts the app)

1. On GitHub, open the repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to **Actions → Deploy web app to GitHub Pages → Run workflow**.

The app will be live at **https://delbot1234-ai.github.io/cellovisualisation/**.
Open that in Chrome on your Android phone and check that Bluetooth (your
WT9011DCL) and the tuner both work — this is exactly what the Play Store app
will run.

## 2. Try the Android app on your phone (no Play Store needed)

Every push that touches `android/` builds a test APK.

1. **Actions → Android app →** the latest run → **Artifacts →
   cello-bow-debug-apk**. Download and unzip it.
2. Copy the `.apk` to your phone and open it (Android will ask you to allow
   installing from that source).

Until step 5 is done, the app shows a small Chrome address bar at the top.
That's expected and harmless.

## 3. Create your upload key (once)

Google Play needs builds signed with a key only you hold. On your computer
(needs Java — installing Android Studio provides it):

```sh
keytool -genkeypair -v -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Pick a strong password and **store the `.jks` file and password somewhere
safe** (a password manager). Never commit it — `.gitignore` already blocks
`*.jks`.

Then turn the file into text so GitHub can store it as a secret:

| OS | Command |
|---|---|
| macOS | `base64 -i upload.jks \| pbcopy` (copies it) |
| Linux | `base64 -w0 upload.jks` |
| Windows (PowerShell) | `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) \| Set-Clipboard` |

## 4. Add the key to GitHub and build the Play bundle

Repo → **Settings → Secrets and variables → Actions → New repository
secret**. Add four secrets:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the base64 text from step 3 |
| `ANDROID_KEYSTORE_PASSWORD` | your keystore password |
| `ANDROID_KEY_ALIAS` | `upload` (or whatever you used for `-alias`) |
| `ANDROID_KEY_PASSWORD` | your key password (same as the keystore password unless you set a different one) |

Then **Actions → Android app → Run workflow**. The run now also produces a
**cello-bow-release-aab** artifact — the `.aab` file you upload to Google
Play. Each build gets a new version code automatically (the workflow run
number), so Play never rejects an upload for reusing one.

## 5. Publish on Google Play

1. Create a Google Play developer account at
   [play.google.com/console](https://play.google.com/console) (one-time
   US$25 fee plus identity verification).
2. **Create app** → name "Cello Bow Explorer", type *App*, *Free*.
3. Upload the `.aab` to **Testing → Closed testing**, and accept **Play App
   Signing** when asked (Google then holds the final signing key; if you
   ever lose your upload key it can be reset).
4. **Personal developer accounts must run a closed test with at least 12
   testers opted in for 14 days in a row** before Google allows a
   production release. Recruit testers early (friends, students, other
   cellists) — they need a Google account and must opt in via the link
   Play gives you.
5. Fill in the listing and policy forms:
   - **Store listing**: app icon `store/icon-512.png`, feature graphic
     `store/feature-graphic-1024x500.png`, phone screenshots
     `store/screenshot-*.png`. For the optional promo video, upload
     `store/demo-video.mp4` to YouTube (public or unlisted) and paste the
     link — Play only accepts YouTube URLs.
   - **Privacy policy URL**:
     `https://delbot1234-ai.github.io/cellovisualisation/privacy.html`
   - **Data safety**: the app collects and shares **no** user data.
     Microphone audio and Bluetooth sensor data are processed on-device
     only and never transmitted.
   - **Content rating** questionnaire, **target audience**, and **ads**
     (no ads).
6. After the 14-day test, apply for **production access** and roll out.

## 6. Remove the address bar (Digital Asset Links)

Chrome hides its address bar only once the website proves it belongs to
the app. That proof is a file at
`https://delbot1234-ai.github.io/.well-known/assetlinks.json` — the **root**
of your GitHub Pages domain. A project site like this repo lives under
`/cellovisualisation/`, so the file has to go in a separate repo named
**`delbot1234-ai.github.io`** (your GitHub user site):

1. Create a public repo named exactly `delbot1234-ai.github.io`.
2. Add the file `.well-known/assetlinks.json`:

   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "io.github.delbot1234ai.cellobow",
       "sha256_cert_fingerprints": ["PASTE:THE:SHA256:FINGERPRINT"]
     }
   }]
   ```

3. Get the fingerprint from **Play Console → Test and release → App
   integrity → App signing → App signing key certificate → SHA-256**.
4. Add an empty file named `.nojekyll` at the root of that repo (otherwise
   GitHub Pages ignores folders starting with `.`), then enable Pages for it
   (Settings → Pages → Deploy from branch → main).

Alternatively, point a custom domain at this site; then `assetlinks.json`
can live in this repo and you update `twaHostName`, `twaLaunchUrl` and
`twaPathPrefix` in `android/gradle.properties`.

## Things that are fixed once published

- **Package name** `io.github.delbot1234ai.cellobow` (in
  `android/app/build.gradle`) is the app's permanent identity on Google
  Play. Change it *before* the first upload if you want something else.
- **Hosting URL**: installed copies open whatever URL was in the build, so
  moving the web app later means shipping a new Android build.
