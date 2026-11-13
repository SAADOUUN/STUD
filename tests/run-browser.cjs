const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let child;
(async () => {
  let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  html = html.replace('<script src="https://accounts.google.com/gsi/client" async defer></script>','<script>localStorage.clear();</script>');
  for (const file of ['app.js','study.js','features.js','ui.js','style.css']) html = html.replace(`"${file}"`,`"../${file}"`);
  html = html.replace('</head>','<script src="browser-tests.js" defer></script></head>');
  fs.writeFileSync(path.join(__dirname,'browser-smoke.html'),html);
  child = spawn(chrome, ['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--allow-file-access-from-files','--remote-debugging-port=0',`--user-data-dir=${path.join(__dirname,'cdp-profile')}`], {windowsHide:true,stdio:['ignore','ignore','pipe']});
  const endpoint = await new Promise((resolve,reject) => {
    let stderr = ''; const timeout = setTimeout(()=>reject(new Error('Chrome startup timed out')),15000);
    child.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
    child.on('error',reject);
  });
  const socket = new WebSocket(endpoint); await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0; const pending=new Map();
  socket.onmessage = event => { const result=JSON.parse(event.data);if(pending.has(result.id)){const {resolve,reject}=pending.get(result.id);pending.delete(result.id);result.error?reject(new Error(result.error.message)):resolve(result.result);} };
  const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  for(const [name,width,height,mobile] of [['desktop',1440,1000,false],['mobile',390,844,true]]){
    const {targetId}=await call('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
    await call('Page.enable',{},sessionId);
    await call('Network.enable',{},sessionId);
    await call('Network.setBlockedURLs',{urls:['*://*.google.com/*','*://*.googleapis.com/*']},sessionId);
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile},sessionId);
    await call('Page.navigate',{url:pathToFileURL(path.join(__dirname,'browser-smoke.html')).href},sessionId);
    let report;
    for(let attempt=0;attempt<120;attempt++){
      await sleep(100);
      const value=await call('Runtime.evaluate',{expression:'document.getElementById("test-report")?.textContent',returnByValue:true},sessionId);
      if(value.result.value){report=JSON.parse(value.result.value);break;}
    }
    if(!report)throw new Error(`${name}: tests timed out`);
    const viewport=await call('Runtime.evaluate',{expression:'JSON.stringify({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})',returnByValue:true},sessionId);
    console.log(name, JSON.stringify(report), 'viewport',viewport.result.value);
    if(report.failed)throw new Error(`${name}: ${report.failed}`);
    await call('Runtime.evaluate',{expression:'document.getElementById("test-report").remove(); window.scrollTo(0,0)',returnByValue:true},sessionId);
    await sleep(200);
    const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);
    fs.writeFileSync(path.join(__dirname,`${name}.png`),Buffer.from(data,'base64'));
    for (const theme of ['light','dark']) {
      await call('Runtime.evaluate',{expression:`switchPage('logger'); applyTheme('${theme}'); window.scrollTo(0,0);`,returnByValue:true},sessionId);
      await sleep(250);
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);
      fs.writeFileSync(path.join(__dirname,`${name}-logger-${theme}.png`),Buffer.from(shot.data,'base64'));
    }
    await call('Target.closeTarget',{targetId});
  }
  await call('Browser.close'); socket.close();
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{if(child)child.kill();});
