/* Study planning views share the existing state and save/sync pipeline. */
function moduleWeeklyGoal(id) { return state.moduleGoals[id] ?? 60; }
let workspaceSubject = localStorage.getItem('stud-workspace') || '';
const dateNumber = value => { const [y, m, d] = value.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const daysUntil = value => dateNumber(value) - dateNumber(day(new Date()));
function weekSessions(offset = 0) {
  const dates = weekDays().map(date => { const copy = new Date(date); copy.setDate(copy.getDate() + offset * 7); return day(copy); });
  return state.sessions.filter(session => dates.includes(session.date));
}
function pendingTasks(subjectId) {
  return state.tasks.filter(task => !task.done && (!subjectId || task.subjectId === subjectId)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
}
function upcomingExams(subjectId) {
  return (state.exams || []).filter(exam => daysUntil(exam.date) >= 0 && (!subjectId || exam.subjectId === subjectId)).sort((a, b) => a.date.localeCompare(b.date));
}
const studyHeader = (eyebrow, title, subtitle, actions = '') => `<header class="page-header"><div><div class="eyebrow">${eyebrow}</div><h1>${title}<span>.</span></h1><p class="header-subtitle">${subtitle}</p></div><div class="header-actions">${actions}</div></header>`;
const studyEmpty = message => `<p class="empty">${message}</p>`;
function taskCards(tasks) {
  return tasks.map(task => `<div class="study-row"><input type="checkbox" data-check="${esc(task.id)}" aria-label="Complete ${esc(task.title)}"><div><strong>${esc(task.title)}</strong><small>${esc(subjectName(task.subjectId))} · ${task.due ? (daysUntil(task.due) < 0 ? 'Overdue · ' : '') + esc(task.due) : 'No deadline'}</small></div><button class="quiet-btn" data-edit-task="${esc(task.id)}">Edit</button><button class="quiet-btn" data-study-start="${esc(task.subjectId || '')}">Study</button></div>`).join('') || studyEmpty('No pending tasks. You have room to focus.');
}
function examCards(exams) {
  return exams.map(exam => {
    const studied = minutes(weekSessions().filter(s => s.subject === exam.subjectId));
    const left = daysUntil(exam.date);
    return `<article class="exam-card"><div class="countdown ${left <= 7 ? 'urgent' : ''}"><strong>${left}</strong><span>${left === 1 ? 'day' : 'days'} left</span></div><div><strong>${esc(exam.title)}</strong><small>${esc(subjectName(exam.subjectId))} · ${esc(exam.date)}</small><p>${studied ? duration(studied) + ' studied this week' : 'No study logged this week'}${left <= 14 && studied < moduleWeeklyGoal(exam.subjectId) ? ' · Needs attention' : ''}</p><button class="quiet-btn" data-study-start="${esc(exam.subjectId)}">Study module →</button></div><button class="quiet-btn" data-edit-exam="${esc(exam.id)}">Edit</button><button class="delete" data-exam-delete="${esc(exam.id)}" aria-label="Delete exam ${esc(exam.title)}">×</button></article>`;
  }).join('') || studyEmpty('No upcoming exams. Add one to plan your revision.');
}
function moduleCards() {
  return state.subjects.map(subject => {
    const sessions = state.sessions.filter(s => s.subject === subject.id);
    const tasks = state.tasks.filter(t => t.subjectId === subject.id);
    const complete = tasks.filter(t => t.done).length;
    return `<button class="module-tile card" data-open-module="${esc(subject.id)}"><span class="eyebrow">${esc(semesterName(subject.semesterId))}</span><h2>${esc(subject.name)}</h2><p>${duration(minutes(sessions))} total · ${state.files.filter(f => f.subjectId === subject.id).length} files</p><progress max="${tasks.length || 1}" value="${complete}" aria-label="Task completion"></progress><small>${complete} / ${tasks.length} tasks completed</small><span class="module-arrow">Open workspace ↗</span></button>`;
  }).join('') || studyEmpty('Add a subject from Overview to create your first module workspace.');
}
function renderStudyViews() {
  const tasks = pendingTasks(); const exams = upcomingExams(); const next = tasks[0];
  $('view-today').innerHTML = studyHeader(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), 'Make room for focus', 'Your next step, deadlines, and revision in one place.', '<a class="apple-btn-secondary" href="#modules">Modules</a><a class="apple-btn-secondary" href="#recap">Weekly recap</a>') +
    `<section class="focus-hero"><div><span class="eyebrow">YOUR NEXT STEP</span><h2>${next ? esc(next.title) : 'A little progress starts here'}</h2><p>${next ? esc(subjectName(next.subjectId)) + (next.due ? ' · Due ' + esc(next.due) : '') : 'Choose a module and record a focused study session.'}</p><button class="apple-btn-primary" data-study-start="${esc(next?.subjectId || exams[0]?.subjectId || state.subjects[0]?.id || '')}">Start studying →</button><small>Choose your duration in the study logger.</small></div><div class="hero-total"><strong>${duration(minutes(state.sessions.filter(s => s.date === day(new Date()))))}</strong><span>studied today</span></div></section>` +
    `<div class="study-columns"><section class="card"><div class="section-top"><h2>Upcoming deadlines</h2><a href="#tasks" class="apple-link-btn">All tasks ↗</a></div>${taskCards(tasks.slice(0, 5))}</section><section class="card"><div class="section-top"><h2>Exam countdowns</h2><button class="quiet-btn" data-add-exam>Add exam +</button></div>${examCards(exams)}</section></div>`;
  $('view-modules').innerHTML = studyHeader('YOUR COURSE SPACES', 'Modules', 'Files, tasks, and progress. Everything in its place.', '<a href="#today" class="apple-btn-secondary">Today</a><a href="#dashboard" class="apple-btn-secondary">Manage subjects</a>') + `<div class="module-grid">${moduleCards()}</div>`;
  renderWorkspace(); renderRecap();
  if (typeof renderFeatureWidgets === "function") renderFeatureWidgets();
  if (!$('study-preview').hidden) {
    const file = state.files.find(file => file.id === $('study-preview').dataset.fileId);
    if (file) $('preview-context').innerHTML = `<h3>Keep your next step in view</h3>${taskCards(pendingTasks(file.subjectId).slice(0, 2))}`;
  }
}
function renderWorkspace() {
  const subject = subjectObj(workspaceSubject);
  if (!subject) { $('view-module').innerHTML = studyHeader('WORKSPACE', 'Choose a module', 'Open a module to explore its study space.', '<a href="#modules" class="apple-btn-primary">Browse modules</a>'); return; }
  const sessions = state.sessions.filter(s => s.subject === subject.id).sort((a, b) => b.date.localeCompare(a.date));
  const files = state.files.filter(f => f.subjectId === subject.id);
  const tasks = state.tasks.filter(t => t.subjectId === subject.id); const done = tasks.filter(t => t.done).length;
  $('view-module').innerHTML = studyHeader(esc(semesterName(subject.semesterId)), esc(subject.name), 'Your module workspace.', `<a href="#modules" class="apple-btn-secondary">All modules</a><button class="apple-btn-primary" data-study-start="${esc(subject.id)}">Start studying →</button>`) +
    `<section class="card workspace-progress"><strong>${duration(minutes(sessions))} studied</strong><span>${done} of ${tasks.length} tasks complete</span><progress max="${tasks.length || 1}" value="${done}" aria-label="Module task completion"></progress></section><div class="study-columns"><section class="card"><div class="section-top"><h2>Study plan</h2><a href="#tasks" class="quiet-btn">Add task +</a></div>${taskCards(pendingTasks(subject.id))}<h3 class="study-subheading">Exams</h3>${examCards(upcomingExams(subject.id))}<button class="quiet-btn" data-add-exam>Add exam +</button></section><section class="card"><div class="section-top"><h2>Course files</h2><button class="quiet-btn" data-module-upload="${esc(subject.id)}">Upload +</button></div>${files.map(file => `<div class="study-row"><span>${getFileIcon(file.type || '', file.name)}</span><div><strong>${esc(file.customTitle || file.name)}</strong><small>${esc(file.category)} · ${formatBytes(file.size || 0)}</small></div><button class="quiet-btn" data-preview-file="${esc(file.id)}">Preview</button></div>`).join('') || studyEmpty('No course files for this module yet.')}<h3 class="study-subheading">Recent study sessions</h3>${sessions.slice(0, 8).map(session => `<div class="study-row"><div><strong>${duration(session.minutes)}</strong><button class="quiet-btn" data-edit-session="${esc(session.id)}">Edit</button><small>${esc(session.date)}${session.note ? ' · ' + esc(session.note) : ''}</small></div></div>`).join('') || studyEmpty('Your first session will appear here.')}</section></div>`;
}
function renderRecap() {
  const current = weekSessions(), previous = weekSessions(-1); const total = minutes(current), last = minutes(previous);
  const ranking = state.subjects.map(subject => ({ subject, total: minutes(current.filter(s => s.subject === subject.id)) })).sort((a, b) => b.total - a.total);
  const needs = ranking.filter(item => item.total < moduleWeeklyGoal(item.subject.id) && (pendingTasks(item.subject.id).length || upcomingExams(item.subject.id).length));
  $('view-recap').innerHTML = studyHeader('MONDAY – SUNDAY', 'Your week in focus', 'A snapshot of this week so far, compared with last week.', '<a href="#today" class="apple-btn-secondary">Today</a>') +
    `<div class="recap-stats"><article class="card"><span>STUDY TIME</span><strong>${duration(total)}</strong><small>${total === last ? 'Same total as last week' : duration(Math.abs(total - last)) + (total > last ? ' more' : ' less') + ' than last week'}</small></article><article class="card"><span>ACTIVE DAYS</span><strong>${new Set(current.map(s => s.date)).size} / 7</strong><small>${current.length} study sessions</small></article><article class="card"><span>WEEKLY GOAL</span><strong>${Math.round(total / state.goal * 100)}%</strong><small>${duration(state.goal)} target</small></article></div><div class="study-columns"><section class="card"><h2>Where your time went</h2>${ranking.filter(item => item.total).map(item => `<div class="recap-module"><button class="quiet-btn" data-open-module="${esc(item.subject.id)}">${esc(item.subject.name)}</button><strong>${duration(item.total)}</strong><progress max="${total || 1}" value="${item.total}" aria-label="Share of weekly study"></progress></div>`).join('') || studyEmpty('Log a study session to start your weekly recap.')}</section><section class="card"><h2>Next week starts here</h2><p class="muted">Modules with pending work that are below their weekly study target.</p>${needs.map(item => `<div class="study-row"><div><strong>${esc(item.subject.name)}</strong><small>${pendingTasks(item.subject.id).length} pending tasks · ${upcomingExams(item.subject.id).length} upcoming exams</small></div><button class="quiet-btn" data-study-start="${esc(item.subject.id)}">Study →</button></div>`).join('') || studyEmpty('No modules flagged for attention.')}</section></div>`;
}
function openStudyPreview(file) {
  if (!file.gdrive?.fileId) { toast('This document has no Drive preview.'); return; }
  $('study-preview').dataset.fileId = file.id;
  localStorage.setItem('stud-last-file', file.id);
  $('preview-title').textContent = file.customTitle || file.name;
  $('preview-module').textContent = subjectName(file.subjectId);
  $('preview-context').innerHTML = `<h3>Keep your next step in view</h3>${taskCards(pendingTasks(file.subjectId).slice(0, 2))}`;
  $('preview-frame').src = `https://drive.google.com/file/d/${encodeURIComponent(file.gdrive.fileId)}/preview`;
  $('preview-external').href = `https://drive.google.com/file/d/${encodeURIComponent(file.gdrive.fileId)}/view`;
  $('study-preview').hidden = false; document.body.classList.add('preview-open'); $('preview-close').focus({ preventScroll: true });
}
function closeStudyPreview() { $('study-preview').hidden = true; $('preview-frame').src = 'about:blank'; document.body.classList.remove('preview-open'); }
$('preview-close').onclick = closeStudyPreview;
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('study-preview').hidden && !document.querySelector('dialog[open]')) closeStudyPreview(); });
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.hasAttribute('data-study-start')) {
    const id = button.dataset.studyStart;
    if (!$('study-preview').hidden && matchMedia('(max-width: 1199px)').matches) closeStudyPreview();
    if (!state.subjects.length) { toast('Add a module from Overview first.'); switchPage('dashboard'); return; }
    switchPage('logger'); if (subjectObj(id)) { $('entry-subject').value = id; $('entry-subject').dispatchEvent(new Event('change', { bubbles: true })); } return;
  }
  if (button.dataset.openModule) { workspaceSubject = button.dataset.openModule; localStorage.setItem('stud-workspace', workspaceSubject); renderWorkspace(); switchPage('module'); }
  if (button.dataset.moduleUpload) { openUploadModal(); $('upload-subject').value = button.dataset.moduleUpload; $('upload-subject').dispatchEvent(new Event('change', { bubbles: true })); }
  if (button.hasAttribute('data-add-exam')) {
    if (!state.subjects.length) { toast('Add a module first.'); return; }
    modal('Plan an exam', `<label>Exam title<input name="title" class="apple-input" required maxlength="100" placeholder="e.g. Final exam"></label><label>Module<select name="subjectId" aria-label="Exam module">${renderSubjectOptions(workspaceSubject)}</select></label><label>Exam date<input name="date" class="apple-input" type="date" min="${day(new Date())}" required></label>`, data => {
      const title = data.get('title').trim(), date = data.get('date'), subjectId = data.get('subjectId');
      if (!title || !validDate(date) || daysUntil(date) < 0 || !subjectObj(subjectId)) { $('form-error').textContent = 'Enter a title, module, and upcoming date.'; return false; }
      state.exams.push({ id: uid(), title, date, subjectId }); save(); render();
    });
  }
  if (button.dataset.examDelete && confirm('Remove this exam countdown?')) { state.exams = state.exams.filter(exam => exam.id !== button.dataset.examDelete); save(); render(); }
});
document.addEventListener('stud:render', renderStudyViews);
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(value) {
  if (!['system', 'light', 'dark'].includes(value)) value = 'system';
  localStorage.setItem('stud-theme', value); document.documentElement.dataset.theme = value === 'system' ? (systemTheme.matches ? 'dark' : 'light') : value;
  $('theme-choice').value = value; $('theme-choice').dispatchEvent(new Event('change', { bubbles: true }));
  $('mobile-theme-btn').title = `Appearance: ${value}. Click to change.`;
}
$('theme-choice').addEventListener('change', () => { const value = $('theme-choice').value; localStorage.setItem('stud-theme', value); document.documentElement.dataset.theme = value === 'system' ? (systemTheme.matches ? 'dark' : 'light') : value; $('mobile-theme-btn').title = `Appearance: ${value}. Click to change.`; });
$('mobile-theme-btn').onclick = () => { const choices = ['system', 'light', 'dark']; applyTheme(choices[(choices.indexOf(localStorage.getItem('stud-theme') || 'system') + 1) % choices.length]); };
systemTheme.addEventListener('change', () => { if ((localStorage.getItem('stud-theme') || 'system') === 'system') applyTheme('system'); });
applyTheme(localStorage.getItem('stud-theme') || 'system');
renderStudyViews();
