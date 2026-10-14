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
// The host crashes adding this desk, so the poke is nacked and nothing
// changes: the console must keep the dialog open and show the rejection.
const rejectedDesk = 'noltbook-data';
// Mirrors %theseus: each desk tracks the host, or the host's own source.
const sourceOf = (desk, from) => from === 'publisher' ? deskRows.find(r => r.desk === desk).source : {ship:host, desk: desk === 'base' ? 'kids' : desk};
const moon = (ship, desks=[{desk:'base',from:'host'},{desk:'landscape',from:'host'}], {booted=Date.now(), stage='running'}={}) => ({ship,status:'healthy',paused:false,queued:0,identity:true,vanes,booted,desks:desks.map(({desk,from}) => ({desk,stage:desk === 'base' ? (stage === 'running' ? 'running' : 'catching-up') : stage,reason:null,source:sourceOf(desk,from)}))});
// A moon's desks as %theseus reads them from its Kiln when ui.json is asked
// for: a booted moon's desks are seeded from the host's own copies, so they
// match at once. .held moons differ from the host (as after a reset or a new
// release) until a test lets them go; nothing is pushed when that changes.
let installing = new Map();
let held = new Set();
const settle = () => {
  for (const [ship, at] of installing) {
    const moon = data.moons.find(m => m.ship === ship);
    if (Date.now() < at || !moon || moon.paused) continue;
    const caught = !held.has(ship) && Date.now() >= at + 800;
    if (caught) installing.delete(ship);
    moon.desks.forEach(d => {if (d.stage !== 'failed') d.stage = caught ? 'running' : 'catching-up';});
  }
};
// Terminal input the console sent, and each moon's current input line.
let termLog = [];
const lines = new Map();
// Unix ms as an Urbit date, e.g. ~2026.10.4..12.0.5
const da = ms => {const d = new Date(ms); return `~${d.getUTCFullYear()}.${d.getUTCMonth()+1}.${d.getUTCDate()}..${d.getUTCHours()}.${d.getUTCMinutes()}.${d.getUTCSeconds()}`;};
let data;
let gw;
// Names and pictures: ~sampel runs Noltbook, ~dozlet does not (a nickname
// kept by Theseus), and the host runs Noltbook.
let profiles;
let dojoLog = [];
// A 1x1 PNG, served as a picture a profile can point at.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let installed = new Set();
// Pictures uploaded to Noltbook: the host's from the browser, moons' via %theseus.
let uploads = [];
const code = 'lidlut-tabwed-pillex-ridrup';
const reset = () => {uploads = []; installing = new Map(); held = new Set(); termLog = []; dojoLog = []; lines.clear(); profiles = new Map([[host, {noltbook: true, name: null, avatar: null}], [first, {noltbook: true, name: null, avatar: null}]]); data={version:3,host,moons:[moon(first, undefined, {booted: Date.UTC(2026,9,2,12)}), moon(older, undefined, {booted: Date.UTC(2026,9,1,9)})],fleets:[],caches:['default'],snapshots:[{path:'/baseline',set:'/baseline',ships:[first],compatible:true,created:'~2026.10.2..12.00.00'}]}; installed=new Set([first]); gw={mode:'auto',port:null,template:null,live:{port:5174,upstream:8083,at:'~2026.10.2..12.00.00'}};}; reset();
// Mirrors %theseus-ui's /x/gateway status logic.
const gatewayJson = () => {
  const url = gw.mode === 'hosting' ? gw.template : gw.mode === 'declared' ? `http://{moon}.localhost:${gw.port}` : gw.live ? `http://{moon}.localhost:${gw.live.port}` : null;
  const status = gw.mode === 'hosting' ? 'external' : !gw.live ? 'down' : gw.live.upstream !== 8083 ? 'stale' : gw.mode === 'declared' && gw.port !== gw.live.port ? 'mismatch' : 'ok';
  return {...gw, eyre: 8083, url: gw.mode === 'declared' || gw.mode === 'hosting' || gw.live ? url : null, status};
};
let id = 0;
let deletes = 0;
const channels = new Map();
// Mirrors %theseus /x/profiles: Noltbook's profile, else a nickname.
const profileRow = ship => {const p = profiles.get(ship) || {noltbook: false, name: null, avatar: null}; return {ship, noltbook: p.noltbook, name: p.name, avatar: p.noltbook ? p.avatar : null};};
// Added desks arrive seeded from the host's copies, but a paused moon runs
// their install only when resumed: until then its Kiln doesn't list them.
const addDesks = (member, rows) => {
  const desks = rows.map(({desk,from})=>({desk,stage:'running',reason:null,source:sourceOf(desk,from)}));
  if (member.paused) member.pending = [...(member.pending || []), ...desks];
  else member.desks.push(...desks);
};
const setPaused = (member, paused) => {
  member.paused = paused;
  if (!paused && member.pending) {member.desks.push(...member.pending); delete member.pending;}
};
// Mirrors %theseus's /ui facts: "something changed", after an action.
const pushUi = () => {for (const ch of channels.values()) if (ch.ui) send(ch, {id: ch.ui, response: 'diff', json: true});};
// Mirrors %theseus's /profiles facts: one row per change, to every watcher.
const pushProfile = ship => {for (const ch of channels.values()) if (ch.profiles) send(ch, {id: ch.profiles, response: 'diff', json: profileRow(ship)});};
const send = (channel, event) => {
  const text = `id: ${++id}\ndata: ${JSON.stringify(event)}\n\n`;
  if (channel.response) channel.response.write(text); else channel.pending.push(text);
};
createServer(async (req,res) => {
  if (req.url === '/health') return res.end('ok');
  if (req.url === '/reset') {reset(); deletes = 0; return res.end('ok');}
  if (req.url === '/deletes') return res.end(String(deletes));
  if (req.url === '/term-log') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(termLog));}
  if (req.url === '/dojo-log') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(dojoLog));}
  if (req.url === '/avatar.png') {res.setHeader('Content-Type','image/png'); return res.end(png);}
  // Hold a moon's desks catching up, then let them go.
  const hold = /^\/(hold|release)\/(~[a-z-]+)$/.exec(req.url);
  if (hold) {
    const m = data.moons.find(row => row.ship === hold[2]);
    if (hold[1] === 'hold') {held.add(hold[2]); installing.set(hold[2], Date.now()); m?.desks.forEach(d => {d.stage = 'catching-up';});}
    else held.delete(hold[2]);
    return res.end('ok');
  }
  if (req.url === '/uploads') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(uploads));}
  // The host's Noltbook: an owner's upload, and each ship's uploaded picture.
  if (req.url === '/apps/noltbook/upload-avatar' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    if (!bytes.length || bytes.length > 51200) {res.statusCode = bytes.length ? 413 : 400; return res.end();}
    uploads.push({who: host, bytes: bytes.length, jpeg: bytes[0] === 0xff && bytes[1] === 0xd8}); return res.end();
  }
  if (req.url.startsWith('/apps/noltbook/user-avatar/')) {res.setHeader('Content-Type','image/png'); return res.end(png);}
  if (req.url === '/~/scry/theseus/profiles.json') {
    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({host: profileRow(host), moons: data.moons.map(m => profileRow(m.ship))}));
  }
  // A change made elsewhere, e.g. in the moon's own Noltbook: %theseus
  // notices it and pushes the row to every open page.
  const change = /^\/profile-change\?ship=(~[a-z-]+)&name=([^&]*)$/.exec(req.url);
  if (change) {
    const p = profiles.get(change[1]) || {noltbook: true, name: null, avatar: null};
    p.name = decodeURIComponent(change[2]) || null; profiles.set(change[1], p); pushProfile(change[1]);
    return res.end('ok');
  }
  if (req.url === '/gateway-down') {gw.live = null; pushUi(); return res.end('ok');}
  if (req.url === '/ui-signal') {pushUi(); return res.end('ok');}
  if (req.url === '/~/scry/theseus-ui/gateway.json') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(gatewayJson()));}
  const web = /^\/~\/scry\/theseus\/web\/(~[a-z-]+)\.json$/.exec(req.url);
  if (web) {
    if (!data.moons.some(m => m.ship === web[1])) {res.statusCode = 404; return res.end();}
    res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ship: web[1], code, landscape: installed.has(web[1])}));
  }
  if (req.url === '/~/name') return res.end(host);
  if (req.url === '/~/scry/theseus/ui.json') {settle(); res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(data, (key, value) => key === 'pending' ? undefined : value));}
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
    if (action.action === 'subscribe') {
      if (action.app === 'theseus' && action.path === '/profiles') channel.profiles = action.id;
      else if (action.app === 'theseus' && action.path === '/ui') channel.ui = action.id;
      else channel.sub = action.id;
      send(channel,{id:action.id,response:'subscribe',ok:'ok'}); continue;
    }
    if (action.action !== 'poke') continue;
    if (action.app === 'theseus-ui') {
      const set = action.json.set; const okPort = p => p === null || (Number.isInteger(p) && p > 0 && p < 65536);
      const okTemplate = t => t === null || /^https?:\/\/[^/\s]*\{moon\}[^/\s]*\/?$/.test(t);
      if (!set || !okPort(set.port) || !okTemplate(set.template) || (set.mode === 'declared' && set.port === null) || (set.mode === 'hosting' && set.template === null)) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      gw = {...gw, mode: set.mode, port: set.port, template: set.template}; send(channel,{id:action.id,response:'poke',ok:'ok'}); pushUi(); continue;
    }
    // The host's own Noltbook API, as the owner's browser pokes it.
    if (action.app === 'noltbook') {
      const av = action.json?.data?.avatar;
      if (action.mark !== 'noltbook-api' || action.json.action !== 'update-profile' || av?.type !== 'urbit' || !uploads.some(u => u.who === host)) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      profiles.get(host).avatar = {type: 'urbit', url: av.url};
      pushProfile(host);
      send(channel,{id:action.id,response:'poke',ok:'ok'}); continue;
    }
    const [kind,value] = Object.entries(action.json)[0];
    if (value.command === 'fail') {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
    if (kind === 'fleet-new') {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(value.name) || !Number.isInteger(value.count) || value.count < 1 || value.count > 64 || data.fleets.some(group => group.name === value.name)) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      const existing = [...data.moons.map(m => m.ship),...data.fleets.flatMap(group => group.ships)], ships=[];
      for (let i=0;i<value.count;i++) {const ship=newMoon(host,[...existing,...ships],1000+i);ships.push(ship);}
      data.fleets.push({name:value.name,ships,desks:value.desks,created:Date.now()});
    }
    if (kind === 'fleet-add-desks') {
      const group=data.fleets.find(row=>row.name===value.name);
      if (!group || !Array.isArray(value.desks) || !value.desks.every(d=>typeof d?.desk==='string'&&['host','publisher'].includes(d.from))) {send(channel,{id:action.id,response:'poke',err:'rejected'});continue;}
      const existing=new Set(group.desks.map(row=>row.desk));
      const fresh=value.desks.filter(row=>!existing.has(row.desk));
      if (!fresh.length || fresh.some(row=>row.desk===rejectedDesk)) {send(channel,{id:action.id,response:'poke',err:'rejected'});continue;}
      group.desks.push(...fresh);
      for (const ship of group.ships) {
        const member=data.moons.find(row=>row.ship===ship);if(!member)continue;
        const have=new Set(member.desks.map(row=>row.desk));
        addDesks(member, fresh.filter(row=>!have.has(row.desk)));
        if(fresh.some(row=>row.desk==='landscape'))installed.add(ship);
      }
    }
    if (kind === 'moon-add-desks') {
      const member=data.moons.find(row=>row.ship===value.who);
      if (!member || !Array.isArray(value.desks) || !value.desks.every(d=>typeof d?.desk==='string'&&['host','publisher'].includes(d.from))) {send(channel,{id:action.id,response:'poke',err:'rejected'});continue;}
      const existing=new Set(member.desks.map(row=>row.desk));
      const fresh=value.desks.filter(row=>!existing.has(row.desk));
      if (!fresh.length || fresh.some(row=>row.desk===rejectedDesk)) {send(channel,{id:action.id,response:'poke',err:'rejected'});continue;}
      addDesks(member, fresh);
      if(fresh.some(row=>row.desk==='landscape'))installed.add(member.ship);
    }
    if (kind === 'boot') {
      // Mirrors mar/theseus/ui: every desk names its source, host or publisher.
      if (!Array.isArray(value.desks) || !value.desks.every(d => typeof d?.desk === 'string' && ['host','publisher'].includes(d.from))) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      // The host acknowledges a boot only once the moon is built.
      await new Promise(resolve => setTimeout(resolve, 700));
      data.moons.push(moon(value.who,value.desks));
      if (value.desks.some(d => d.desk === 'landscape')) installed.add(value.who);
    }
    if (kind === 'pause' || kind === 'resume') setPaused(data.moons.find(m=>m.ship===value.who), kind==='pause');
    if (kind === 'fleet-pause' || kind === 'fleet-resume') {const group=data.fleets.find(g=>g.name===value.name);for(const ship of group?.ships||[]){const m=data.moons.find(row=>row.ship===ship);if(m)setPaused(m, kind==='fleet-pause');}}
    if (kind === 'kill') {data.moons=data.moons.filter(m=>m.ship!==value.who);data.fleets=data.fleets.map(group=>({...group,ships:group.ships.filter(ship=>ship!==value.who)})).filter(group=>group.ships.length);}
    if (kind === 'fleet-kill') {const group=data.fleets.find(g=>g.name===value.name);const ships=new Set(group?.ships||[]);data.moons=data.moons.filter(m=>!ships.has(m.ship));data.fleets=data.fleets.filter(g=>g.name!==value.name);}
    if (kind === 'snapshot') {
      // Mirrors mar/theseus/ui: resume is required.
      if (typeof value.resume !== 'boolean') {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      // Mirrors %theseus: one snapshot per ship, /<name>/<~ship>, in set /<name>.
      if (data.snapshots.some(s => s.path === `/${value.name}` || s.set === `/${value.name}`)) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      const created = da(Date.now() + 1000 * data.snapshots.length);
      for (const ship of value.ships) data.snapshots.push({path:`/${value.name}/${ship}`,set:`/${value.name}`,ships:[ship],compatible:true,created});
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
    // A path names one ship's snapshot, or a set: every snapshot in it.
    const inPath = s => s.path === value.path || (!data.snapshots.some(t => t.path === value.path) && s.set === value.path);
    if (kind === 'restore') data.snapshots.filter(inPath).flatMap(s => s.ships).forEach(ship=>{const m=data.moons.find(m=>m.ship===ship);if(m)m.paused=false;else data.moons.push(moon(ship));});
    if (kind === 'delete') data.snapshots=data.snapshots.filter(s=>!inPath(s));
    if (kind === 'profile') {
      // Mirrors mar/theseus/ui: absent keeps, null clears, a string sets.
      // .upload is a moon's new picture; %theseus uploads it inside the moon.
      const p = profiles.get(value.who) || {noltbook: false, name: null, avatar: null};
      if ('upload' in value) {
        const bytes = Buffer.from(String(value.upload), 'base64');
        const moonRow = data.moons.find(m => m.ship === value.who);
        if (value.who === host || !moonRow || moonRow.paused || !p.noltbook || 'avatar' in value || !bytes.length || bytes.length > 51200) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
        uploads.push({who: value.who, bytes: bytes.length, jpeg: bytes[0] === 0xff && bytes[1] === 0xd8});
        p.avatar = {type: 'urbit', url: `0v${uploads.length}`};
      }
      if ('name' in value) p.name = value.name || null;
      if (p.noltbook && 'avatar' in value) p.avatar = value.avatar === null ? null : {type: 'external', url: value.avatar};
      profiles.set(value.who, p);
      pushProfile(value.who);
    }
    if (kind === 'dojo' && /^\|install ~[a-z-]+ %landscape$/.test(value.command)) installed.add(value.who);
    if (kind === 'dojo') dojoLog.push({who: value.who, command: value.command});
    send(channel,{id:action.id,response:'poke',ok:'ok'});
    // %theseus tells the pages, except for Dojo input and profile edits
    if (!['dojo','term','profile'].includes(kind)) pushUi();
    // The moon echoes its prompt with the command, then answers.
    if (kind === 'dojo') send(channel,{id:channel.sub,response:'diff',json:{ship:value.who,blits:[{put:[...`${value.who}:dojo> ${value.command}`]},{nel:true},{put:[...(value.command === '(add 2 2)' ? '4' : `ran ${value.command}`)]},{nel:true}]}});
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
