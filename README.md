# STUD — Personal Study Dashboard & Course Vault

A privacy-first, minimalist study tracker and course resource vault inspired by Apple's design language (macOS & iOS).

Open **index.html** in any web browser to run locally, or deploy straight to Vercel with zero configuration.

---

## Highlights

- **Distinct Pages & Navigation**:
  - **Overview / Dashboard** (`#dashboard`): Daily stats, streak, weekly activity chart, goal progress, and subject breakdown by semester.
  - **Log Time** (`#logger`): Creative time entry widget with hours/minutes dual-typing, range scrubber with dynamic fill, ruler tick marks, steppers, preset chips, and mouse wheel dialer.
  - **Study Calendar** (`#calendar`): Interactive monthly calendar displaying daily study volume badges, task deadlines, and day inspector sheet.
  - **Course Files & Vault** (`#files`): Store and share **Cours**, **TP**, **TD**, and **Examens** in **Google Drive**. Study records remain available locally in your browser.
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


## Interface and organized uploads

The refreshed interface includes custom keyboard-accessible choice menus, responsive layouts, subtle animation, and reduced-motion support.

New uploads are organized automatically:

```text
STUD - Course Files/
  STUD-data-backup.json
  Semester 1/
    Module name/
      Cours/
      TP/
      TD/
      Examens/
      Resources/
```

Folders are created as needed. The upload dialog previews the destination. Existing files stay in their original location. Renaming a semester or module affects future upload destinations; it does not move existing files.

Drive errors are reported before marking uploads, backups, or deletions successful. Drag-and-drop does not depend on the hidden file input's browser validation. Legacy IndexedDB files are preserved.


## Daily study features

- **Today** is the default home screen, with the next pending task, upcoming deadlines, and exam countdowns. Start studying opens the existing logger with the module selected.
- **Modules** groups each subject's course files, pending tasks, exams, session history, and task completion progress.
- **Exam countdowns** are saved locally and included in Drive backups. Modules with an exam within 14 days and less than an hour logged this week are flagged for attention.
- **Document preview** opens Drive's embedded viewer with pending module tasks alongside it. Preview access depends on Google sign-in and file permissions; Open in Drive is always available.
- **Weekly recap** compares the current Monday?Sunday week with the previous week, shows time by module, and highlights modules with outstanding work and little study time. Task completion is lifetime progress, not a weekly completion count.
- **Appearance** supports System, Light, and Dark. Desktop settings are in the sidebar; the mobile appearance button cycles modes. The preference is stored on this device.


## Connected planning tools

- Exams appear in the calendar with a distinct pink badge and in the selected-day inspector.
- Use **Edit** in History, Study Plan, exam cards, module sessions, or search results to update existing records.
- **Search everything** (Ctrl+K / Cmd+K) finds modules, filenames, tasks, exams, and session notes. Open a result to enter its workspace, preview the file, or edit the record.
- Each module workspace has a **Weekly study target**. The default is 60 minutes; set a custom target or zero to disable it. Targets are included in cloud backups and used for revision attention flags.
- The top utility bar shows sync state, the last successful sync time, and a retry action. Failed Drive requests preserve local data and never advance the successful-sync timestamp.
- Today offers **Resume module** and **Reopen document** for this device's last workspace and preview.

## Browser regression checks

On Windows with Node.js and Google Chrome installed, run:

```powershell
node tests/run-browser.cjs
```

The runner launches a separate headless Chrome profile, generates a test copy of the current HTML, and runs 39 checks at desktop and emulated phone sizes. Drive responses are mocked and external Google requests are blocked. Screenshots and generated browser artifacts are ignored by Git; the tests directory is excluded from Vercel deployments. No live Google account is needed.
