const $ = id => document.getElementById(id);
const KEY = 'stud-v1';

/* ============================================================
   DEFAULT DATA & MIGRATION
============================================================ */
const defaultSemesters = [
  { id: 'sem-1', name: 'Semester 1' }
];

const defaultSubjects = [
  { id: 'php-fw', name: 'Programmation PHP et Frameworks', semesterId: 'sem-1' },
  { id: 'sys-exp', name: "Systèmes d'exploitation", semesterId: 'sem-1' },
  { id: 'info-resp', name: 'Informatique Responsable', semesterId: 'sem-1' },
  { id: 'csi', name: "Conception des systèmes d'information", semesterId: 'sem-1' },
  { id: 'poo-cpp', name: 'POO (C++)', semesterId: 'sem-1' },
  { id: 'sql-plsql', name: 'SQL, PL-SQL', semesterId: 'sem-1' },
  { id: 'compil', name: 'Compilation', semesterId: 'sem-1' },
  { id: 'dev-web', name: 'Développement Web', semesterId: 'sem-1' },
  { id: 'reseaux', name: 'Réseaux Informatiques', semesterId: 'sem-1' }
];

const fresh = () => ({
  semesters: JSON.parse(JSON.stringify(defaultSemesters)),
  subjects: JSON.parse(JSON.stringify(defaultSubjects)),
  sessions: [],
  tasks: [],
  files: [],
  goal: 600,
  updatedAt: Date.now()
});

function migrateState(s) {
  if (!s || typeof s !== 'object') return fresh();
  if (!Array.isArray(s.semesters) || s.semesters.length === 0) {
    s.semesters = JSON.parse(JSON.stringify(defaultSemesters));
  }
  const sem1 = s.semesters[0];

  const isOldDefault = !Array.isArray(s.subjects) ||
    (s.subjects.length === 1 && s.subjects[0].id === 'general') ||
    s.subjects.length === 0;

  if (isOldDefault) {
    s.subjects = JSON.parse(JSON.stringify(defaultSubjects));
    if (Array.isArray(s.sessions)) {
      s.sessions.forEach(sess => {
        if (sess.subject === 'general') sess.subject = s.subjects[0].id;
      });
    }
  } else {
    const hasAnySem1 = defaultSubjects.some(ds => s.subjects.some(sub => sub.name.toLowerCase() === ds.name.toLowerCase()));
    if (!hasAnySem1) {
      defaultSubjects.forEach(ds => {
        s.subjects.push({ ...ds, semesterId: sem1.id });
      });
    }
    s.subjects.forEach(sub => {
      if (!sub.semesterId || !s.semesters.some(sem => sem.id === sub.semesterId)) {
        sub.semesterId = sem1.id;
      }
    });
  }

  if (!Array.isArray(s.sessions)) s.sessions = [];
  if (!Array.isArray(s.tasks)) s.tasks = [];
  if (!Array.isArray(s.files)) s.files = [];
  if (!Number.isFinite(s.goal) || s.goal <= 0) s.goal = 600;
  if (!Number.isFinite(s.updatedAt)) s.updatedAt = Date.now();
  return s;
}

let state;
try {
  const raw = localStorage.getItem(KEY);
  state = raw ? migrateState(JSON.parse(raw)) : fresh();
} catch {
  state = fresh();
}

let currentSemesterTab = 'all';

/* Helper functions */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const day = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const minutes = list => list.reduce((n, s) => n + s.minutes, 0);
const duration = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => el.style.display = 'none', 3500);
}

function save(autoSync = true) {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Storage unavailable', e);
  }
  if (autoSync && typeof triggerAutoSync === 'function') {
    triggerAutoSync();
  }
}

function semesterName(id) {
  return state.semesters.find(s => s.id === id)?.name || 'Semester';
}

function subjectObj(id) {
  return state.subjects.find(s => s.id === id);
}

function subjectName(id) {
  return subjectObj(id)?.name || 'Study session';
}

function subjectSemesterName(id) {
  const sub = subjectObj(id);
  if (!sub) return '';
  return semesterName(sub.semesterId);
}

function weekDays() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const n = new Date(d);
    n.setDate(d.getDate() + i);
    return n;
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function renderSubjectOptions(selectedId, includeAllOption = false) {
  let html = includeAllOption ? '<option value="all">All Subjects</option>' : '';
  const groups = state.semesters.map(sem => {
    const subs = state.subjects.filter(s => s.semesterId === sem.id);
    if (!subs.length) return '';
    return `<optgroup label="${esc(sem.name)}">${subs.map(s => `<option value="${esc(s.id)}" ${s.id === selectedId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`;
  }).filter(Boolean);

  const unassigned = state.subjects.filter(s => !state.semesters.some(sem => sem.id === s.semesterId));
  if (unassigned.length) {
    groups.push(`<optgroup label="Other">${unassigned.map(s => `<option value="${esc(s.id)}" ${s.id === selectedId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`);
  }

  return html + (groups.join('') || '<option value="">No subjects yet</option>');
}

function renderSubjectRow(s, denominator, showBadge) {
  const total = minutes(state.sessions.filter(x => x.subject === s.id));
  const pct = denominator ? (total / denominator) * 100 : 0;
  return `<div class="subject-row">
    <div class="subject-row-top">
      <div>
        <strong><span class="subject-dot"></span>${esc(s.name)}</strong>
        ${showBadge ? `<span class="badge">${esc(semesterName(s.semesterId))}</span>` : ''}
      </div>
      <div class="subject-meta">
        <small>${duration(total)}</small>
        <button class="delete" data-subject-delete="${esc(s.id)}" aria-label="Delete ${esc(s.name)}" title="Delete subject">×</button>
      </div>
    </div>
    <progress max="100" value="${pct}" aria-label="${esc(s.name)} share of study time"></progress>
  </div>`;
}

function recordSession(subject, m, date, note) {
  state.sessions.push({
    id: uid(),
    subject,
    minutes: m,
    date,
    note: (note || '').trim(),
    created: Date.now()
  });
}

/* ============================================================
   DISTINCT PAGE ROUTER (SPA VIEWS)
============================================================ */
const VALID_PAGES = ['dashboard', 'logger', 'calendar', 'files', 'tasks', 'history'];

function switchPage(pageId, updateHash = true) {
  if (!VALID_PAGES.includes(pageId)) pageId = 'dashboard';

  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${pageId}`);
  });

  document.querySelectorAll('[data-page]').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  if (updateHash && window.location.hash !== `#${pageId}`) {
    history.pushState(null, '', `#${pageId}`);
  }

  window.scrollTo({ top: 0, behavior: 'instant' });

  if (pageId === 'calendar') renderCalendar();
  if (pageId === 'files') renderFiles();
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  switchPage(hash, false);
});

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const targetPage = a.getAttribute('href').replace('#', '');
  if (VALID_PAGES.includes(targetPage)) {
    e.preventDefault();
    switchPage(targetPage, true);
  }
});

/* ============================================================
   GOOGLE DRIVE INTEGRATION & AUTOMATED CLOUD SYNC
============================================================ */
const GDRIVE_TOKEN_KEY = 'stud_gdrive_token';
const GDRIVE_EXP_KEY = 'stud_gdrive_exp';
const GDRIVE_CLIENT_ID_KEY = 'stud_gdrive_client_id';
const GDRIVE_FOLDER_ID_KEY = 'stud_gdrive_folder_id';

let gdriveTokenClient = null;
let gdriveAccessToken = null;
let autoSyncTimeout = null;

function getGoogleClientId() {
  return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || '';
}

function setGoogleClientId(id) {
  localStorage.setItem(GDRIVE_CLIENT_ID_KEY, (id || '').trim());
}

function isGoogleDriveConnected() {
  const token = localStorage.getItem(GDRIVE_TOKEN_KEY);
  const exp = Number(localStorage.getItem(GDRIVE_EXP_KEY) || 0);
  if (token && exp > Date.now()) {
    gdriveAccessToken = token;
    return true;
  }
  return false;
}

function handleExpiredToken() {
  localStorage.removeItem(GDRIVE_TOKEN_KEY);
  localStorage.removeItem(GDRIVE_EXP_KEY);
  gdriveAccessToken = null;
  updateGoogleDriveUI('error');
}

function disconnectGoogleDrive() {
  localStorage.removeItem(GDRIVE_TOKEN_KEY);
  localStorage.removeItem(GDRIVE_EXP_KEY);
  localStorage.removeItem(GDRIVE_FOLDER_ID_KEY);
  gdriveAccessToken = null;
  updateGoogleDriveUI('disconnected');
  toast('Disconnected from Google Drive.');
}

function requestGoogleDriveToken() {
  const clientId = getGoogleClientId();
  if (!clientId) {
    openGoogleDriveModal();
    toast('Please enter your Google Cloud Client ID.');
    return;
  }

  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    toast('Google Identity Services is loading. Please try again in a few seconds.');
    return;
  }

  try {
    gdriveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: async (resp) => {
        if (resp.error !== undefined) {
          console.error('Google Auth Error:', resp);
          toast('Google authorization failed: ' + (resp.error_description || resp.error));
          updateGoogleDriveUI('error');
          return;
        }
        gdriveAccessToken = resp.access_token;
        localStorage.setItem(GDRIVE_TOKEN_KEY, gdriveAccessToken);
        localStorage.setItem(GDRIVE_EXP_KEY, Date.now() + (Number(resp.expires_in || 3599) * 1000));
        updateGoogleDriveUI('synced');
        toast('✓ Connected to Google Drive!');
        $('gdrive-modal')?.close();
        try {
          await getOrCreateStudFolder();
          await syncWithGoogleDrive(true);
        } catch (e) {
          console.warn('Initial folder/sync:', e);
        }
      }
    });
    gdriveTokenClient.requestAccessToken({ prompt: '' });
  } catch (err) {
    toast('Could not start Google Sign-In. Check your Client ID.');
    console.error(err);
  }
}

async function getOrCreateStudFolder() {
  if (!gdriveAccessToken) throw new Error('Not connected to Google Drive');
  let folderId = localStorage.getItem(GDRIVE_FOLDER_ID_KEY);
  if (folderId) return folderId;

  const q = "name = 'STUD - Course Files' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { 'Authorization': 'Bearer ' + gdriveAccessToken }
  });

  if (searchRes.status === 401) {
    handleExpiredToken();
    throw new Error('Google Drive session expired. Please reconnect.');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    folderId = searchData.files[0].id;
    localStorage.setItem(GDRIVE_FOLDER_ID_KEY, folderId);
    return folderId;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + gdriveAccessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'STUD - Course Files',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (createRes.status === 401) {
    handleExpiredToken();
    throw new Error('Google Drive session expired. Please reconnect.');
  }

  const folderData = await createRes.json();
  folderId = folderData.id;
  localStorage.setItem(GDRIVE_FOLDER_ID_KEY, folderId);
  return folderId;
}

async function uploadFileToGoogleDrive(file, customTitle) {
  const folderId = await getOrCreateStudFolder();
  const metadata = {
    name: customTitle || file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + gdriveAccessToken },
    body: form
  });

  if (res.status === 401) {
    handleExpiredToken();
    throw new Error('Google Drive session expired. Please reconnect.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Google Drive upload failed');
  }

  return await res.json();
}

async function deleteFileFromGoogleDrive(fileId) {
  if (!isGoogleDriveConnected() || !fileId) return;
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + gdriveAccessToken }
    });
  } catch (err) {
    console.warn('Drive file deletion error:', err);
  }
}

async function backupStudyDataToGoogleDrive(silent = false) {
  if (!isGoogleDriveConnected()) {
    if (!silent) openGoogleDriveModal();
    return;
  }
  try {
    if (!silent) toast('Syncing with Google Drive...');
    updateGoogleDriveUI('syncing');

    const folderId = await getOrCreateStudFolder();
    const fileName = 'STUD-data-backup.json';

    const q = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
      headers: { 'Authorization': 'Bearer ' + gdriveAccessToken }
    });

    if (searchRes.status === 401) {
      handleExpiredToken();
      throw new Error('Session expired. Please reconnect.');
    }

    const searchData = await searchRes.json();
    const existingFile = searchData.files && searchData.files[0];

    const payload = {
      semesters: state.semesters,
      subjects: state.subjects,
      sessions: state.sessions,
      tasks: state.tasks,
      files: state.files,
      goal: state.goal,
      updatedAt: state.updatedAt || Date.now()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });

    if (existingFile) {
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + gdriveAccessToken },
        body: blob
      });
    } else {
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], { type: 'application/json' }));
      form.append('file', blob);
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + gdriveAccessToken },
        body: form
      });
    }
    updateGoogleDriveUI('synced');
    if (!silent) toast('✓ Study data backed up to Google Drive!');
  } catch (err) {
    console.error(err);
    updateGoogleDriveUI('error');
    if (!silent) toast('Backup error: ' + (err.message || 'Failed to upload backup to Drive'));
    throw err;
  }
}

async function syncWithGoogleDrive(silent = false) {
  if (!isGoogleDriveConnected()) {
    if (!silent) openGoogleDriveModal();
    return;
  }
  try {
    if (!silent) toast('Checking Google Drive for updates...');
    updateGoogleDriveUI('syncing');

    const folderId = await getOrCreateStudFolder();
    const fileName = 'STUD-data-backup.json';

    const q = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)`, {
      headers: { 'Authorization': 'Bearer ' + gdriveAccessToken }
    });

    if (searchRes.status === 401) {
      handleExpiredToken();
      throw new Error('Session expired. Please reconnect.');
    }

    const searchData = await searchRes.json();
    const existingFile = searchData.files && searchData.files[0];

    if (!existingFile) {
      await backupStudyDataToGoogleDrive(true);
      updateGoogleDriveUI('synced');
      if (!silent) toast('✓ Initialized cloud backup on Google Drive!');
      return;
    }

    const fileId = existingFile.id;
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': 'Bearer ' + gdriveAccessToken }
    });
    const remoteData = await downloadRes.json();

    if (!validBackup(remoteData)) {
      console.warn('Invalid remote data structure; keeping local.');
      updateGoogleDriveUI('synced');
      return;
    }

    const localUpdated = Number(state.updatedAt || 0);
    const remoteUpdated = Number(remoteData.updatedAt || 0);

    const localEmpty = (!state.sessions || state.sessions.length === 0) && (!state.tasks || state.tasks.length === 0) && (!state.files || state.files.length === 0);
    const remoteHasData = (remoteData.sessions && remoteData.sessions.length > 0) || (remoteData.tasks && remoteData.tasks.length > 0) || (remoteData.files && remoteData.files.length > 0);

    if (remoteUpdated > localUpdated || (localEmpty && remoteHasData)) {
      state = migrateState({ ...remoteData, timer: null });
      localStorage.setItem(KEY, JSON.stringify(state));
      render();
      renderFiles();
      renderDashboardFilesPreview();
      updateGoogleDriveUI('synced');
      if (!silent) toast('✓ Updated with latest study data from Google Drive!');
    } else if (localUpdated > remoteUpdated) {
      await backupStudyDataToGoogleDrive(true);
      updateGoogleDriveUI('synced');
      if (!silent) toast('✓ Google Drive synced with latest local changes!');
    } else {
      updateGoogleDriveUI('synced');
      if (!silent) toast('✓ Everything is up to date.');
    }
  } catch (err) {
    console.error('Sync error:', err);
    updateGoogleDriveUI('error');
    if (!silent) toast('Sync error: ' + (err.message || 'Could not sync with Google Drive'));
  }
}

function triggerAutoSync() {
  if (!isGoogleDriveConnected()) {
    updateGoogleDriveUI('disconnected');
    return;
  }
  updateGoogleDriveUI('syncing');
  clearTimeout(autoSyncTimeout);
  autoSyncTimeout = setTimeout(async () => {
    try {
      await backupStudyDataToGoogleDrive(true);
      updateGoogleDriveUI('synced');
    } catch (err) {
      console.warn('Auto-sync failed:', err);
      updateGoogleDriveUI('error');
    }
  }, 1500);
}

function openGoogleDriveModal() {
  const modalEl = $('gdrive-modal');
  if (!modalEl) return;
  const clientIdInput = $('gdrive-client-id-input');
  if (clientIdInput) clientIdInput.value = getGoogleClientId();
  updateGoogleDriveUI();
  modalEl.showModal();
}

function updateGoogleDriveUI(syncState = null) {
  const connected = isGoogleDriveConnected();
  const effectiveState = connected ? (syncState || 'synced') : 'disconnected';

  // 1. Sidebar Cloud Card
  const syncStatusEl = $('cloud-sync-status');
  const statusDescEl = $('cloud-status-desc');
  const cardActionsEl = $('cloud-card-actions');

  if (syncStatusEl) {
    if (!connected) {
      syncStatusEl.innerHTML = '<span class="sync-dot disconnected"></span> Not Connected';
    } else if (effectiveState === 'syncing') {
      syncStatusEl.innerHTML = '<span class="sync-dot syncing"></span> Syncing...';
    } else if (effectiveState === 'error') {
      syncStatusEl.innerHTML = '<span class="sync-dot disconnected"></span> Re-auth needed';
    } else {
      syncStatusEl.innerHTML = '<span class="sync-dot synced"></span> Synced';
    }
  }

  if (statusDescEl) {
    statusDescEl.textContent = connected
      ? 'Automatic cloud sync is active. All sessions and course files sync to your Google Drive.'
      : 'Connect your Google Drive to sync sessions, tasks & course files across all your devices.';
  }

  if (cardActionsEl) {
    cardActionsEl.innerHTML = connected ? `
      <button type="button" id="btn-sidebar-manage" class="apple-btn-secondary" style="width:100%;font-size:12px;padding:7px 10px">
        Manage Cloud ⚙
      </button>
    ` : `
      <button type="button" id="btn-sidebar-connect" class="apple-btn-primary" style="width:100%;font-size:12px;padding:7px 10px">
        <span class="gdrive-icon">☁️</span> Connect Google Drive
      </button>
    `;

    const manageBtn = $('btn-sidebar-manage');
    if (manageBtn) manageBtn.onclick = () => openGoogleDriveModal();
    const connectBtn = $('btn-sidebar-connect');
    if (connectBtn) connectBtn.onclick = () => openGoogleDriveModal();
  }

  // 2. Mobile Top Bar
  const mobileDot = $('mobile-cloud-dot');
  const mobileLabel = $('mobile-cloud-label');
  if (mobileDot) {
    mobileDot.className = 'dot ' + (connected ? (effectiveState === 'syncing' ? 'syncing' : 'synced') : 'disconnected');
  }
  if (mobileLabel) {
    mobileLabel.textContent = connected ? (effectiveState === 'syncing' ? 'Syncing...' : 'Drive') : 'Connect';
  }

  // 3. Modal Views
  const disconnBox = $('gdrive-disconnected-box');
  const connBox = $('gdrive-connected-box');
  const statusBadge = $('gdrive-modal-status-badge');

  if (disconnBox && connBox && statusBadge) {
    if (connected) {
      disconnBox.style.display = 'none';
      connBox.style.display = 'block';
      statusBadge.textContent = 'CONNECTED';
      statusBadge.className = 'apple-pill';
      statusBadge.style.background = 'var(--apple-green-tint)';
      statusBadge.style.color = 'var(--apple-green)';
    } else {
      disconnBox.style.display = 'block';
      connBox.style.display = 'none';
      statusBadge.textContent = 'NOT CONNECTED';
      statusBadge.className = 'apple-pill';
      statusBadge.style.background = 'var(--apple-blue-tint)';
      statusBadge.style.color = 'var(--apple-blue)';
    }
  }
}

function setupGoogleDriveListeners() {
  const vaultBtn = $('btn-gdrive-vault');
  if (vaultBtn) vaultBtn.onclick = () => openGoogleDriveModal();

  const mobileBtn = $('mobile-cloud-btn');
  if (mobileBtn) mobileBtn.onclick = () => openGoogleDriveModal();

  const closeBtn = $('gdrive-modal-close');
  if (closeBtn) closeBtn.onclick = () => $('gdrive-modal')?.close();

  const closeConnectedBtn = $('gdrive-modal-close-connected');
  if (closeConnectedBtn) closeConnectedBtn.onclick = () => $('gdrive-modal')?.close();

  const signInBtn = $('btn-gdrive-signin');
  if (signInBtn) {
    signInBtn.onclick = () => {
      const clientId = $('gdrive-client-id-input')?.value.trim();
      if (!clientId) {
        toast('Please enter your Google Cloud Client ID.');
        return;
      }
      setGoogleClientId(clientId);
      requestGoogleDriveToken();
    };
  }

  const disconnectBtn = $('btn-gdrive-disconnect');
  if (disconnectBtn) disconnectBtn.onclick = () => disconnectGoogleDrive();

  const syncBtn = $('btn-gdrive-sync-now');
  if (syncBtn) syncBtn.onclick = () => syncWithGoogleDrive(false);

  const openFolderBtn = $('btn-gdrive-open-folder');
  if (openFolderBtn) {
    openFolderBtn.onclick = () => {
      const folderId = localStorage.getItem(GDRIVE_FOLDER_ID_KEY);
      if (folderId) {
        window.open('https://drive.google.com/drive/folders/' + folderId, '_blank');
      } else {
        window.open('https://drive.google.com/drive', '_blank');
      }
    };
  }
}

function cleanupLegacyIndexedDB() {
  try {
    if (window.indexedDB) {
      window.indexedDB.deleteDatabase('stud_files_db');
    }
  } catch (e) {
    // ignore
  }
}

async function initCloudSync() {
  cleanupLegacyIndexedDB();
  updateGoogleDriveUI();
  if (isGoogleDriveConnected()) {
    try {
      await getOrCreateStudFolder();
      await syncWithGoogleDrive(true);
    } catch (err) {
      console.warn('Startup sync:', err);
    }
  }
}

/* ============================================================
   GOOGLE DRIVE CLOUD COURSE FILES VAULT (COURS, TP, TD, EXAMS)
============================================================ */
let activeFileCategory = 'all';
let activeFileSubject = 'all';
let fileSearchQuery = '';

function getFileIcon(type, name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (type.includes('pdf') || ext === 'pdf') return '📕';
  if (type.includes('image') || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return '📦';
  if (['c', 'cpp', 'h', 'php', 'js', 'html', 'css', 'py', 'sql', 'java'].includes(ext)) return '💻';
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return '📝';
  if (['ppt', 'pptx'].includes(ext)) return '📊';
  return '📄';
}

function renderFiles() {
  const grid = $('files-grid');
  if (!grid) return;

  const filesList = Array.isArray(state.files) ? state.files : [];
  let filtered = [...filesList];

  if (activeFileCategory !== 'all') {
    filtered = filtered.filter(f => f.category === activeFileCategory);
  }
  if (activeFileSubject !== 'all') {
    filtered = filtered.filter(f => f.subjectId === activeFileSubject);
  }
  if (fileSearchQuery.trim()) {
    const q = fileSearchQuery.toLowerCase();
    filtered = filtered.filter(f => (f.name || '').toLowerCase().includes(q) || (f.customTitle || '').toLowerCase().includes(q));
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column: 1 / -1; padding: 48px 16px;">
        <span style="font-size:36px;display:block;margin-bottom:8px">☁️</span>
        <strong>No documents in your Cloud Vault.</strong><br>
        Store your Cours, TP code, TD exercises, or past exams directly in your Google Drive.
        <br><button class="apple-btn-primary" id="btn-empty-upload" style="margin-top:14px">+ Upload to Google Drive</button>
      </div>
    `;
    const emptyBtn = $('btn-empty-upload');
    if (emptyBtn) emptyBtn.onclick = () => openUploadModal();
    return;
  }

  grid.innerHTML = filtered.sort((a, b) => (b.date || 0) - (a.date || 0)).map(f => {
    const icon = getFileIcon(f.type || '', f.name);
    return `
      <div class="file-card">
        <div class="file-top">
          <div class="file-icon-box">${icon}</div>
          <div class="file-info">
            <h4 class="file-title" title="${esc(f.name)}">${esc(f.customTitle || f.name)}</h4>
            <div class="file-subject">${esc(subjectName(f.subjectId))}</div>
          </div>
        </div>

        <div class="file-meta">
          <div>
            <span class="cat-badge ${esc(f.category)}">${esc(f.category)}</span>
            <span class="cat-badge gdrive-badge" title="Saved in Google Drive: STUD - Course Files">☁️ Drive</span>
          </div>
          <span>${formatBytes(f.size || 0)} · ${new Date(f.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>

        <div class="file-actions">
          <button class="file-action-btn" data-preview-file="${esc(f.id)}" title="Open and preview in Google Drive">👁 View</button>
          <button class="file-action-btn" data-download-file="${esc(f.id)}" title="Download file from Drive">↓ Download</button>
          <button class="file-action-btn share-btn" data-share-file="${esc(f.id)}" title="Share Google Drive link">↗ Share</button>
          <button class="file-action-btn delete-btn" data-delete-file="${esc(f.id)}" title="Delete file from Google Drive">×</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardFilesPreview() {
  const container = $('dashboard-files-list');
  if (!container) return;

  const filesList = Array.isArray(state.files) ? state.files : [];
  if (!filesList.length) {
    container.innerHTML = `<div class="empty" style="padding:16px 0">No cloud files stored yet.<br><a href="#files" class="apple-link-btn" style="margin-top:6px">+ Go to Vault</a></div>`;
    return;
  }

  const latest = [...filesList].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 3);
  container.innerHTML = latest.map(f => `
    <div class="file-mini-row">
      <div>
        <strong>${getFileIcon(f.type || '', f.name)} ${esc(f.customTitle || f.name)}</strong>
        <div class="muted" style="font-size:10px">
          ${esc(subjectName(f.subjectId))} · ${formatBytes(f.size || 0)} · ☁️ Drive
        </div>
      </div>
      <button class="quiet-btn-apple" data-preview-file="${esc(f.id)}">👁 View</button>
    </div>
  `).join('');
}

/* Upload Modal Handlers */
let pendingUploadFile = null;

function openUploadModal() {
  const modalEl = $('upload-modal');
  if (!modalEl) return;
  const subSelect = $('upload-subject');
  if (subSelect) {
    subSelect.innerHTML = renderSubjectOptions(state.subjects[0]?.id);
  }
  pendingUploadFile = null;
  const dropText = $('drop-zone-text');
  if (dropText) dropText.textContent = 'Click to choose or drag & drop a file';
  if ($('upload-name')) $('upload-name').value = '';

  modalEl.showModal();
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      toast('✓ Copied Google Drive link to clipboard!');
    }).catch(() => {
      prompt('Copy Google Drive link:', text);
    });
  } else {
    prompt('Copy Google Drive link:', text);
  }
}

function setupFileVaultUI() {
  const uploadBtn = $('btn-open-upload');
  if (uploadBtn) uploadBtn.onclick = () => openUploadModal();
  const cancelBtn = $('upload-cancel');
  if (cancelBtn) cancelBtn.onclick = () => $('upload-modal')?.close();

  const dropZone = $('file-drop-zone');
  const fileInput = $('upload-file-input');

  if (dropZone && fileInput) {
    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = e => {
      const file = e.target.files[0];
      if (file) {
        pendingUploadFile = file;
        $('drop-zone-text').textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;
        if (!$('upload-name').value) {
          $('upload-name').value = file.name.replace(/\.[^/.]+$/, '');
        }
      }
    };

    dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) {
        pendingUploadFile = file;
        $('drop-zone-text').textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;
        if (!$('upload-name').value) {
          $('upload-name').value = file.name.replace(/\.[^/.]+$/, '');
        }
      }
    };
  }

  const uploadForm = $('upload-form');
  if (uploadForm) {
    uploadForm.onsubmit = async e => {
      e.preventDefault();
      if (!pendingUploadFile) {
        toast('Please select a file first.');
        return;
      }

      if (!isGoogleDriveConnected()) {
        openGoogleDriveModal();
        toast('Please connect your Google Drive first to upload documents.');
        return;
      }

      const submitBtn = $('btn-submit-upload');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading to Drive...'; }

      try {
        toast('Uploading file directly to Google Drive...');
        const customTitle = $('upload-name')?.value.trim() || pendingUploadFile.name;
        const driveData = await uploadFileToGoogleDrive(pendingUploadFile, customTitle);

        const record = {
          id: uid(),
          name: pendingUploadFile.name,
          customTitle: customTitle,
          category: $('upload-category')?.value || 'cours',
          subjectId: $('upload-subject')?.value || state.subjects[0]?.id,
          type: pendingUploadFile.type || 'application/octet-stream',
          size: pendingUploadFile.size || 0,
          date: Date.now(),
          gdrive: {
            fileId: driveData.id,
            webViewLink: driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`,
            webContentLink: driveData.webContentLink || `https://drive.google.com/uc?id=${driveData.id}&export=download`
          }
        };

        if (!Array.isArray(state.files)) state.files = [];
        state.files.push(record);
        save();
        $('upload-modal')?.close();
        renderFiles();
        renderDashboardFilesPreview();
        toast(`✓ Uploaded "${record.customTitle}" directly to Google Drive!`);
      } catch (err) {
        console.error('Upload error:', err);
        toast('Upload failed: ' + (err.message || 'Could not upload to Google Drive.'));
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Upload to Google Drive'; }
      }
    };
  }

  const catFilter = $('files-category-filter');
  if (catFilter) {
    catFilter.onclick = e => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      document.querySelectorAll('#files-category-filter .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFileCategory = btn.dataset.cat;
      renderFiles();
    };
  }

  const subFilter = $('files-subject-filter');
  if (subFilter) {
    subFilter.onchange = () => {
      activeFileSubject = subFilter.value;
      renderFiles();
    };
  }

  const searchInput = $('files-search');
  if (searchInput) {
    searchInput.oninput = () => {
      fileSearchQuery = searchInput.value;
      renderFiles();
    };
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;

    if (b.dataset.previewFile) {
      const filesList = Array.isArray(state.files) ? state.files : [];
      const file = filesList.find(f => f.id === b.dataset.previewFile);
      if (!file) return;
      const url = file.gdrive?.webViewLink || (file.gdrive?.fileId ? `https://drive.google.com/file/d/${file.gdrive.fileId}/view` : null);
      if (url) {
        window.open(url, '_blank');
      } else {
        toast('File view link unavailable.');
      }
      return;
    }

    if (b.dataset.downloadFile) {
      const filesList = Array.isArray(state.files) ? state.files : [];
      const file = filesList.find(f => f.id === b.dataset.downloadFile);
      if (!file) return;
      const url = file.gdrive?.webContentLink || (file.gdrive?.fileId ? `https://drive.google.com/uc?id=${file.gdrive.fileId}&export=download` : null);
      if (url) {
        window.open(url, '_blank');
      } else {
        toast('Download link unavailable.');
      }
      return;
    }

    if (b.dataset.shareFile) {
      const filesList = Array.isArray(state.files) ? state.files : [];
      const file = filesList.find(f => f.id === b.dataset.shareFile);
      if (!file) return;
      const shareUrl = file.gdrive?.webViewLink || (file.gdrive?.fileId ? `https://drive.google.com/file/d/${file.gdrive.fileId}/view` : '');
      const shareTitle = file.customTitle || file.name;
      const shareText = `${file.category.toUpperCase()} - ${subjectName(file.subjectId)} (STUD)`;

      if (shareUrl) {
        if (navigator.share) {
          try {
            await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
            return;
          } catch (err) {
            if (err.name === 'AbortError') return;
          }
        }
        copyToClipboard(shareUrl);
      } else {
        toast('Google Drive link unavailable to share.');
      }
      return;
    }

    if (b.dataset.deleteFile) {
      const filesList = Array.isArray(state.files) ? state.files : [];
      const file = filesList.find(f => f.id === b.dataset.deleteFile);
      if (!file) return;
      if (confirm(`Delete "${file.customTitle || file.name}" from your Google Drive?`)) {
        if (file.gdrive?.fileId && isGoogleDriveConnected()) {
          deleteFileFromGoogleDrive(file.gdrive.fileId).catch(err => console.warn('Drive deletion:', err));
        }
        state.files = filesList.filter(f => f.id !== file.id);
        save();
        renderFiles();
        renderDashboardFilesPreview();
        toast('File removed from Google Drive.');
      }
      return;
    }
  });
}

/* ============================================================
   PAGE 3: APPLE CALENDAR CONTROLLER
============================================================ */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = day(new Date());

function setupCalendarUI() {
  const prevBtn = $('cal-prev');
  const nextBtn = $('cal-next');
  const todayBtn = $('cal-today-btn');

  if (prevBtn) {
    prevBtn.onclick = () => {
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      renderCalendar();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      renderCalendar();
    };
  }

  if (todayBtn) {
    todayBtn.onclick = () => {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      calSelectedDate = day(now);
      renderCalendar();
    };
  }

  const logForDateBtn = $('btn-log-for-date');
  if (logForDateBtn) {
    logForDateBtn.onclick = () => {
      selectedDateMode = 'custom';
      if ($('entry-custom-date')) {
        $('entry-custom-date').value = calSelectedDate;
        $('entry-custom-date').style.display = 'block';
      }
      document.querySelectorAll('#date-segmented .segment-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.date === 'custom');
      });
      switchPage('logger');
    };
  }
}

function renderCalendar() {
  const grid = $('calendar-grid');
  const monthTitle = $('cal-month-title');
  if (!grid || !monthTitle) return;

  const monthDate = new Date(calYear, calMonth, 1);
  monthTitle.textContent = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const firstDayIndex = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

  const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
  const todayStr = day(new Date());

  let daysStudiedInMonth = 0;
  let minutesInMonth = 0;

  let html = '';

  for (let i = 0; i < totalCells; i++) {
    let cellDayNumber;
    let cellDateStr;
    let isOtherMonth = false;

    if (i < firstDayIndex) {
      cellDayNumber = prevMonthDays - firstDayIndex + i + 1;
      const prevMonth = calMonth === 0 ? 11 : calMonth - 1;
      const prevYear = calMonth === 0 ? calYear - 1 : calYear;
      cellDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(cellDayNumber).padStart(2, '0')}`;
      isOtherMonth = true;
    } else if (i >= firstDayIndex + daysInMonth) {
      cellDayNumber = i - (firstDayIndex + daysInMonth) + 1;
      const nextMonth = calMonth === 11 ? 0 : calMonth + 1;
      const nextYear = calMonth === 11 ? calYear + 1 : calYear;
      cellDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(cellDayNumber).padStart(2, '0')}`;
      isOtherMonth = true;
    } else {
      cellDayNumber = i - firstDayIndex + 1;
      cellDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(cellDayNumber).padStart(2, '0')}`;
    }

    const daySessions = state.sessions.filter(s => s.date === cellDateStr);
    const dayMins = minutes(daySessions);
    const dayTasks = state.tasks.filter(t => t.due === cellDateStr);

    if (!isOtherMonth && dayMins > 0) {
      daysStudiedInMonth++;
      minutesInMonth += dayMins;
    }

    const isToday = cellDateStr === todayStr;
    const isSelected = cellDateStr === calSelectedDate;

    html += `
      <div class="cal-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-cal-date="${cellDateStr}">
        <span class="cal-day-number">${cellDayNumber}</span>
        <div class="cal-day-badges">
          ${dayMins > 0 ? `<span class="cal-study-pill" title="${duration(dayMins)} studied">${duration(dayMins)}</span>` : ''}
          ${dayTasks.length > 0 ? `<span class="cal-task-pill" title="${dayTasks.length} task(s) due">${dayTasks.length} due</span>` : ''}
        </div>
      </div>
    `;
  }

  grid.innerHTML = html;

  if ($('cal-month-stats')) {
    $('cal-month-stats').textContent = `${daysStudiedInMonth} active days · ${duration(minutesInMonth)} total`;
  }

  grid.querySelectorAll('.cal-day-cell').forEach(cell => {
    cell.onclick = () => {
      grid.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      calSelectedDate = cell.dataset.calDate;
      renderDayInspector(calSelectedDate);
    };
  });

  renderDayInspector(calSelectedDate);
}

function renderDayInspector(dateStr) {
  const content = $('inspector-content');
  const title = $('inspector-date-title');
  const subtitle = $('inspector-date-subtitle');
  const actions = $('inspector-actions');
  if (!content || !title) return;

  const dateObj = new Date(dateStr + 'T12:00:00');
  const formattedDate = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  title.textContent = formattedDate;

  const daySessions = state.sessions.filter(s => s.date === dateStr);
  const dayMins = minutes(daySessions);
  const dayTasks = state.tasks.filter(t => t.due === dateStr);

  subtitle.textContent = `${duration(dayMins)} studied · ${dayTasks.length} tasks scheduled`;
  if (actions) actions.style.display = 'block';

  let html = '';

  html += `<div class="inspector-section">
    <h4>Study Sessions (${daySessions.length})</h4>
    ${daySessions.length ? daySessions.map(s => `
      <div class="inspector-item">
        <div>
          <strong>${esc(subjectName(s.subject))}</strong>
          ${s.note ? `<div class="muted" style="font-size:11px">${esc(s.note)}</div>` : ''}
        </div>
        <strong>${duration(s.minutes)}</strong>
      </div>
    `).join('') : '<p class="muted" style="font-size:12px;margin:4px 0">No sessions recorded on this day.</p>'}
  </div>`;

  html += `<div class="inspector-section">
    <h4>Tasks Due (${dayTasks.length})</h4>
    ${dayTasks.length ? dayTasks.map(t => `
      <div class="inspector-item">
        <span style="${t.done ? 'text-decoration:line-through;color:var(--text-tertiary);' : ''}">${esc(t.title)}</span>
        <span class="apple-pill-subtle" style="font-size:9px">${t.done ? 'Completed' : 'Pending'}</span>
      </div>
    `).join('') : '<p class="muted" style="font-size:12px;margin:4px 0">No tasks due on this date.</p>'}
  </div>`;

  content.innerHTML = html;
}

/* ============================================================
   PAGE 2: TIME LOGGER (SCRUBBER & DUAL-INPUT TYPING)
============================================================ */
let totalLoggedMinutes = 90;
let selectedDateMode = 'today';

function updateTimeDisplay(m, source) {
  totalLoggedMinutes = Math.max(5, Math.min(720, Math.round(m / 5) * 5));

  const hrs = Math.floor(totalLoggedMinutes / 60);
  const mins = totalLoggedMinutes % 60;

  if (source !== 'hours' && $('time-hours')) $('time-hours').value = hrs;
  if (source !== 'minutes' && $('time-minutes')) $('time-minutes').value = mins;

  if (source !== 'slider' && $('time-slider')) {
    $('time-slider').value = Math.min(480, totalLoggedMinutes);
  }

  const slider = $('time-slider');
  if (slider) {
    const min = Number(slider.min) || 5;
    const max = Number(slider.max) || 480;
    const cur = Math.min(max, totalLoggedMinutes);
    const pct = ((cur - min) / (max - min)) * 100;
    slider.style.setProperty('--slider-fill', `${pct}%`);
  }

  if ($('duration-badge')) {
    $('duration-badge').textContent = duration(totalLoggedMinutes);
  }

  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', Number(c.dataset.min) === totalLoggedMinutes);
  });
}

function setupTimeScrubber() {
  const slider = $('time-slider');
  const hInput = $('time-hours');
  const mInput = $('time-minutes');
  const stepDown = $('time-step-down');
  const stepUp = $('time-step-up');
  const timeBoxes = $('time-boxes');

  if (slider) {
    slider.oninput = () => updateTimeDisplay(Number(slider.value), 'slider');
  }

  const handleTypeChange = () => {
    const h = parseInt(hInput?.value || 0, 10) || 0;
    const m = parseInt(mInput?.value || 0, 10) || 0;
    updateTimeDisplay(h * 60 + m, 'type');
  };

  if (hInput) {
    hInput.oninput = handleTypeChange;
    hInput.onchange = handleTypeChange;
  }
  if (mInput) {
    mInput.oninput = handleTypeChange;
    mInput.onchange = handleTypeChange;
  }

  if (stepDown) stepDown.onclick = () => updateTimeDisplay(totalLoggedMinutes - 15, 'stepper');
  if (stepUp) stepUp.onclick = () => updateTimeDisplay(totalLoggedMinutes + 15, 'stepper');

  const onWheelAdjust = e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    updateTimeDisplay(totalLoggedMinutes + delta, 'wheel');
  };

  if (timeBoxes) timeBoxes.onwheel = onWheelAdjust;
  if (slider) slider.onwheel = onWheelAdjust;

  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => updateTimeDisplay(Number(chip.dataset.min), 'chip');
  });

  const ruler = $('slider-ruler');
  if (ruler) {
    ruler.onclick = e => {
      const span = e.target.closest('span[data-set-min]');
      if (span) updateTimeDisplay(Number(span.dataset.setMin), 'ruler');
    };
  }

  const dateSegments = $('date-segmented');
  const customDateInput = $('entry-custom-date');
  if (dateSegments) {
    dateSegments.onclick = e => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      document.querySelectorAll('#date-segmented .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDateMode = btn.dataset.date;

      if (selectedDateMode === 'custom') {
        if (customDateInput) {
          customDateInput.style.display = 'block';
          if (!customDateInput.value) customDateInput.value = day(new Date());
        }
      } else {
        if (customDateInput) customDateInput.style.display = 'none';
      }
    };
  }

  const saveBtn = $('btn-save-session');
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (!state.subjects.length) {
        toast('Please create a subject first.');
        return;
      }
      const subject = $('entry-subject')?.value || state.subjects[0].id;
      let sessionDate = day(new Date());
      if (selectedDateMode === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        sessionDate = day(y);
      } else if (selectedDateMode === 'custom') {
        sessionDate = customDateInput?.value || day(new Date());
      }

      const note = $('entry-note')?.value || '';

      recordSession(subject, totalLoggedMinutes, sessionDate, note);
      if ($('entry-note')) $('entry-note').value = '';
      save();
      render();
      toast(`✓ Logged ${duration(totalLoggedMinutes)} of ${subjectName(subject)}.`);
    };
  }
}

/* ============================================================
   PAGE 5: STUDY PLAN / TASKS CONTROLLER
============================================================ */
let activeTaskFilter = 'all';

function setupTasksUI() {
  const taskForm = $('task-form');
  if (taskForm) {
    taskForm.onsubmit = e => {
      e.preventDefault();
      const title = $('task-title').value.trim();
      if (!title) return;
      const subId = $('task-subject')?.value || '';
      state.tasks.push({
        id: uid(),
        title,
        subjectId: subId,
        due: $('task-due').value,
        done: false
      });
      taskForm.reset();
      save();
      render();
      toast('Task added to plan.');
    };
  }

  const taskFilterSegments = $('task-filter-segmented');
  if (taskFilterSegments) {
    taskFilterSegments.onclick = e => {
      const btn = e.target.closest('.segment-btn');
      if (!btn) return;
      document.querySelectorAll('#task-filter-segmented .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTaskFilter = btn.dataset.taskFilter;
      renderTasksList();
    };
  }
}

function renderTasksList() {
  const container = $('task-list');
  if (!container) return;

  const today = day(new Date());
  let filtered = [...state.tasks];
  if (activeTaskFilter === 'todo') filtered = filtered.filter(t => !t.done);
  if (activeTaskFilter === 'done') filtered = filtered.filter(t => t.done);

  if (!filtered.length) {
    container.innerHTML = `<div class="empty">No tasks in this view.<br>Plan upcoming modules, assignments, or revisions above.</div>`;
    return;
  }

  container.innerHTML = filtered.map(t => `
    <div class="task-row ${t.done ? 'done' : ''}">
      <input type="checkbox" data-check="${esc(t.id)}" id="task-${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="Mark task complete">
      <label for="task-${esc(t.id)}">
        <strong>${esc(t.title)}</strong>
        <small style="${t.due && t.due < today && !t.done ? 'color:var(--apple-red);font-weight:600;' : ''}">
          ${t.subjectId ? `<span class="badge" style="margin-left:0;margin-right:6px">${esc(subjectName(t.subjectId))}</span>` : ''}
          ${t.due ? `${t.due < today && !t.done ? 'Overdue · ' : ''}Due ${esc(new Date(t.due + 'T12:00:00').toLocaleDateString())}` : 'No due date'}
        </small>
      </label>
      <button class="delete" data-task-delete="${esc(t.id)}" aria-label="Delete task">×</button>
    </div>
  `).join('');
}

/* ============================================================
   PAGE 6: SESSION HISTORY CONTROLLER
============================================================ */
let activeHistorySubject = 'all';

function setupHistoryUI() {
  const filter = $('history-subject-filter');
  if (filter) {
    filter.onchange = () => {
      activeHistorySubject = filter.value;
      renderHistoryTable();
    };
  }
}

function renderHistoryTable() {
  const tbody = $('session-list');
  const label = $('history-total-label');
  if (!tbody) return;

  let filtered = [...state.sessions];
  if (activeHistorySubject !== 'all') {
    filtered = filtered.filter(s => s.subject === activeHistorySubject);
  }

  const totalMins = minutes(filtered);
  if (label) label.textContent = `Total studied: ${duration(totalMins)} (${filtered.length} sessions)`;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty">No study sessions recorded yet.<br>Use the Log Study Time page to record your work.</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created).map(s => `
    <tr>
      <td>
        <strong>${esc(subjectName(s.subject))}</strong>
        <span class="small-sub">${esc(subjectSemesterName(s.subject))}${s.note ? ` · <em>${esc(s.note)}</em>` : ''}</span>
      </td>
      <td>${esc(new Date(s.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</td>
      <td><strong>${duration(s.minutes)}</strong></td>
      <td><button class="delete" data-session-delete="${esc(s.id)}" aria-label="Delete session">×</button></td>
    </tr>
  `).join('');
}

/* ============================================================
   RENDER PIPELINE (GLOBAL)
============================================================ */
function render() {
  const today = day(new Date()), days = weekDays(), weekTotal = minutes(state.sessions.filter(s => days.some(d => day(d) === s.date)));
  const todayTotal = minutes(state.sessions.filter(s => s.date === today));

  $('date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('today').textContent = duration(todayTotal);
  $('week').textContent = duration(weekTotal);
  if ($('dashboard-today-hours')) $('dashboard-today-hours').textContent = duration(todayTotal);

  let streak = 0, d = new Date();
  if (!state.sessions.some(s => s.date === day(d))) d.setDate(d.getDate() - 1);
  while (state.sessions.some(s => s.date === day(d))) { streak++; d.setDate(d.getDate() - 1); }
  $('streak').textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
  $('completed').textContent = `${state.tasks.filter(t => t.done).length} / ${state.tasks.length}`;

  ['entry-subject', 'task-subject', 'upload-subject'].forEach(id => {
    const el = $(id);
    if (el) {
      const cur = el.value;
      el.innerHTML = renderSubjectOptions(cur);
      if (state.subjects.some(s => s.id === cur)) el.value = cur;
    }
  });

  ['files-subject-filter', 'history-subject-filter'].forEach(id => {
    const el = $(id);
    if (el) {
      const cur = el.value || 'all';
      el.innerHTML = renderSubjectOptions(cur, true);
      el.value = cur;
    }
  });

  const values = days.map(d => minutes(state.sessions.filter(s => s.date === day(d)))), max = Math.max(60, ...values);
  $('chart').innerHTML = days.map((d, i) => `
    <div class="chart-col ${day(d) === today ? 'current' : ''}">
      <span>${values[i] ? duration(values[i]) : '–'}</span>
      <div class="bar-track">
        <div class="bar" style="height:${Math.max(4, values[i] / max * 100)}%" title="${values[i]} minutes on ${d.toLocaleDateString()}"></div>
      </div>
      <span>${d.toLocaleDateString('en', { weekday: 'short' })}</span>
    </div>
  `).join('');

  $('goal-text').textContent = `${duration(weekTotal)} of ${duration(state.goal)} studied this week`;
  const goalPct = Math.min(100, Math.round(weekTotal / state.goal * 100));
  if ($('goal-bar-fill')) $('goal-bar-fill').style.width = `${goalPct}%`;
  $('goal-caption').textContent = weekTotal >= state.goal ? 'Weekly goal reached! Excellent momentum.' : `${duration(state.goal - weekTotal)} remaining to reach goal.`;

  const tabsEl = $('semester-tabs');
  if (tabsEl) {
    const allCount = state.subjects.length;
    tabsEl.innerHTML = `
      <button class="semester-tab ${currentSemesterTab === 'all' ? 'active' : ''}" data-sem-tab="all">All Semesters (${allCount})</button>
      ${state.semesters.map(sem => {
        const count = state.subjects.filter(s => s.semesterId === sem.id).length;
        return `<button class="semester-tab ${currentSemesterTab === sem.id ? 'active' : ''}" data-sem-tab="${esc(sem.id)}">${esc(sem.name)} (${count})</button>`;
      }).join('')}
      <button class="semester-tab add-tab" id="tab-add-semester">+ Add semester</button>
    `;
  }

  const allTimeTotal = minutes(state.sessions);
  const filterLabelEl = $('subject-filter-label');

  if (currentSemesterTab === 'all') {
    if (filterLabelEl) filterLabelEl.textContent = `All semesters · ${duration(allTimeTotal)}`;
    $('subject-list').innerHTML = state.semesters.map(sem => {
      const semSubjects = state.subjects.filter(s => s.semesterId === sem.id);
      const semTotal = minutes(state.sessions.filter(sess => semSubjects.some(sub => sub.id === sess.subject)));
      return `<div class="semester-group">
        <div class="semester-group-title">
          <span>${esc(sem.name)}</span>
          <span class="muted">${semSubjects.length} subjects · ${duration(semTotal)}</span>
        </div>
        ${semSubjects.length ? semSubjects.map(s => renderSubjectRow(s, allTimeTotal, false)).join('') : '<div class="empty" style="padding:14px 0">No subjects in this semester yet.</div>'}
      </div>`;
    }).join('');
  } else {
    const currentSem = state.semesters.find(s => s.id === currentSemesterTab) || state.semesters[0];
    const semSubjects = state.subjects.filter(s => s.semesterId === currentSem?.id);
    const semTotal = minutes(state.sessions.filter(sess => semSubjects.some(sub => sub.id === sess.subject)));
    if (filterLabelEl && currentSem) filterLabelEl.textContent = `${esc(currentSem.name)} · ${duration(semTotal)}`;

    const canDeleteSem = state.semesters.length > 1;
    const activeBarHtml = currentSem ? `<div class="semester-active-bar">
      <span>${esc(currentSem.name)} · ${duration(semTotal)} total</span>
      <div class="semester-actions">
        <button class="quiet-btn" data-edit-sem="${esc(currentSem.id)}">✏ Rename</button>
        ${canDeleteSem ? `<button class="quiet-btn danger" data-delete-sem="${esc(currentSem.id)}">🗑 Delete</button>` : ''}
      </div>
    </div>` : '';

    const listHtml = semSubjects.length
      ? semSubjects.map(s => renderSubjectRow(s, semTotal || allTimeTotal, false)).join('')
      : `<div class="empty">No subjects in this semester yet.<br><button class="apple-btn-secondary" id="btn-add-subject-here" style="margin-top:10px">+ Add subject</button></div>`;

    $('subject-list').innerHTML = activeBarHtml + listHtml;
  }

  const todaySessionsContainer = $('today-sessions-list');
  if (todaySessionsContainer) {
    const todaySessions = state.sessions.filter(s => s.date === today);
    todaySessionsContainer.innerHTML = todaySessions.length ? todaySessions.map(s => `
      <div class="inspector-item">
        <div>
          <strong>${esc(subjectName(s.subject))}</strong>
          <div class="muted" style="font-size:11px">${esc(subjectSemesterName(s.subject))}${s.note ? ` · ${esc(s.note)}` : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <strong>${duration(s.minutes)}</strong>
          <button class="delete" data-session-delete="${esc(s.id)}" aria-label="Delete session">×</button>
        </div>
      </div>
    `).join('') : '<p class="muted" style="font-size:12px;margin:4px 0">No sessions logged yet today.</p>';
  }

  updateGoogleDriveUI();
  renderTasksList();
  renderHistoryTable();
  renderCalendar();
  renderDashboardFilesPreview();
}

/* ============================================================
   MODALS & SEMESTER / SUBJECT ACTIONS
============================================================ */
function modal(title, fields, submit) {
  $('modal-title').textContent = title;
  $('modal-fields').innerHTML = fields;
  $('form-error').textContent = '';
  $('modal-form').onsubmit = e => {
    e.preventDefault();
    if (submit(new FormData(e.target)) !== false) $('modal').close();
  };
  $('modal').showModal();
}

$('cancel').onclick = () => $('modal').close();

function openAddSubjectModal(defaultSemId) {
  const targetSem = defaultSemId || (currentSemesterTab !== 'all' ? currentSemesterTab : state.semesters[0]?.id);
  const semOptions = state.semesters.map(s =>
    `<option value="${esc(s.id)}" ${s.id === targetSem ? 'selected' : ''}>${esc(s.name)}</option>`
  ).join('');

  modal('A New Subject', `
    <label>Subject name
      <input name="name" class="apple-input" required maxlength="80" placeholder="e.g. Algorithmique" autofocus>
    </label>
    <label>Semester
      <select name="semesterId" class="apple-select">${semOptions}</select>
    </label>
  `, data => {
    const name = data.get('name').trim();
    const semesterId = data.get('semesterId');
    if (!name) { $('form-error').textContent = 'Enter a subject name.'; return false; }
    if (state.subjects.some(s => s.name.toLowerCase() === name.toLowerCase() && s.semesterId === semesterId)) {
      $('form-error').textContent = 'That subject already exists in this semester.';
      return false;
    }
    state.subjects.push({ id: uid(), name, semesterId });
    save();
    render();
    toast('Subject added.');
  });
}

function openAddSemesterModal() {
  modal('A New Semester', `
    <label>Semester name
      <input name="name" class="apple-input" required maxlength="60" placeholder="e.g. Semester 2" autofocus>
    </label>
  `, data => {
    const name = data.get('name').trim();
    if (!name) { $('form-error').textContent = 'Enter a semester name.'; return false; }
    if (state.semesters.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      $('form-error').textContent = 'That semester already exists.';
      return false;
    }
    const newSem = { id: uid(), name };
    state.semesters.push(newSem);
    currentSemesterTab = newSem.id;
    save();
    render();
    toast(`Semester "${name}" created.`);
  });
}

function openEditSemesterModal(id) {
  const sem = state.semesters.find(s => s.id === id);
  if (!sem) return;
  modal('Rename Semester', `
    <label>Semester name
      <input name="name" class="apple-input" required maxlength="60" value="${esc(sem.name)}" autofocus>
    </label>
  `, data => {
    const name = data.get('name').trim();
    if (!name) { $('form-error').textContent = 'Enter a semester name.'; return false; }
    if (state.semesters.some(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) {
      $('form-error').textContent = 'A semester with that name already exists.';
      return false;
    }
    sem.name = name;
    save();
    render();
    toast('Semester renamed.');
  });
}

function deleteSemester(id) {
  const sem = state.semesters.find(s => s.id === id);
  if (!sem) return;
  if (state.semesters.length <= 1) {
    toast('You must keep at least one semester.');
    return;
  }
  const subs = state.subjects.filter(s => s.semesterId === id);
  if (subs.length > 0) {
    if (!confirm(`Delete "${sem.name}" and its ${subs.length} subject(s)? Past study sessions will be preserved in history.`)) return;
    const subIds = new Set(subs.map(s => s.id));
    state.subjects = state.subjects.filter(s => !subIds.has(s.id));
  } else {
    if (!confirm(`Delete semester "${sem.name}"?`)) return;
  }
  state.semesters = state.semesters.filter(s => s.id !== id);
  currentSemesterTab = 'all';
  save();
  render();
  toast('Semester deleted.');
}

$('add-subject').onclick = () => openAddSubjectModal();
$('add-semester').onclick = () => openAddSemesterModal();

$('edit-goal').onclick = () => modal('Set Weekly Goal', `
  <label>Hours per week
    <input name="hours" class="apple-input" type="number" min="0.5" max="168" step="0.5" required value="${state.goal / 60}">
  </label>
`, data => {
  state.goal = Number(data.get('hours')) * 60;
  save();
  render();
});

/* ============================================================
   VALIDATION HELPERS
============================================================ */
function validBackup(d) {
  return d &&
    Array.isArray(d.subjects) && d.subjects.length > 0 &&
    d.subjects.every(s => typeof s.id === 'string' && typeof s.name === 'string') &&
    Number.isFinite(d.goal) && d.goal > 0 &&
    Array.isArray(d.tasks) && d.tasks.every(t => typeof t.id === 'string' && typeof t.title === 'string' && typeof t.done === 'boolean' && (!t.due || validDate(t.due))) &&
    Array.isArray(d.sessions) && d.sessions.every(s => typeof s.id === 'string' && d.subjects.some(x => x.id === s.subject) && Number.isInteger(s.minutes) && s.minutes > 0 && s.minutes <= 1440 && validDate(s.date)) &&
    (!d.semesters || (Array.isArray(d.semesters) && d.semesters.every(sem => typeof sem.id === 'string' && typeof sem.name === 'string'))) &&
    (!d.files || Array.isArray(d.files));
}

function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T12:00:00').getTime());
}

const mobileHistoryBtn = $('mobile-history-btn');
if (mobileHistoryBtn) {
  mobileHistoryBtn.onclick = () => switchPage('history');
}

/* ============================================================
   GLOBAL EVENT DELEGATION
============================================================ */
document.addEventListener('change', e => {
  if (e.target.dataset.check) {
    const t = state.tasks.find(t => t.id === e.target.dataset.check);
    if (t) {
      t.done = e.target.checked;
      save();
      render();
    }
  }
});

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;

  if (b.dataset.taskDelete) {
    state.tasks = state.tasks.filter(t => t.id !== b.dataset.taskDelete);
    save();
    render();
    return;
  }

  if (b.dataset.sessionDelete && confirm('Delete this study session?')) {
    state.sessions = state.sessions.filter(s => s.id !== b.dataset.sessionDelete);
    save();
    render();
    return;
  }

  if (b.dataset.subjectDelete) {
    const sub = state.subjects.find(s => s.id === b.dataset.subjectDelete);
    if (!sub) return;
    const sessionCount = state.sessions.filter(s => s.subject === sub.id).length;
    const msg = sessionCount > 0
      ? `Delete "${sub.name}"? It has ${sessionCount} recorded study session(s). History will keep these sessions.`
      : `Delete subject "${sub.name}"?`;
    if (confirm(msg)) {
      state.subjects = state.subjects.filter(s => s.id !== sub.id);
      save();
      render();
      toast('Subject deleted.');
    }
    return;
  }

  if (b.dataset.semTab) {
    currentSemesterTab = b.dataset.semTab;
    render();
    return;
  }

  if (b.id === 'tab-add-semester') {
    openAddSemesterModal();
    return;
  }

  if (b.id === 'btn-add-subject-here') {
    openAddSubjectModal(currentSemesterTab !== 'all' ? currentSemesterTab : undefined);
    return;
  }

  if (b.dataset.editSem) {
    openEditSemesterModal(b.dataset.editSem);
    return;
  }

  if (b.dataset.deleteSem) {
    deleteSemester(b.dataset.deleteSem);
    return;
  }
});

/* ============================================================
   INITIALIZATION
============================================================ */
setupTimeScrubber();
updateTimeDisplay(90);
setupCalendarUI();
setupFileVaultUI();
setupTasksUI();
setupHistoryUI();
setupGoogleDriveListeners();

// Save local state without triggering cloud sync on first load
state.updatedAt = state.updatedAt || Date.now();
try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
render();
renderFiles();
renderDashboardFilesPreview();

// Initial cloud sync (silent, checks Drive for newer data on startup)
initCloudSync();

const initialHash = window.location.hash.replace('#', '');
switchPage(initialHash || 'dashboard', false);
