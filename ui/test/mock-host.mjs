// Test-only Eyre simulator. Never imported by the application bundle.
import {createServer} from 'node:http';
import {newMoon} from '../src/model.mjs';
const host = '~siglup-narwet';
const first = '~sampel-siglup-narwet';
// Booted before .first but listed after it, so the console must sort by boot.
const older = '~dozlet-siglup-narwet';
const vanes = ['ames','behn','clay','dill','eyre','gall','iris','jael','khan'];
const deskRows = [
  {desk:'base',title:null,running:true,hash:'0vbase',source:{ship:host,desk:'kids'},dependencies:[]},
  {desk:'glurff',title:'Glurff',running:true,hash:'0vglurff',source:{ship:'~nolset',desk:'glurff'},dependencies:['landscape']},
  {desk:'groups',title:null,running:true,hash:'0vgroups',source:{ship:'~zod',desk:'groups'},dependencies:[]},
  {desk:'landscape',title:'Landscape',running:true,hash:'0vlandscape',source:{ship:host,desk:'landscape'},dependencies:[]},
  {desk:'noltbook-data',title:null,running:false,hash:'0vdata',source:null,dependencies:[]},
];
// Mirrors %theseus: each desk tracks the host, or the host's own source.
const sourceOf = (desk, from) => from === 'publisher' ? deskRows.find(r => r.desk === desk).source : {ship:host, desk: desk === 'base' ? 'kids' : desk};
const moon = (ship, desks=[{desk:'base',from:'host'},{desk:'landscape',from:'host'}], {booted=Date.now(), stage='running'}={}) => ({ship,status:'healthy',paused:false,queued:0,identity:true,vanes,booted,desks:desks.map(({desk,from}) => ({desk,stage:desk === 'base' ? 'running' : stage,reason:null,source:sourceOf(desk,from)}))});
// Desks of a fresh boot install for a moment, as Kiln does on the host.
let installing = new Map();
const settle = () => {for (const [ship, at] of installing) if (Date.now() >= at) {installing.delete(ship); data.moons.find(m => m.ship === ship)?.desks.forEach(d => {d.stage = 'running';});}};
// Terminal input the console sent, and each moon's current input line.
let termLog = [];
const lines = new Map();
// Unix ms as an Urbit date, e.g. ~2026.10.4..12.0.5
const da = ms => {const d = new Date(ms); return `~${d.getUTCFullYear()}.${d.getUTCMonth()+1}.${d.getUTCDate()}..${d.getUTCHours()}.${d.getUTCMinutes()}.${d.getUTCSeconds()}`;};
let data;
let gw;
let installed = new Set();
const code = 'lidlut-tabwed-pillex-ridrup';
const reset = () => {installing = new Map(); termLog = []; lines.clear(); data={version:3,host,moons:[moon(first, undefined, {booted: Date.UTC(2026,9,2,12)}), moon(older, undefined, {booted: Date.UTC(2026,9,1,9)})],fleets:[],caches:['default'],snapshots:[{path:'/baseline',ships:[first],compatible:true,created:'~2026.10.2..12.00.00'}]}; installed=new Set([first]); gw={mode:'auto',port:null,template:null,live:{port:5174,upstream:8083,at:'~2026.10.2..12.00.00'}};}; reset();
// Mirrors %theseus-ui's /x/gateway status logic.
const gatewayJson = () => {
  const url = gw.mode === 'hosting' ? gw.template : gw.mode === 'declared' ? `http://{moon}.localhost:${gw.port}` : gw.live ? `http://{moon}.localhost:${gw.live.port}` : null;
  const status = gw.mode === 'hosting' ? 'external' : !gw.live ? 'down' : gw.live.upstream !== 8083 ? 'stale' : gw.mode === 'declared' && gw.port !== gw.live.port ? 'mismatch' : 'ok';
  return {...gw, eyre: 8083, url: gw.mode === 'declared' || gw.mode === 'hosting' || gw.live ? url : null, status};
};
let id = 0;
let deletes = 0;
const channels = new Map();
const send = (channel, event) => {
  const text = `id: ${++id}\ndata: ${JSON.stringify(event)}\n\n`;
  if (channel.response) channel.response.write(text); else channel.pending.push(text);
};
createServer(async (req,res) => {
  if (req.url === '/health') return res.end('ok');
  if (req.url === '/reset') {reset(); deletes = 0; return res.end('ok');}
  if (req.url === '/deletes') return res.end(String(deletes));
  if (req.url === '/term-log') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(termLog));}
  if (req.url === '/gateway-down') {gw.live = null; return res.end('ok');}
  if (req.url === '/~/scry/theseus-ui/gateway.json') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(gatewayJson()));}
  const web = /^\/~\/scry\/theseus\/web\/(~[a-z-]+)\.json$/.exec(req.url);
  if (web) {
    if (!data.moons.some(m => m.ship === web[1])) {res.statusCode = 404; return res.end();}
    res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ship: web[1], code, landscape: installed.has(web[1])}));
  }
  if (req.url === '/~/name') return res.end(host);
  if (req.url === '/~/scry/theseus/ui.json') {settle(); res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(data));}
  if (req.url === '/~/scry/theseus/desks.json') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({version:1,desks:deskRows}));}
  if (!req.url.startsWith('/~/channel/')) {res.statusCode=404; return res.end();}
  const channel = channels.get(req.url) || {pending:[],response:null,sub:0}; channels.set(req.url,channel);
  if (req.method === 'GET') {
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}); res.flushHeaders(); channel.response=res;
    channel.pending.splice(0).forEach(text => res.write(text)); const timer=setInterval(() => res.write(': heartbeat\n\n'),1000);
    req.on('close',() => {clearInterval(timer); channel.response=null;}); return;
  }
  let body=''; for await (const chunk of req) body+=chunk;
  for (const action of JSON.parse(body || '[]')) {
    if (action.action === 'delete') {deletes++; channel.response?.end(); channels.delete(req.url); continue;}
    if (action.action === 'subscribe') {channel.sub=action.id; send(channel,{id:action.id,response:'subscribe',ok:'ok'}); continue;}
    if (action.action !== 'poke') continue;
    if (action.app === 'theseus-ui') {
      const set = action.json.set; const okPort = p => p === null || (Number.isInteger(p) && p > 0 && p < 65536);
      const okTemplate = t => t === null || /^https?:\/\/[^/\s]*\{moon\}[^/\s]*\/?$/.test(t);
      if (!set || !okPort(set.port) || !okTemplate(set.template) || (set.mode === 'declared' && set.port === null) || (set.mode === 'hosting' && set.template === null)) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      gw = {...gw, mode: set.mode, port: set.port, template: set.template}; send(channel,{id:action.id,response:'poke',ok:'ok'}); continue;
    }
    const [kind,value] = Object.entries(action.json)[0];
    if (value.command === 'fail') {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
    if (kind === 'fleet-new') {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(value.name) || !Number.isInteger(value.count) || value.count < 1 || value.count > 64 || data.fleets.some(group => group.name === value.name)) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      const existing = [...data.moons.map(m => m.ship),...data.fleets.flatMap(group => group.ships)], ships=[];
      for (let i=0;i<value.count;i++) {const ship=newMoon(host,[...existing,...ships],1000+i);ships.push(ship);}
      data.fleets.push({name:value.name,ships,desks:value.desks,created:Date.now()});
    }
    if (kind === 'boot') {
      // Mirrors mar/theseus/ui: every desk names its source, host or publisher.
      if (!Array.isArray(value.desks) || !value.desks.every(d => typeof d?.desk === 'string' && ['host','publisher'].includes(d.from))) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      // The host acknowledges a boot only once the moon is built.
      await new Promise(resolve => setTimeout(resolve, 700));
      data.moons.push(moon(value.who,value.desks,{stage:'installing'})); installing.set(value.who, Date.now() + 1500);
      if (value.desks.some(d => d.desk === 'landscape')) installed.add(value.who);
    }
    if (kind === 'pause' || kind === 'resume') data.moons.find(m=>m.ship===value.who).paused=kind==='pause';
    if (kind === 'fleet-pause' || kind === 'fleet-resume') {const group=data.fleets.find(g=>g.name===value.name);for(const ship of group?.ships||[]){const m=data.moons.find(row=>row.ship===ship);if(m)m.paused=kind==='fleet-pause';}}
    if (kind === 'kill') {data.moons=data.moons.filter(m=>m.ship!==value.who);data.fleets=data.fleets.map(group=>({...group,ships:group.ships.filter(ship=>ship!==value.who)})).filter(group=>group.ships.length);}
    if (kind === 'fleet-kill') {const group=data.fleets.find(g=>g.name===value.name);const ships=new Set(group?.ships||[]);data.moons=data.moons.filter(m=>!ships.has(m.ship));data.fleets=data.fleets.filter(g=>g.name!==value.name);}
    if (kind === 'snapshot') {
      // Mirrors mar/theseus/ui: resume is required.
      if (typeof value.resume !== 'boolean') {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      data.snapshots.push({path:`/${value.name}`,ships:value.ships,compatible:true,created:da(Date.now() + 1000 * data.snapshots.length)});
      if (!value.resume) data.moons.forEach(m=>{if(value.ships.includes(m.ship))m.paused=true;});
    }
    if (kind === 'term') {
      // Mirrors mar/theseus/ui: exactly one of belts, size, hail.
      const act = value.act || {}, keys = Object.keys(act);
      const beltOk = b => b && Object.keys(b).length === 1 && (typeof b.txt === 'string' || 'ret' in b || 'bac' in b || 'del' in b || ['u','d','l','r'].includes(b.aro) || /^[a-z]$/.test(b.ctl ?? b.met ?? ''));
      const ok = keys.length === 1 && (keys[0] === 'hail' || (keys[0] === 'size' && Number.isInteger(act.size?.cols) && Number.isInteger(act.size?.rows)) || (keys[0] === 'belts' && Array.isArray(act.belts) && act.belts.every(beltOk)));
      if (!ok) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      termLog.push({who: value.who, act});
    }
    if (kind === 'restore') data.snapshots.find(s=>s.path===value.path).ships.forEach(ship=>{const m=data.moons.find(m=>m.ship===ship);if(m)m.paused=false;else data.moons.push(moon(ship));});
    if (kind === 'delete') data.snapshots=data.snapshots.filter(s=>s.path!==value.path);
    if (kind === 'dojo' && /^\|install ~[a-z-]+ %landscape$/.test(value.command)) installed.add(value.who);
    send(channel,{id:action.id,response:'poke',ok:'ok'});
    if (kind === 'dojo') send(channel,{id:channel.sub,response:'diff',json:{ship:value.who,blits:[{put:[...`> ${value.command}`]},{nel:true},{put:['4']},{nel:true}]}});
    // A tiny Dojo: echo typing, answer (add 2 2) on Enter, redraw on hail.
    if (kind === 'term') {
      const prompt = `${value.who.slice(1)}:dojo> `, out = blits => send(channel,{id:channel.sub,response:'diff',json:{ship:value.who,blits}});
      const redraw = () => out([{mor:[{hop:0},{wyp:true},{put:[...prompt, ...(lines.get(value.who) || '')]}]}]);
      if ('hail' in value.act) redraw();
      for (const belt of value.act.belts || []) {
        const line = lines.get(value.who) || '';
        if (typeof belt.txt === 'string') {lines.set(value.who, line + belt.txt); redraw();}
        if ('bac' in belt) {lines.set(value.who, line.slice(0, -1)); redraw();}
        if ('ret' in belt) {lines.set(value.who, ''); out([{nel:true},{put:[...(line === '(add 2 2)' ? '4' : '~')]},{nel:true}]); redraw();}
      }
    }
  }
  res.statusCode=204;res.end();
}).listen(8085,'127.0.0.1');
