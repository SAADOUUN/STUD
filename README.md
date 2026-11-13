# STUD — Personal Study Dashboard & Course Vault

A privacy-first, minimalist study tracker and course resource vault inspired by Apple's design language (macOS & iOS).

Open **index.html** in any web browser to run locally, or deploy straight to Vercel with zero configuration.

---

## Highlights

- **Distinct Pages & Navigation**:
  - **Overview / Dashboard** (`#dashboard`): Daily stats, streak, weekly activity chart, goal progress, and subject breakdown by semester.
  - **Log Time** (`#logger`): Creative time entry widget with hours/minutes dual-typing, range scrubber with dynamic fill, ruler tick marks, steppers, preset chips, and mouse wheel dialer.
  - **Study Calendar** (`#calendar`): Interactive monthly calendar displaying daily study volume badges, task deadlines, and day inspector sheet.
  - **Course Files & Vault** (`#files`): Store and share **Cours**, **TP**, **TD**, and **Examens** locally (via IndexedDB) and in the cloud via **Google Drive**.
  - **Study Plan** (`#tasks`): iOS Reminders-style task manager with circular toggles, subject associations, and overdue alerts.
  - **Session History** (`#history`): Filterable log of all recorded study sessions with subject, semester, duration, date, and notes.

- **Google Drive Cloud Integration (Method 2)**:
  - **Automated Cloud Uploads**: Save course documents directly to a dedicated `STUD - Course Files` folder in your personal Google Drive.
  - **Cloud Data Sync**: 1-click **"Backup Study Data to Drive"** and **"Restore Data from Drive"** to sync your study logs, streak, and tasks seamlessly between your PC and phone.
  - **Direct Drive Previews & Links**: Open files in Google Drive / Google Docs, and share official Drive links directly.

---

## How to Set Up Google Drive (2 Minutes)

To enable direct Google Drive uploads and cloud sync:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a free project (e.g. *STUD*).
2. Go to **APIs & Services → Library**, search for **Google Drive API**, and click **Enable**.
3. Go to **OAuth consent screen**:
   - Choose **External** and enter an app name (e.g. *STUD*) and your email address.
   - Click Save and Continue.
4. Go to **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost`
     - `http://127.0.0.1`
     - Your Vercel domain (e.g. `https://your-project.vercel.app`).
   - Click **Create** and copy your **Client ID**.
5. In **STUD**, click **Google Drive** in the sidebar (or top bar on mobile), paste your Client ID, and click **Sign in with Google**!

---

## Vercel Deployment

Connect this repository to Vercel. With `vercel.json` pre-configured, it deploys instantly in seconds with zero build step and zero dependencies.
