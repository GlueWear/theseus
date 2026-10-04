// Test-only Eyre simulator. Never imported by the application bundle.
import {createServer} from 'node:http';
const host = '~siglup-narwet';
const first = '~sampel-siglup-narwet';
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
const moon = (ship, desks=[{desk:'base',from:'host'},{desk:'landscape',from:'host'}]) => ({ship,status:'healthy',paused:false,queued:0,identity:true,vanes,desks:desks.map(({desk,from}) => ({desk,stage:'running',reason:null,source:sourceOf(desk,from)}))});
let data;
let gw;
let installed = new Set();
const code = 'lidlut-tabwed-pillex-ridrup';
const reset = () => {data={version:2,host,moons:[moon(first)],caches:['default'],snapshots:[{path:'/baseline',ships:[first],compatible:true,created:'~2026.10.2..12.00.00'}]}; installed=new Set([first]); gw={mode:'auto',port:null,template:null,live:{port:5174,upstream:8083,at:'~2026.10.2..12.00.00'}};}; reset();
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
  if (req.url === '/gateway-down') {gw.live = null; return res.end('ok');}
  if (req.url === '/~/scry/theseus-ui/gateway.json') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(gatewayJson()));}
  const web = /^\/~\/scry\/theseus\/web\/(~[a-z-]+)\.json$/.exec(req.url);
  if (web) {
    if (!data.moons.some(m => m.ship === web[1])) {res.statusCode = 404; return res.end();}
    res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ship: web[1], code, landscape: installed.has(web[1])}));
  }
  if (req.url === '/~/name') return res.end(host);
  if (req.url === '/~/scry/theseus/ui.json') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(data));}
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
    if (kind === 'boot') {
      // Mirrors mar/theseus/ui: every desk names its source, host or publisher.
      if (!Array.isArray(value.desks) || !value.desks.every(d => typeof d?.desk === 'string' && ['host','publisher'].includes(d.from))) {send(channel,{id:action.id,response:'poke',err:'rejected'}); continue;}
      data.moons.push(moon(value.who,value.desks)); if (value.desks.some(d => d.desk === 'landscape')) installed.add(value.who);
    }
    if (kind === 'pause' || kind === 'resume') data.moons.find(m=>m.ship===value.who).paused=kind==='pause';
    if (kind === 'kill') data.moons=data.moons.filter(m=>m.ship!==value.who);
    if (kind === 'snapshot') {data.snapshots.push({path:`/${value.name}`,ships:value.ships,compatible:true,created:'~2026.10.2..12.00.00'});data.moons.forEach(m=>{if(value.ships.includes(m.ship))m.paused=true;});}
    if (kind === 'restore') data.snapshots.find(s=>s.path===value.path).ships.forEach(ship=>{const m=data.moons.find(m=>m.ship===ship);if(m)m.paused=false;else data.moons.push(moon(ship));});
    if (kind === 'delete') data.snapshots=data.snapshots.filter(s=>s.path!==value.path);
    if (kind === 'dojo' && /^\|install ~[a-z-]+ %landscape$/.test(value.command)) installed.add(value.who);
    send(channel,{id:action.id,response:'poke',ok:'ok'});
    if (kind === 'dojo') send(channel,{id:channel.sub,response:'diff',json:{ship:value.who,blits:[{put:[...`> ${value.command}`]},{nel:true},{put:['4']},{nel:true}]}});
  }
  res.statusCode=204;res.end();
}).listen(8085,'127.0.0.1');
