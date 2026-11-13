/* Browser regression checks run against the real application with isolated data. */
window.addEventListener('DOMContentLoaded', async () => {
  const errors = []; const checks = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  window.addEventListener('error', event => errors.push(event.message));
  try {
    state = fresh(); const subjectId = state.subjects[0].id;
    const today = day(new Date());
    state.tasks = [{ id:'task-test',title:'Prepare exercises',subjectId,due:today,done:false }];
    state.exams = [{id:'exam-test',title:'Practice final',subjectId,date:today}];
    state.sessions = [{id:'session-test',subject:subjectId,date:today,minutes:30,note:'Revision chapter alpha',created:Date.now()}];
    state.files = [{id:'file-test',name:'chapter.pdf',customTitle:'Lecture notes',subjectId,category:'cours',size:100,type:'application/pdf',date:Date.now(),gdrive:{fileId:'test-document'}}];
    render(); renderFiles(); await settle();
    check($('view-today').textContent.includes('Prepare exercises'), 'Today shows pending task');
    switchPage('calendar');
    check(document.querySelector(`[data-cal-date="${today}"] .cal-exam-pill`), 'Calendar shows exam badge');
    renderDayInspector(today); check($('inspector-content').textContent.includes('Practice final'), 'Day inspector shows exam');
    check(searchStudy('revision alpha')[0]?.kind === 'session', 'Search matches session notes and all query words');
    check(searchStudy('lecture')[0]?.kind === 'file', 'Search matches custom file titles');
    check(searchStudy('practice')[0]?.kind === 'exam', 'Search includes exams');
    check(searchStudy('<script>').length === 0, 'Search handles markup as text');
    openEntryEditor('session','session-test'); await settle();
    const form = $('modal-form'); form.elements.minutes.value = '75'; form.elements.note.value = 'Updated revision';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); await settle();
    check(state.sessions[0].minutes === 75 && state.sessions[0].note === 'Updated revision', 'Session editing updates existing record');
    openEntryEditor('task','task-test'); await settle();
    form.elements.title.value = 'Exercises finished'; form.elements.done.checked = true;
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); await settle();
    check(state.tasks[0].done && state.tasks[0].title === 'Exercises finished', 'Task editing updates completion and title');
    openEntryEditor('exam','exam-test'); await settle();
    form.elements.title.value = 'Updated final'; form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); await settle();
    check($('inspector-content').textContent.includes('Updated final'), 'Exam edits refresh calendar inspector');
    openModuleWorkspace(subjectId); await settle();
    document.querySelector('[data-edit-goal]').click(); await settle();
    form.elements.minutes.value = '120'; form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); await settle();
    check(moduleWeeklyGoal(subjectId) === 120 && $('module-weekly-target').textContent.includes('2h'), 'Weekly module target saves and renders');
    check(validBackup(JSON.parse(localStorage.getItem(KEY))), 'Saved data with goals and exams passes backup validation');
    check($('resume-card').textContent.includes(state.subjects[0].name), 'Last module is offered for resume');
    switchPage('logger'); const trigger = $('entry-subject').parentElement.querySelector('.select-trigger'); trigger.click(); await settle();
    const menu = document.querySelector('.select-menu'); check(menu?.matches(':popover-open'), 'Choice menu opens in top layer');
    menu.dispatchEvent(new Event('scroll')); await settle(); check(document.querySelector('.select-menu'), 'Choice menu stays open on option scroll');
    menu.querySelectorAll('.select-option')[1].click(); await settle();
    check($('entry-subject').value === state.subjects[1].id, 'Choice menu updates underlying selection');
    document.querySelector('[data-open-search]').click(); await settle();
    $('global-search').value = 'updated final'; $('global-search').dispatchEvent(new Event('input')); await settle();
    check($('search-results').querySelector('[data-search-kind="exam"]'), 'Search dialog renders actionable results');
    $('search-results').querySelector('button').click(); await settle(); check($('modal').open, 'Search result opens editor'); $('modal').close();
    applyTheme('dark'); check(document.documentElement.dataset.theme === 'dark', 'Manual dark mode applies');
    const cell = document.querySelector('.cal-day-cell'); check(getComputedStyle(cell).backgroundColor !== 'rgb(253, 253, 253)', 'Calendar uses dark theme surface');
    function contrast(foreground, background) {
      const lum = color => {
        const values = color.match(/[0-9.]+/g).slice(0,3).map(value => Number(value)/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
        return values[0]*.2126 + values[1]*.7152 + values[2]*.0722;
      };
      const a=lum(foreground), b=lum(background); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    }
    switchPage('logger'); updateTimeDisplay(90);
    for (const theme of ['light','dark']) {
      applyTheme(theme);
      const dial=getComputedStyle($('time-boxes')), digits=getComputedStyle($('time-hours'));
      check(contrast(digits.color,dial.backgroundColor)>=4.5, `${theme} time digits are readable against dial`);
      check(digits.backgroundColor === 'rgba(0, 0, 0, 0)', `${theme} time inputs preserve dial background`);
      check(getComputedStyle($('time-slider')).backgroundImage.includes('linear-gradient'), `${theme} duration slider retains filled track`);
      const preset=getComputedStyle(document.querySelector('#preset-chips .active'));
      check(contrast(preset.color,preset.backgroundColor)>=4.5, `${theme} selected time preset has readable contrast`);
      const segment=getComputedStyle(document.querySelector('#date-segmented .active'));
      check(contrast(segment.color,segment.backgroundColor)>=4.5, `${theme} selected date has readable contrast`);
    }
    localStorage.setItem(GDRIVE_TOKEN_KEY,'test-token'); localStorage.setItem(GDRIVE_EXP_KEY,String(Date.now()+60000));
    openStudyPreview(state.files[0]); await settle();
    check(!$('study-preview').hidden && localStorage.getItem('stud-last-file') === 'file-test', 'Document preview remembers the last file');
    closeStudyPreview(); renderStudyViews();
    check($('resume-card').querySelector('[data-resume-file]'), 'Resume card reopens last document');
    const originalFetch = window.fetch;
    window.fetch = async () => ({ok:false,status:403,json:async()=>({error:{message:'Test denied'}})});
    await backupStudyDataToGoogleDrive(true).catch(()=>{});
    check(localStorage.getItem('stud-sync-state') === 'error' && $('sync-retry').textContent === 'Retry sync', 'Failed backup offers retry');
    check(!localStorage.getItem('stud-last-sync'), 'Failed backup does not record success');
    window.fetch = async (url, options = {}) => ({ok:true,status:200,json:async()=>options.method === 'PATCH' ? {id:'backup'} : {files:[{id:url.includes('files(id,name)') ? 'folder' : 'backup'}]}});
    await backupStudyDataToGoogleDrive(true);
    check(Number(localStorage.getItem('stud-last-sync')) > 0 && localStorage.getItem('stud-sync-state') === 'synced', 'Successful backup records timestamp and clears failure');
    check($('sync-summary').textContent.includes('Last sync:'), 'Last successful sync is visible');
    applyTheme('system'); check(document.documentElement.dataset.theme === (systemTheme.matches ? 'dark' : 'light'), 'System theme follows device preference'); applyTheme('dark');
    localStorage.removeItem(GDRIVE_TOKEN_KEY); localStorage.removeItem(GDRIVE_EXP_KEY); window.fetch = originalFetch;
    clearTimeout(autoSyncTimeout); updateGoogleDriveUI('disconnected');
    switchPage('today'); renderStudyViews(); await settle();
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Layout fits viewport');
    check(errors.length === 0, 'No uncaught runtime errors');
    const report = document.createElement('pre'); report.style.cssText='position:fixed;left:0;bottom:0;max-width:100vw;max-height:1px;overflow:hidden'; report.id='test-report'; report.textContent=JSON.stringify({passed:checks.length,checks}); document.body.append(report);
    document.title=`PASS ${checks.length} checks`;
  } catch (error) {
    const report=document.createElement('pre');report.style.cssText='position:fixed;left:0;bottom:0;max-width:100vw;max-height:1px;overflow:hidden'; report.id='test-report';report.textContent=JSON.stringify({failed:error.message,passed:checks.length,checks,errors});document.body.append(report);document.title='FAIL '+error.message;
  }
});
