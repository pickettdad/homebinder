# Stage 0 — owner setup, in plain language (2026-07-24)

This is your checklist for getting the iPad "scanner" app onto your iPad through
**TestFlight** (Apple's app for testing apps before they're on the App Store). It's
written for a non-programmer. The technical build plan lives in `PLAN-STAGE-0.md`; you
don't need to read that one.

None of this touches the everyday inspection app you've been testing in the browser —
this is only the extra native shell we need so we can try Apple's room-scanning (RoomPlan)
on your actual iPad.

---

## First: "Doesn't the developer account come with Xcode Cloud? Is that what we're using?"

Good question, and the short answer is **no — we're using GitHub, not Xcode Cloud, on
purpose.**

- **Xcode Cloud** is Apple's build service. It *is* included with your developer
  membership, but it has one catch that's a dealbreaker for us: **you set it up and drive
  it from inside Xcode, which only runs on a fairly new Mac.** Your 2015 MacBook Air can't
  run a modern Xcode at all, so we'd have no way to configure or babysit Xcode Cloud.
- **GitHub Actions** (what we're using) is a build service where the whole setup is a text
  file plus a few saved passwords ("secrets"), all done from a **web browser or your
  iPad** — no Mac required. The build runs on Apple computers in the cloud that GitHub
  rents, and the finished app is handed straight to TestFlight.

So the pipeline is: *code on GitHub → GitHub rents an Apple cloud Mac → it builds the app
→ it uploads to TestFlight → you install on your iPad.* You never need a capable Mac.
(If you ever buy an M-series Mac mini down the road, we can revisit Xcode Cloud — it'd be
a nice-to-have, not a need.)

The only money involved is the **$99/year Apple Developer fee you've already paid.** The
cloud build minutes stay inside the free allowance as long as we only build when we
choose to (which is how it's set up).

---

## What only you can do vs. what I handle

**Only you can do these** — they're inside *your* Apple account and *our* GitHub settings,
and I have no access to either:

1. ✅ Enroll in the Apple Developer Program — **done.**
2. Decide the app's name and its permanent "bundle ID."
3. Create an Apple "API key" and download its file.
4. Paste four values into GitHub as saved secrets.
5. Register the app in App Store Connect and turn on TestFlight for yourself.
6. Install the TestFlight app on your iPad and accept the invite.

**I handle everything else** — the actual app code, the build recipe, the RoomPlan
scanning module, and pressing "go" on builds. When your six items are done, I can produce
the first "hello" build and you'll get a TestFlight notification on your iPad.

Do them in order. Steps 2–5 are ~30–45 minutes total, one time, mostly clicking.

---

## Step 2 — Pick the app's name and bundle ID (2 minutes, just decide and tell me)

- **App name:** what shows under the icon in TestFlight, e.g. *HouseSteady Field*. Can be
  changed later.
- **Bundle ID:** a permanent, computer-style address for the app, written like a backwards
  web address. **This never changes once chosen, so pick once.** Suggested:
  **`ca.housesteady.field`**. (If you own a domain, we can mirror it, but this suggestion
  is perfectly fine.)

👉 **Your action:** reply with the app name you want and a yes/no on `ca.housesteady.field`.
That's all for this step.

---

## Step 3 — Create the Apple "API key" (10 minutes)

An **API key** is just a special password-file that lets our GitHub build prove to Apple
"I'm allowed to upload builds for this account," without storing your real Apple password
anywhere. You create it once.

1. In a browser, go to **appstoreconnect.apple.com** and sign in with your Apple ID.
2. Click **Users and Access** (top menu).
3. Click the **Integrations** tab, then **App Store Connect API** in the sidebar.
4. Under **Team Keys**, click the **+** (Generate API Key).
5. Name it something like `HouseSteady CI`. For **Access**, choose **App Manager**.
6. Click **Generate**.
7. You'll now see the key in a list. **Download the key file** (a file ending in `.p8`) by
   clicking **Download** next to it. ⚠️ **Apple lets you download it only once** — save it
   somewhere safe (not just the Downloads folder that gets cleaned out).
8. On that same page, write down two things you'll need in Step 4:
   - **Key ID** — a 10-character code shown next to the key (e.g. `2X9ABC7DEF`).
   - **Issuer ID** — a longer code (looks like `69a6de70-...-...`) shown near the top of
     the Keys section, labeled "Issuer ID."

You'll also need one more value, your **Team ID**:

9. Go to **developer.apple.com/account**, click **Membership details**, and copy the
   **Team ID** (a 10-character code).

Keep these four things handy for the next step: the **.p8 file**, the **Key ID**, the
**Issuer ID**, and the **Team ID**.

---

## Step 4 — Save the four secrets in GitHub (10 minutes)

"Secrets" are values GitHub stores in a locked box so the build can use them without ever
showing them in the code. You add them in the repository settings.

1. Go to the repository on **github.com** (`pickettdad/homebinder`).
2. Click **Settings** (top of the repo) → in the left sidebar, **Secrets and variables** →
   **Actions**.
3. Click **New repository secret** and add each of these four, one at a time. **The names
   must match exactly** (all caps, with underscores):

   | Secret name       | What to paste                                                        |
   |-------------------|----------------------------------------------------------------------|
   | `ASC_KEY_ID`      | the **Key ID** from Step 3 (the 10-character one)                    |
   | `ASC_ISSUER_ID`   | the **Issuer ID** from Step 3 (the long one)                        |
   | `ASC_KEY_P8`      | the **entire contents of the .p8 file** — see note below            |
   | `APPLE_TEAM_ID`   | the **Team ID** from Step 3                                          |

   **For `ASC_KEY_P8`:** open the `.p8` file in a plain text editor (TextEdit, Notes, or
   even the GitHub secret box will accept a paste). Copy **everything**, including the
   `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines, and paste the whole
   block in as the secret value.

4. Click **Add secret** for each. When done you should see four secrets listed (their
   values are hidden — that's correct).

👉 **Tell me when these four are in.** I can't see their values (that's the point), but I
can see that they exist, and that's my green light to wire up the build.

---

## Step 5 — Register the app + turn on TestFlight (10 minutes)

This creates the app's "slot" in Apple's system so a build has somewhere to land.

1. Back in **appstoreconnect.apple.com**, first register the bundle ID: go to
   **developer.apple.com/account** → **Certificates, Identifiers & Profiles** →
   **Identifiers** → **+** → **App IDs** → **App**. Enter a description (e.g.
   *HouseSteady Field*) and the **Bundle ID** you chose in Step 2
   (`ca.housesteady.field`). Leave the capability checkboxes at their defaults and
   **Register**.
2. Now the app record: **appstoreconnect.apple.com** → **Apps** → **+** → **New App**.
   - Platform: **iOS**
   - Name: your app name from Step 2
   - Primary language: **English (Canada)** (or your preference)
   - Bundle ID: pick the one you just registered
   - SKU: any short code you like, e.g. `housesteady-field` (it's just an internal label)
   - Click **Create**.
3. TestFlight for yourself needs no review: once our first build uploads, open the app in
   App Store Connect → **TestFlight** tab → under **Internal Testing** you (the account
   holder) can be added as a tester. I'll point you to the exact spot when the first build
   lands, since it only appears after an upload.

---

## Step 6 — Install TestFlight on your iPad (2 minutes)

1. On your iPad, open the **App Store** and install the app called **TestFlight** (made by
   Apple).
2. Sign in with the **same Apple ID** as your developer account.
3. When I trigger the first build and add you as a tester, you'll get an email / a
   TestFlight notification. Open TestFlight → accept → **Install**. That's the scanner app
   on your iPad.

---

## What happens after your six steps

I build the **"hello shell"** first: your current inspection app wrapped as a native app,
with *no* scanning code yet. Its only job is to prove the whole chain works —
enrollment → build → upload → TestFlight → install. Once that green-lights, I add the
RoomPlan scanning and you'll do the real test: scan your utility room (twice — once in
normal light, once with a work light) and a couple of main-floor rooms, and we'll see
whether Apple's room scan is good enough to be your floor-plan starting point or whether
we lean on photo canvases instead. Either answer is useful — the app already handles both.

**Bottom line for you right now:** do Step 2 (just decide the name — 2 minutes), then work
through Steps 3–6 when you have ~40 minutes. Ping me after Step 4 (the GitHub secrets) and
I'll take it from there.
