/* Editing, search, goals, resume and sync feedback. */
function finishEdit() { save(); render(); }
function moduleOptions(id) {
  return (subjectObj(id) ? '' : `<option value="${esc(id || '')}" selected>Previous module</option>`) + renderSubjectOptions(id);
}
function openEntryEditor(kind, id) {
  const list = kind === 'session' ? state.sessions : kind === 'task' ? state.tasks : state.exams;
  const entry = list.find(item => item.id === id); if (!entry) return;
  const subjectId = kind === 'session' ? entry.subject : entry.subjectId;
  const fields = `<label>Module<select name="subjectId" aria-label="Module">${moduleOptions(subjectId)}</select></label>`;
  if (kind === 'session') {
    modal('Edit study session', `${fields}<label>Minutes studied<input class="apple-input" name="minutes" type="number" min="1" max="1440" step="1" value="${entry.minutes}" required></label><label>Study date<input class="apple-input" name="date" type="date" value="${esc(entry.date)}" required></label><label>Note<input class="apple-input" name="note" maxlength="120" value="${esc(entry.note || '')}"></label>`, data => {
      const amount = Number(data.get('minutes')), date = data.get('date');
      if (!Number.isInteger(amount) || amount < 1 || amount > 1440 || !validDate(date)) { $('form-error').textContent = 'Enter 1–1440 minutes and a valid date.'; return false; }
      Object.assign(entry, { subject: data.get('subjectId'), minutes: amount, date, note: data.get('note').trim() }); finishEdit();
    });
  } else {
    const isTask = kind === 'task';
    modal(isTask ? 'Edit task' : 'Edit exam', `<label>Title<input class="apple-input" name="title" maxlength="100" value="${esc(entry.title)}" required></label>${fields}<label>${isTask ? 'Deadline (optional)' : 'Exam date'}<input class="apple-input" type="date" name="date" value="${esc(isTask ? entry.due || '' : entry.date)}" ${isTask ? '' : 'required'}></label>${isTask ? `<label class="edit-check"><input type="checkbox" name="done" ${entry.done ? 'checked' : ''}> Completed</label>` : ''}`, data => {
      const title = data.get('title').trim(), date = data.get('date');
      if (!title || ((!isTask || date) && !validDate(date))) { $('form-error').textContent = 'Enter a title and valid date.'; return false; }
      Object.assign(entry, { title, subjectId: data.get('subjectId') });
      if (isTask) Object.assign(entry, { due: date, done: data.has('done') }); else entry.date = date;
      finishEdit();
    });
  }
}
function searchStudy(query) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const items = [
    ...state.subjects.map(s => ({ kind: 'module', id: s.id, title: s.name, detail: semesterName(s.semesterId), subjectId: s.id })),
    ...state.files.map(f => ({ kind: 'file', id: f.id, title: f.customTitle || f.name, detail: `${f.name} · ${subjectName(f.subjectId)} · ${f.category}`, subjectId: f.subjectId })),
    ...state.tasks.map(t => ({ kind: 'task', id: t.id, title: t.title, detail: `${subjectName(t.subjectId)} · ${t.due || 'No deadline'} · ${t.done ? 'Completed' : 'Pending'}`, subjectId: t.subjectId })),
    ...state.exams.map(e => ({ kind: 'exam', id: e.id, title: e.title, detail: `${subjectName(e.subjectId)} · ${e.date}`, subjectId: e.subjectId })),
    ...state.sessions.map(s => ({ kind: 'session', id: s.id, title: s.note || subjectName(s.subject), detail: `${subjectName(s.subject)} · ${s.date} · ${duration(s.minutes)}`, subjectId: s.subject }))
  ];
  return items.filter(item => terms.every(term => `${item.title} ${item.detail}`.toLocaleLowerCase().includes(term)));
}
function renderSearch() {
  const query = $('global-search').value.trim(), results = searchStudy(query);
  $('search-results').innerHTML = !query ? studyEmpty('Type to find modules, files, tasks, exams, or session notes.') : `<p class="muted">${results.length} result${results.length === 1 ? '' : 's'}${results.length > 60 ? ' · showing first 60' : ''}</p>` + (results.slice(0,60).map(item => `<button type="button" class="search-result" data-search-kind="${item.kind}" data-search-id="${esc(item.id)}"><span class="eyebrow">${item.kind}</span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></button>`).join('') || studyEmpty('No matches. Try a module name or a different keyword.'));
}
function openSearch() { if (!$('search-dialog').open) $('search-dialog').showModal(); renderSearch(); $('global-search').focus(); }
$('global-search').oninput = renderSearch; $('search-close').onclick = () => $('search-dialog').close();
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!document.querySelector('dialog[open]') || $('search-dialog').open) openSearch(); } });
function openModuleWorkspace(id) { if (!subjectObj(id)) return; workspaceSubject = id; localStorage.setItem('stud-workspace', id); renderWorkspace(); switchPage('module'); renderFeatureWidgets(); }
function renderFeatureWidgets() {
  let resume = $('resume-card'); if (resume) resume.remove();
  const subject = subjectObj(localStorage.getItem('stud-workspace'));
  const file = state.files.find(f => f.id === localStorage.getItem('stud-last-file'));
  if (subject || file) {
    resume = document.createElement('section'); resume.id = 'resume-card'; resume.className = 'card resume-card';
    resume.innerHTML = `<div><span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h3>${esc(subject?.name || file.customTitle || file.name)}</h3></div><div>${subject ? `<button class="apple-btn-secondary" data-resume-module="${esc(subject.id)}">Resume module →</button>` : ''}${file ? `<button class="quiet-btn" data-resume-file="${esc(file.id)}">Reopen ${esc(file.customTitle || file.name)}</button>` : ''}</div>`;
    $('view-today').querySelector('.focus-hero').after(resume);
  }
  $('module-weekly-target')?.remove();
  const module = subjectObj(workspaceSubject);
  if (module && $('view-module').querySelector('.workspace-progress')) {
    const studied = minutes(weekSessions().filter(s => s.subject === module.id)); const goal = moduleWeeklyGoal(module.id);
    const target = document.createElement('section'); target.id = 'module-weekly-target'; target.className = 'card weekly-target';
    target.innerHTML = `<div><h3>Weekly study target</h3><p>${duration(studied)} / ${duration(goal)}${!goal ? ' · No target set' : studied >= goal ? ' · Goal reached' : ' · ' + duration(goal-studied) + ' remaining'}</p></div><button class="quiet-btn" data-edit-goal="${esc(module.id)}">Set target</button><progress max="${goal || 1}" value="${goal ? Math.min(studied,goal) : 0}" aria-label="Weekly module target"></progress>`;
    $('view-module').querySelector('.workspace-progress').after(target);
  }
  if ($('search-dialog').open) renderSearch();
  renderSyncSummary();
}
function renderSyncSummary() {
  const connected = isGoogleDriveConnected(); const status = localStorage.getItem('stud-sync-state');
  const last = Number(localStorage.getItem('stud-last-sync') || 0);
  const stamp = last ? new Date(last).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No successful backup yet';
  const label = !connected ? 'Saved on this device · Drive disconnected' : status === 'error' ? 'Sync failed · Local data saved' : status === 'syncing' ? 'Syncing with Drive…' : status === 'synced' ? 'Drive up to date' : 'Waiting to sync';
  $('sync-summary').textContent = `${label} \u00b7 Last sync: ${stamp}`; $('sync-summary').dataset.status = connected ? status : 'disconnected';
  $('sync-summary').title = `Last successful sync: ${stamp}`;
  $('sync-details').textContent = `${label}. Last successful sync: ${stamp}.`;
  $('sync-retry').textContent = !connected ? 'Connect Drive' : status === 'error' ? 'Retry sync' : 'Sync now';
  $('sync-retry').disabled = connected && status === 'syncing';
}
$('sync-retry').onclick = () => { if (!isGoogleDriveConnected()) openGoogleDriveModal(); else syncWithGoogleDrive(false); };
document.addEventListener('stud:sync', renderSyncSummary);
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.hasAttribute('data-open-search')) openSearch();
  for (const kind of ['session','task','exam']) if (button.dataset[`edit${kind[0].toUpperCase()+kind.slice(1)}`]) openEntryEditor(kind, button.dataset[`edit${kind[0].toUpperCase()+kind.slice(1)}`]);
  if (button.dataset.editGoal) {
    const id = button.dataset.editGoal; if (!subjectObj(id)) return;
    modal('Weekly module target', `<p class="muted">${esc(subjectName(id))}. Set zero to turn off the target.</p><label>Minutes per week<input class="apple-input" name="minutes" type="number" min="0" max="10080" step="1" value="${moduleWeeklyGoal(id)}" required></label>`, data => {
      const value = Number(data.get('minutes'));
      if (!Number.isInteger(value) || value < 0 || value > 10080) { $('form-error').textContent = 'Enter 0–10080 minutes.'; return false; }
      state.moduleGoals[id] = value; finishEdit();
    });
  }
  if (button.dataset.resumeModule) openModuleWorkspace(button.dataset.resumeModule);
  if (button.dataset.resumeFile) { const file = state.files.find(f=>f.id===button.dataset.resumeFile); if(file) openStudyPreview(file); }
  if (button.dataset.searchKind) {
    const kind = button.dataset.searchKind, id = button.dataset.searchId; $('search-dialog').close();
    if (kind === 'module') openModuleWorkspace(id);
    else if (kind === 'file') { const file = state.files.find(f=>f.id===id); if(file) openStudyPreview(file); }
    else openEntryEditor(kind,id);
  }
});
renderFeatureWidgets();
