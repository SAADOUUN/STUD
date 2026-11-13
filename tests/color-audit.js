/* Inspect computed text/background pairs across every study view and modal. */
async function runColorAudit() {
  const stable = document.createElement('style');
  stable.textContent = '*,*::before,*::after { transition:none!important; animation:none!important; }';
  document.head.append(stable);
  const failures = []; const totals = {};
  const parse = color => { const n = color.match(/[\d.]+/g)?.map(Number); return n?.length >= 3 ? [n[0],n[1],n[2],n[3] ?? 1] : [0,0,0,0]; };
  const blend = (front, back) => [0,1,2].map(i=>front[i]*front[3]+back[i]*(1-front[3])).concat(1);
  const lum = color => color.slice(0,3).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
  const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  function backgrounds(element) {
    if (!element) return [[255,255,255,1]];
    const style = getComputedStyle(element); let colors = backgrounds(element.parentElement);
    colors = colors.map(base => blend(parse(style.backgroundColor),base));
    const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(match=>parse(match[0]));
    if (stops.length) colors = colors.flatMap(base=>stops.map(stop=>blend(stop,base)));
    return colors.slice(0,16);
  }
  function inspect(label) {
    let checked=0;
    for(const element of document.querySelectorAll('body *')) {
      if(element.closest('[hidden],iframe,script,style,#test-report') || !element.getClientRects().length || element.matches(':disabled') || element.closest('button:disabled')) continue;
      const text=[...element.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ');
      const isField=element.matches('input:not([type=range]):not([type=checkbox]):not([type=file]):not([type=hidden])');
      if(!/[a-zA-Z0-9À-ÿ]/.test(text) && !isField) continue;
      if(element.closest('.select-control') && element.tagName==='SELECT') continue;
      const style=getComputedStyle(element); if(style.visibility==='hidden'||Number(style.opacity)===0)continue;
      const foreground=parse(style.color); const pairs=backgrounds(element);
      const worst=Math.min(...pairs.map(bg=>ratio(blend(foreground,bg),bg)));
      const required=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700)?3:4.5;
      checked++;
      if(worst+.01<required) failures.push({view:label,selector:element.id?`#${element.id}`:element.tagName.toLowerCase()+'.'+[...element.classList].join('.'),text:(text||element.value||element.placeholder||'field').slice(0,65),ratio:+worst.toFixed(2),required,color:style.color,background:pairs.map(c=>c.slice(0,3).map(Math.round).join(',')).join('|')});
    }
    totals[label]=checked;
  }
  const stateRules = document.createElement('style');
  function collect(rules) {
    let result = '';
    for (const rule of rules) {
      if (rule.selectorText) result += rule.selectorText.replace(/:hover/g,'.audit-hover').replace(/:focus-visible/g,'.audit-focus').replace(/:focus-within/g,'.audit-focus-within').replace(/:focus(?!-)/g,'.audit-focus') + '{' + rule.style.cssText + '}';
      else if (rule.cssRules && (!rule.conditionText || !rule.media || matchMedia(rule.conditionText).matches)) result += collect(rule.cssRules);
    }
    return result;
  }
  stateRules.textContent = [...document.styleSheets].map(sheet=>collect(sheet.cssRules)).join(''); document.head.append(stateRules);
  function inspectStates(label) {
    inspect(label);
    const controls = [...document.querySelectorAll('button,a,input,textarea,.drop-zone,.cal-day-cell')].filter(e=>e.getClientRects().length);
    controls.forEach(e=>e.classList.add('audit-hover')); inspect(label+'/hover'); controls.forEach(e=>e.classList.remove('audit-hover'));
    controls.forEach(e=>e.classList.add('audit-focus')); inspect(label+'/focus'); controls.forEach(e=>e.classList.remove('audit-focus'));
  }
  const originalFiles = state.files, originalTasks = state.tasks;
  state.files = ['cours','tp','td','examen','autre'].map((category,index)=>({...originalFiles[0],id:'audit-file-'+index,category}));
  state.tasks = [...originalTasks,{id:'audit-pending',title:'Pending assignment',subjectId:state.subjects[0].id,due:'2020-01-01',done:false}];
  render();renderFiles();
  const tick=()=>new Promise(r=>setTimeout(r,50));
  for(const theme of ['light','dark']) {
    applyTheme(theme);
    for(const page of ['today','dashboard','logger','calendar','files','tasks','history','modules','module','recap']) { switchPage(page); await tick();inspectStates(theme+'/'+page); }
    openUploadModal();await tick();inspectStates(theme+'/upload');$('upload-modal').close();
    openGoogleDriveModal();await tick();inspectStates(theme+'/drive');$('gdrive-modal').close();
    localStorage.setItem(GDRIVE_TOKEN_KEY,'audit-token');localStorage.setItem(GDRIVE_EXP_KEY,String(Date.now()+60000));
    openGoogleDriveModal();await tick();inspectStates(theme+'/drive-connected');$('gdrive-modal').close();localStorage.removeItem(GDRIVE_TOKEN_KEY);localStorage.removeItem(GDRIVE_EXP_KEY);updateGoogleDriveUI();
    openEntryEditor('session','session-test');await tick();inspectStates(theme+'/editor');$('modal').close();
    openSearch();$('global-search').value='final';renderSearch();await tick();inspectStates(theme+'/search');$('search-dialog').close();
    switchPage('files');$('files-subject-filter').parentElement.querySelector('button').click();await tick();inspectStates(theme+'/choices');document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    openStudyPreview(state.files[0]);await tick();inspectStates(theme+'/preview');closeStudyPreview();
  }
  switchPage('today');applyTheme('dark');
  state.files=originalFiles;state.tasks=originalTasks;render();renderFiles();
  stateRules.remove();stable.remove();
  return {totals,failures};
}
