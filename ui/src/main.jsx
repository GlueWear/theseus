import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Orbit, LayoutList, Camera, TerminalSquare, Plus, RefreshCw, Pause, Play, Trash2, RotateCcw, X, ArrowUpRight, ArrowLeft, AlertCircle, Check, CircleCheck, CircleAlert, Search, Download, LoaderCircle, Shuffle, AppWindow, KeyRound, Globe} from 'lucide-react';
import '@urbit/sigil-js';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {fleet, hostDesks as fetchHostDesks, watchDojo, command, term as sendTerm, moonWeb, gateway, setGateway, reachable} from './api';
import {blitsToAnsi, keysToBelts, byBoot, deskTally, daMs, newMoon, validateMoon, snapshotName, dateLabel, moonOrigin, validPort, validTemplate, gatewayProblem, resolveDeskSelection, deskPublisher, bootDesks} from './model.mjs';
import icon from './icon.png';
import './style.css';

const buffers = new Map();
const listeners = new Set();
function receive(event) {
  if (!event?.ship || !Array.isArray(event.blits)) return;
  const text = blitsToAnsi(event.blits);
  buffers.set(event.ship, ((buffers.get(event.ship) || '') + text).slice(-200000));
  listeners.forEach(fn => fn(event.ship, text));
}
function ShipIcon({ship, size = 32}) {
  const ref = useRef();
  const parent = ship.split('-').slice(-2).join('-').replace(/^~/, '');
  useEffect(() => {
    const icon = document.createElement('urbit-sigil');
    Object.entries({point: parent, size, foreground:'#364a5a', background:'#f3e8d4', detail:'none', space:'none'}).forEach(([name,value]) => icon.setAttribute(name,String(value)));
    ref.current.replaceChildren(icon);
  }, [parent,size]);
  return <span ref={ref} className="sigil" aria-hidden="true" style={{width: size, height: size}}/>;
}
function IconButton({label, children, ...props}) {return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;}
function Badge({moon}) {
  const recovery = moon.recovery;
  const label = recovery ? recovery.stage === 'failed' ? 'recovery failed' : recovery.stage : moon.status !== 'healthy' ? moon.status : moon.paused ? 'paused' : 'running';
  const tone = recovery ? recovery.stage === 'failed' ? 'degraded' : 'paused' : label;
  return <span className={`badge ${tone}`} title={recovery?.reason || undefined}><i/>{label}</span>;
}
function DeskProgress({desks}) {
  if (!desks?.length) return <span className="muted">Untracked</span>;
  return <div className="desk-progress">{desks.map(row => <span key={row.desk} className={`desk-state ${row.stage}`} title={row.reason || `%${row.desk}: ${row.stage}${row.source ? `, updates from ${row.source.ship}/%${row.source.desk}` : ''}`}><b>%{row.desk}</b><i/>{row.stage}</span>)}</div>;
}
function Dialog({title, children, close, busy}) {
  const ref = useRef();
  useEffect(() => {ref.current.showModal();}, []);
  return <dialog ref={ref} onCancel={e => {e.preventDefault(); if (!busy) close();}} aria-labelledby="dialog-title">
    <header><h2 id="dialog-title">{title}</h2><IconButton label="Close dialog" onClick={close} disabled={busy}><X size={18}/></IconButton></header>{children}
  </dialog>;
}
const TERM_THEME = {background: '#1d2329', foreground: '#ece4d4', cursor: '#e66949', cursorAccent: '#1d2329', selectionBackground: '#e6694966', black: '#1d2329', red: '#e66949', green: '#7fc29b', yellow: '#e9c46a', blue: '#66bcd2', magenta: '#c49bd6', cyan: '#6fd0d6', white: '#ece4d4'};
// A moon's Dojo as a terminal: keys go straight to the moon's Dill, which
// echoes them and draws the prompt and cursor, as a terminal app would.
// Keystrokes are sent in order, and the window size follows the panel.
function TerminalWindow({moon, connected, close, onError}) {
  const container = useRef();
  const terminal = useRef();
  const live = useRef(false);
  const canType = connected && !moon.recovery && !moon.paused && moon.status === 'healthy';
  live.current = canType;
  const send = act => sendTerm(moon.ship, act).catch(err => onError(err.message));
  const sendSize = () => {const t = terminal.current; if (t && live.current) send({size: {cols: t.cols, rows: t.rows}});};
  useEffect(() => {
    const term = new Terminal({fontFamily: '"SF Mono", SFMono-Regular, ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.25, scrollback: 5000, cursorBlink: true, cursorStyle: 'block', theme: TERM_THEME});
    const fit = new FitAddon(); term.loadAddon(fit); term.open(container.current); terminal.current = term;
    try {fit.fit();} catch { /* panel not laid out yet */ }
    term.write(buffers.get(moon.ship) || '');
    const onText = (ship, text) => {if (ship === moon.ship) term.write(text);};
    listeners.add(onText);
    const typed = term.onData(data => {
      if (!live.current) return;
      const belts = keysToBelts(data);
      if (belts.length) send({belts});
    });
    let size = `${term.cols}x${term.rows}`;
    const observer = new ResizeObserver(() => {
      try {fit.fit();} catch {return;}
      const next = `${term.cols}x${term.rows}`;
      if (next !== size) {size = next; sendSize();}
    });
    observer.observe(container.current);
    term.focus();
    return () => {listeners.delete(onText); typed.dispose(); observer.disconnect(); term.dispose(); terminal.current = null;};
  }, [moon.ship]);
  // Whenever typing becomes possible, give Dill the size and have it redraw
  // the prompt, so the cursor sits right after it.
  useEffect(() => {if (canType) {sendSize(); send({hail: null}); terminal.current?.focus();}}, [canType, moon.ship]);
  function exportLog() {
    const lines = [];
    const active = terminal.current?.buffer.active;
    if (active) for (let i = 0; i < active.length; i++) lines.push(active.getLine(i)?.translateToString(true) || '');
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/plain'}));
    const a = document.createElement('a'); a.href = url; a.download = `${moon.ship.slice(1)}-dojo.txt`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="term-window" aria-label={`Dojo for ${moon.ship}`}>
    <div className="term-titlebar">
      <span className="term-lights" aria-hidden="true"><i/><i/><i/></span>
      <span className="term-title">{moon.ship} — dojo</span>
      <div className="tools"><IconButton label="Download transcript" onClick={exportLog}><Download size={15}/></IconButton><IconButton label="Close Dojo" onClick={close}><X size={16}/></IconButton></div>
    </div>
    <div className="terminal" ref={container} data-testid="terminal" onClick={() => terminal.current?.focus()}/>
    {!canType && <div className="term-note" role="status">{moon.recovery ? moon.recovery.stage === 'failed' ? moon.recovery.reason || 'Snapshot recovery failed.' : 'Snapshot recovery is still in progress.' : moon.paused ? 'This moon is paused. Resume it to type.' : moon.status !== 'healthy' ? 'This moon is not running.' : 'Connecting to the host...'}</div>}
  </section>;
}
// What a boot is doing, from the click until the moon's desks run.
function BootStatus({boot, moon, dismiss}) {
  const [, tick] = useState(0);
  const finished = boot.phase === 'ready' || boot.phase === 'failed';
  useEffect(() => {if (finished) return; const timer = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(timer);}, [finished]);
  const seconds = Math.max(0, Math.round(((boot.finished || Date.now()) - boot.started) / 1000));
  const tally = deskTally(moon?.desks);
  const percent = boot.phase === 'booting' ? null : boot.phase === 'ready' || !tally.total ? 100 : Math.round(100 * tally.running / tally.total);
  const title = {booting: `Booting ${boot.ship}`, installing: `Installing desks on ${boot.ship}`, ready: `${boot.ship} is ready`, failed: `${boot.ship} did not finish booting`}[boot.phase];
  const detail = {
    booting: 'Building the moon and starting its vanes. This takes a few seconds.',
    installing: `${tally.running} of ${tally.total} desks running.`,
    ready: `${tally.total ? `All ${tally.total} desks running. ` : ''}Took ${seconds} seconds.`,
    failed: boot.error,
  }[boot.phase];
  return <div className={`boot-status ${boot.phase}`} role="status" aria-live="polite" aria-label="Boot status">
    <div className="boot-status-head">
      {boot.phase === 'ready' ? <CircleCheck size={18}/> : boot.phase === 'failed' ? <CircleAlert size={18}/> : <LoaderCircle size={18} className="spin"/>}
      <strong>{title}</strong>
      {!finished && <span className="muted">{seconds}s</span>}
      {finished && <IconButton label="Dismiss boot status" onClick={dismiss}><X size={15}/></IconButton>}
    </div>
    <div className="progress" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} {...(percent === null ? {} : {'aria-valuenow': percent})}>
      <span className={percent === null ? 'indeterminate' : ''} style={percent === null ? undefined : {width: `${percent}%`}}/>
    </div>
    {detail && <p>{detail}</p>}
  </div>;
}
const gatewayStatus = {ok: 'Running', down: 'Not running', stale: 'Out of date', mismatch: 'Applying change', external: 'Hosting'};
function gatewayHint(gw) {
  const live = gw.live;
  return {
    ok: `Moon apps open at ${gw.url}.`,
    down: 'Nothing is serving moon origins. On this machine, run ops/theseus-gateway install (it then runs at login and restarts on failure), or ops/theseus-gateway run.',
    stale: live && `The gateway forwards to Eyre port ${live.upstream}, but the host is on port ${gw.eyre} now. It re-syncs when the host restarts; if this persists, run ops/theseus-gateway sync.`,
    mismatch: live && `Declared port ${gw.port}, but the gateway still listens on ${live.port}. It switches within a minute.`,
    external: `Moon apps open at ${gw.template}. Your proxy must send each moon hostname to /theseus/~<moon>/<path> on this host's Eyre (port ${gw.eyre}), as ops/Caddyfile.local does locally.`,
  }[gw.status] || '';
}
function GatewayPanel({gw, host, canAct, save}) {
  const [form, setForm] = useState({mode: gw?.mode || 'auto', port: gw?.port ?? '', template: gw?.template || ''});
  const [error, setError] = useState('');
  const [reach, setReach] = useState(null);
  const livePort = gw?.mode !== 'hosting' ? gw?.live?.port : undefined;
  useEffect(() => {
    if (!livePort) {setReach(null); return;}
    let current = true; setReach('checking');
    reachable(`http://localhost:${livePort}`).then(ok => current && setReach(ok ? 'reachable' : 'unreachable'));
    return () => {current = false;};
  }, [livePort]);
  if (gw === undefined) return <div className="empty"><LoaderCircle size={30} className="spin"/><h2>Loading gateway</h2></div>;
  if (gw === null) return <div role="alert" className="banner error"><AlertCircle size={18}/><span>{gatewayProblem(null)}</span></div>;
  async function submit(e) {
    e.preventDefault(); setError('');
    const port = String(form.port).trim(), template = form.template.trim();
    if (form.mode === 'declared' && !validPort(port)) return setError('Enter a port from 1 to 65535.');
    if (port && !validPort(port)) return setError('Enter a port from 1 to 65535, or leave it empty.');
    if (form.mode === 'hosting' && !template) return setError('Enter the address your proxy serves moons at.');
    if (template && !validTemplate(template)) return setError('Use an address like https://{moon}.example.com, with {moon} in the hostname.');
    await save({mode: form.mode, port: port ? Number(port) : null, template: template || null});
  }
  const choice = (mode, title, text) => <label className="choice"><input type="radio" name="gateway-mode" value={mode} checked={form.mode === mode} onChange={() => setForm({...form, mode})}/><span><strong>{title}</strong><span className="muted">{text}</span></span></label>;
  const ok = gw.status === 'ok' || gw.status === 'external';
  return <section className="gateway">
    <div className="gateway-status">
      <div className="gateway-head"><span className={`badge ${ok ? 'healthy' : gw.status === 'down' ? 'degraded' : 'paused'}`}><i/>{gatewayStatus[gw.status] || gw.status}</span><span className="muted">{{auto: 'Automatic', declared: 'Declared port', hosting: 'Hosting'}[gw.mode]}</span></div>
      <dl className="kv">
        <dt>Moon address</dt><dd>{gw.url ? <code>{gw.url}</code> : 'None'}</dd>
        {gw.mode !== 'hosting' && <><dt>Gateway</dt><dd>{gw.live ? `Listening on port ${gw.live.port} since ${dateLabel(gw.live.at)}` : 'No gateway has reported in'}</dd>
        <dt>Forwards to</dt><dd>{gw.live ? `${host} Eyre on port ${gw.live.upstream}${gw.live.upstream === gw.eyre ? ' (current)' : ''}` : 'Nothing'}</dd></>}
        <dt>Host Eyre</dt><dd>Port {gw.eyre}</dd>
        {reach && <><dt>This browser</dt><dd>{{checking: 'Checking...', reachable: 'Can reach the gateway', unreachable: 'Cannot reach the gateway'}[reach]}</dd></>}
      </dl>
      <p className="hint">{gatewayHint(gw)}</p>
    </div>
    <form className="gateway-form" onSubmit={submit}>
      <fieldset><legend>Mode</legend>
        {choice('auto', 'Automatic', 'The gateway takes the first free port from 8084.')}
        {choice('declared', 'Declared port', 'The gateway listens on exactly this port, or refuses to start.')}
        {form.mode === 'declared' && <label className="sub">Port<input inputMode="numeric" aria-label="Gateway port" value={form.port} onChange={e => setForm({...form, port: e.target.value})} placeholder="8084"/></label>}
        {choice('hosting', 'Hosting', 'Your own proxy serves moons at a public address.')}
        {form.mode === 'hosting' && <label className="sub">Moon address<input aria-label="Moon address" value={form.template} onChange={e => setForm({...form, template: e.target.value})} placeholder="https://{moon}.example.com" spellCheck="false"/></label>}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="primary" type="submit" disabled={!canAct}>Save settings</button></div>
      <p className="hint">A running gateway applies changes within a minute. Moon tabs always open through the gateway, whichever port this console was opened on.</p>
    </form>
  </section>;
}
function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('moons');
  const [selected, setSelected] = useState([]);
  const [dojo, setDojo] = useState(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(false);
  const [channel, setChannel] = useState('connecting');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [gw, setGw] = useState(undefined);
  const [deskCatalog, setDeskCatalog] = useState(null);
  const [deskLoading, setDeskLoading] = useState(false);
  const [boot, setBoot] = useState(null);
  const refreshing = useRef(false);
  const mounted = useRef(true);
  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await fleet(); if (!mounted.current) return;
      setData(next); setOnline(true);
      gateway().then(g => mounted.current && setGw(g)).catch(() => mounted.current && setGw(null));
      setSelected(prev => prev.filter(s => next.moons.some(m => m.ship === s)));
      await watchDojo(receive, status => mounted.current && setChannel(status));
    } catch (err) {if (mounted.current) {setError(err.message); setOnline(false);}}
    finally {refreshing.current = false; if (mounted.current) setLoading(false);}
  }
  useEffect(() => {mounted.current = true; refresh(); const timer = setInterval(refresh, 4000); return () => {mounted.current = false; clearInterval(timer);};}, []);
  async function run(kind, value) {
    if (busy || !online) return false;
    setBusy(true); setError(''); setNotice('');
    try {await command(kind, value); await refresh(); if (kind !== 'dojo') setNotice(`${({snapshot: 'Snapshot', restore: 'Restore', delete: 'Delete', kill: 'Remove', pause: 'Pause', resume: 'Resume'})[kind]} accepted.`); return true;}
    catch (err) {setError(err.message || 'The host rejected this action. Check its Dojo for the error trace.'); return false;}
    finally {setBusy(false);}
  }
  // Booting runs on the host for a few seconds before it acknowledges, then
  // the moon's desks install; the status bar follows both.
  async function bootMoon(payload) {
    if (busy || !online) return;
    setModal(null); setBusy(true); setError(''); setNotice('');
    setBoot({ship: payload.who, phase: 'booting', started: Date.now()});
    const update = change => setBoot(b => b?.ship === payload.who ? {...b, ...change} : b);
    try {await command('boot', payload); await refresh(); update({phase: 'installing'});}
    catch (err) {update({phase: 'failed', finished: Date.now(), error: err.message || 'The host rejected the boot. Check its Dojo for the error trace.'});}
    finally {setBusy(false);}
  }
  const bootRow = boot && data?.moons.find(m => m.ship === boot.ship);
  useEffect(() => {
    if (boot?.phase !== 'installing' || !bootRow) return;
    const tally = deskTally(bootRow.desks);
    if (!tally.done) return;
    setBoot(b => ({...b, finished: Date.now(), phase: tally.failed.length ? 'failed' : 'ready',
      error: tally.failed.map(d => `%${d.desk}: ${d.reason || 'failed'}`).join(' ') || undefined}));
  }, [boot?.phase, bootRow]);
  useEffect(() => {if (boot?.phase !== 'ready') return; const timer = setTimeout(() => setBoot(null), 12000); return () => clearTimeout(timer);}, [boot?.phase]);
  async function saveGateway(settings) {
    if (busy || !online) return false;
    setBusy(true); setError(''); setNotice('');
    try {await setGateway(settings); setGw(await gateway()); setNotice('Gateway settings saved.'); return true;}
    catch (err) {setError(err.message); return false;}
    finally {setBusy(false);}
  }
  async function openLandscape(moon) {
    if (busy || !online) return;
    // Moon apps need their own origin, which only the web gateway provides.
    const problem = gatewayProblem(gw);
    if (problem) {setFormError(''); setModal({type: 'gateway', value: problem}); return;}
    const origin = moonOrigin(gw.url, moon.ship);
    // Open the tab inside the click so pop-up blockers allow it.
    const tab = window.open('', '_blank');
    if (!tab) return setError('The browser blocked the new tab. Allow pop-ups for this page and try again.');
    tab.opener = null;
    tab.document.title = `${moon.ship} Landscape`;
    tab.document.body.textContent = `Opening Landscape on ${moon.ship}...`;
    setBusy(true); setError(''); setNotice('');
    try {
      const info = await moonWeb(moon.ship);
      if (!info.landscape) {tab.close(); setFormError(''); setModal({type: 'landscape', value: moon}); return;}
      if (!info.code) throw new Error(`Could not read the +code of ${moon.ship}.`);
      // Log in with a posted form so the code never appears in a URL.
      const doc = tab.document, form = doc.createElement('form');
      form.method = 'POST'; form.action = `${origin}/~/login`;
      Object.entries({password: info.code, redirect: '/apps/landscape/'}).forEach(([name, value]) => {
        const input = doc.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
      });
      doc.body.append(form); form.submit();
    } catch (err) {tab.close(); setError(err.message || 'Could not open Landscape.');}
    finally {setBusy(false);}
  }
  async function showCode(moon) {
    if (busy || !online) return;
    setBusy(true); setError('');
    try {
      const info = await moonWeb(moon.ship);
      if (!info.code) throw new Error(`Could not read the +code of ${moon.ship}.`);
      setFormError(''); setModal({type: 'code', value: {ship: moon.ship, code: info.code}});
    } catch (err) {setError(err.message);}
    finally {setBusy(false);}
  }
  function open(type, value) {
    setFormError(''); setModal({type, value});
    setForm(type === 'boot' ? {ship: newMoon(data.host, data.moons.map(m => m.ship)), desks: [], from: {}}
      : type === 'snapshot' || type === 'moon-snapshots' ? {name: snapshotName(), resume: true} : {});
    if (type === 'boot') {
      setDeskCatalog(null); setDeskLoading(true);
      fetchHostDesks().then(result => {if (mounted.current) setDeskCatalog(result.desks);}).catch(err => {if (mounted.current) setFormError(err.message);}).finally(() => {if (mounted.current) setDeskLoading(false);});
    }
  }
  async function confirm(e) {
    e.preventDefault(); const {type, value} = modal;
    if (type === 'code') {
      try {await navigator.clipboard.writeText(value.code); setModal(null); setNotice(`Copied the +code of ${value.ship}.`);}
      catch {setFormError('Copy failed. Select the code and copy it manually.');}
      return;
    }
    if (type === 'gateway') {setModal(null); setDojo(null); setView('gateway'); return;}
    if (type === 'landscape') {
      if (await run('dojo', {who: value.ship, command: `|install ${data.host} %landscape`})) {setModal(null); setDojo(value.ship);}
      return;
    }
    if (type === 'boot') {
      const err = validateMoon(form.ship, data.host);
      if (err || data.moons.some(m => m.ship === form.ship)) return setFormError(err || 'This moon already exists.');
      if (!deskCatalog) return setFormError('Host desks are not available yet.');
      return bootMoon({who: form.ship, desks: bootDesks(deskCatalog, resolveDeskSelection(deskCatalog, form.desks).desks, form.from, data.host)});
    }
    let kind = type, payload;
    if (type === 'snapshot' || type === 'moon-snapshots') {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(form.name)) return setFormError('Use a lowercase name with letters, numbers, and hyphens.');
      if (data.snapshots.some(s => s.path === `/${form.name}`)) return setFormError('A snapshot with this name already exists.');
      kind = 'snapshot';
      payload = {name: form.name, ships: type === 'snapshot' ? value : [value.ship], resume: !!form.resume};
    } else if (type === 'kill') payload = {who: value.ship};
    else payload = {path: value.path};
    if (!(await run(kind, payload))) return;
    // The moon's snapshot tool stays open, so the new snapshot shows up in
    // its list, ready to restore.
    if (type === 'moon-snapshots') {setNotice(`Saved snapshot ${form.name}.`); setForm(f => ({...f, name: snapshotName()})); return;}
    setModal(null); if (type === 'kill' && dojo === value.ship) setDojo(null);
  }
  const moons = data?.moons || [];
  const snapshots = [...(data?.snapshots || [])].sort((a, b) => (daMs(b.created) || 0) - (daMs(a.created) || 0));
  const activeMoon = moons.find(m => m.ship === dojo);
  const canAct = online && !busy;
  const visible = byBoot(moons).filter(m => m.ship.includes(filter.toLowerCase()));
  const healthySelected = selected.length > 0 && selected.every(s => {const m=moons.find(m => m.ship === s); return m?.status === 'healthy' && !m.recovery;});
  const resolvedDesks = modal?.type === 'boot' && deskCatalog ? resolveDeskSelection(deskCatalog, form.desks) : {desks:['base'],reasons:new Map()};
  const toggleDesk = (name, checked) => setForm(current => ({...current, desks: checked ? [...new Set([...(current.desks || []), name])] : (current.desks || []).filter(d => d !== name)}));
  const moonSnaps = modal?.type === 'moon-snapshots' ? snapshots.filter(s => s.ships.includes(modal.value.ship)) : [];
  const booting = boot?.phase === 'booting' && !moons.some(m => m.ship === boot.ship);
  const moonActions = m => <div className="moon-actions">
    <IconButton label={`Open Dojo for ${m.ship}`} onClick={() => setDojo(m.ship)}><TerminalSquare size={16}/></IconButton>
    <IconButton label={`Open Landscape for ${m.ship}`} disabled={!canAct || !!m.recovery || m.status !== 'healthy' || m.paused} onClick={() => openLandscape(m)}><AppWindow size={16}/></IconButton>
    <IconButton label={`Show +code for ${m.ship}`} disabled={!canAct || !!m.recovery || m.status === 'empty'} onClick={() => showCode(m)}><KeyRound size={16}/></IconButton>
    <IconButton label={`${m.paused ? 'Resume' : 'Pause'} ${m.ship}`} disabled={!canAct || !!m.recovery || m.status !== 'healthy'} onClick={() => run(m.paused ? 'resume' : 'pause', {who: m.ship})}>{m.paused ? <Play size={16}/> : <Pause size={16}/>}</IconButton>
    <IconButton label={`Snapshots of ${m.ship}`} disabled={!canAct || !!m.recovery || m.status === 'empty'} onClick={() => open('moon-snapshots', m)}><Camera size={16}/></IconButton>
    <IconButton label={`Remove ${m.ship}`} disabled={!canAct} onClick={() => open('kill', m)}><Trash2 size={16}/></IconButton>
  </div>;
  const snapshotFields = (who, many) => <>
    <label>Snapshot name<input autoFocus value={form.name} onChange={e => setForm({...form, name: e.target.value})} maxLength={64}/></label>
    <label className="check"><input type="checkbox" checked={!!form.resume} onChange={e => setForm({...form, resume: e.target.checked})}/>Keep {many ? 'these moons' : who} running after saving</label>
    <p className="hint">A snapshot pauses {many ? 'the moons' : 'the moon'} while it is taken.{form.resume ? '' : ' They stay paused until you resume them.'}</p>
  </>;
  return <div className="shell">
    <aside className="sidebar"><a href="#" className="brand" onClick={e => {e.preventDefault(); setView('moons'); setDojo(null);}}><img src={icon} alt="" className="brand-icon"/>Theseus</a><span className="section-label">WORKSPACE</span><nav>
      <button className={view === 'moons' ? 'active' : ''} onClick={() => {setView('moons'); setDojo(null);}}><LayoutList size={18}/>Moons<span>{moons.length}</span></button>
      <button className={view === 'snapshots' ? 'active' : ''} onClick={() => {setView('snapshots'); setDojo(null);}}><Camera size={18}/>Snapshots<span>{snapshots.length}</span></button>
      <button className={view === 'gateway' ? 'active' : ''} onClick={() => {setView('gateway'); setDojo(null);}}><Globe size={18}/>Gateway<span>{gw?.status === 'ok' || gw?.status === 'external' ? 'on' : gw === undefined ? '' : 'off'}</span></button>
    </nav><div className="host"><span className="section-label">HOST SHIP</span><div>{data && <ShipIcon ship={data.host}/>}<strong>{data?.host || 'Not connected'}</strong></div><span className={`connection ${online ? 'live' : ''}`}><i/>{online ? 'Connected' : loading ? 'Connecting' : 'Offline'}</span></div></aside>
    <main><header className="page-header"><div><span className="section-label">THESEUS / {view.toUpperCase()}</span><h1>{activeMoon ? 'Dojo' : view === 'moons' ? 'Moons' : view === 'gateway' ? 'Gateway' : 'Snapshots'}</h1></div><div className="tools"><IconButton label="Refresh fleet" onClick={() => {setError(''); refresh();}} disabled={loading}><RefreshCw size={18}/></IconButton>{view === 'moons' && <button className="primary" disabled={!canAct} onClick={() => open('boot')}><Plus size={17}/>Boot moon</button>}</div></header>
      {boot && <BootStatus boot={boot} moon={bootRow} dismiss={() => setBoot(null)}/>}
      {error && <div role="alert" className="banner error"><AlertCircle size={18}/><span>{error}</span>{!online && <a href="/~/login?redirect=/apps/theseus">Sign in <ArrowUpRight size={14}/></a>}<IconButton label="Dismiss error" onClick={() => setError('')}><X size={16}/></IconButton></div>}
      {notice && <div role="status" className="banner success"><Check size={17}/><span>{notice}</span><IconButton label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></IconButton></div>}
      {busy && boot?.phase !== 'booting' && <div className="pending" role="status"><LoaderCircle size={16} className="spin"/>Waiting for host acknowledgement</div>}
      {activeMoon ? <>
        <button className="back" onClick={() => setDojo(null)}><ArrowLeft size={16}/>All moons</button>
        <div className="detail-bar"><Badge moon={activeMoon}/><span>{activeMoon.vanes.length} vanes</span><span>{activeMoon.queued} queued</span><span>Dojo {channel}</span><div className="tools">
          <button disabled={!canAct || !!activeMoon.recovery} onClick={() => run(activeMoon.paused ? 'resume' : 'pause', {who: activeMoon.ship})}>{activeMoon.paused ? <Play size={16}/> : <Pause size={16}/>} {activeMoon.paused ? 'Resume' : 'Pause'}</button>
          <button disabled={!canAct || !!activeMoon.recovery || activeMoon.status !== 'healthy' || activeMoon.paused} onClick={() => openLandscape(activeMoon)}><AppWindow size={16}/>Landscape</button>
          <button disabled={!canAct || !!activeMoon.recovery || activeMoon.status === 'empty'} onClick={() => showCode(activeMoon)}><KeyRound size={16}/>+code</button>
          <button disabled={!canAct || !!activeMoon.recovery || activeMoon.status === 'empty'} onClick={() => open('moon-snapshots', activeMoon)}><Camera size={16}/>Snapshots</button>
        </div></div>
        {activeMoon.recovery && <div className={`banner ${activeMoon.recovery.stage === 'failed' ? 'error' : 'success'}`} role="status"><AlertCircle size={18}/><span>{activeMoon.recovery.stage === 'failed' ? activeMoon.recovery.reason || 'Snapshot recovery failed. The moon remains paused and its transport is closed.' : activeMoon.recovery.stage === 'registering' ? 'Registering the restored moon\'s new keys and network era with the host.' : 'Restarting the restored moon and checking local health.'}</span></div>}
        <TerminalWindow moon={activeMoon} connected={online && channel === 'connected'} close={() => setDojo(null)} onError={setError}/>
      </> : view === 'gateway' ? <GatewayPanel key={`${gw?.mode}|${gw?.port}|${gw?.template}`} gw={gw} host={data?.host} canAct={canAct} save={saveGateway}/> : <>
      <div className="overview"><div><span className="metric">{moons.filter(m => m.status === 'healthy' && !m.paused && !m.recovery).length}</span><span>Running</span></div><div><span className="metric">{moons.filter(m => m.paused && !m.recovery).length}</span><span>Paused</span></div><div><span className="metric">{moons.filter(m => m.status !== 'healthy' || m.recovery).length}</span><span>Need attention</span></div><div><span className="metric">{snapshots.length}</span><span>Snapshots</span></div></div>
      {view === 'moons' ? <>
        <div className="list-toolbar"><div className="search"><Search size={16}/><input aria-label="Search moons" placeholder="Search moons" value={filter} onChange={e => setFilter(e.target.value)}/></div><button disabled={!canAct || !healthySelected} onClick={() => open('snapshot', selected)}><Camera size={16}/>Snapshot{selected.length ? ` (${selected.length})` : ''}</button></div>
        <div className="table-wrap"><table>
          <thead><tr><th className="select-cell"><input type="checkbox" aria-label="Select all visible moons" checked={visible.length > 0 && visible.every(m => selected.includes(m.ship))} onChange={e => setSelected(e.target.checked ? visible.map(m => m.ship) : [])}/></th><th>Moon</th><th>Status</th><th className="desk-column">Desks</th><th>Vanes</th><th>Queue</th></tr></thead>
          <tbody>
            {visible.map(m => <tr key={m.ship}>
              <td className="select-cell"><input type="checkbox" aria-label={`Select ${m.ship}`} checked={selected.includes(m.ship)} onChange={e => setSelected(p => e.target.checked ? [...p, m.ship] : p.filter(s => s !== m.ship))}/></td>
              <td className="moon-cell"><button className="ship-link" onClick={() => setDojo(m.ship)} title={m.booted ? `Booted ${new Date(m.booted).toLocaleString()}` : undefined}><ShipIcon ship={m.ship}/><strong>{m.ship}</strong></button>{moonActions(m)}<div className="mobile-desks"><DeskProgress desks={m.desks}/></div></td>
              <td><Badge moon={m}/></td><td className="desk-column"><DeskProgress desks={m.desks}/></td><td>{m.vanes.length} / 9</td><td>{m.queued}</td>
            </tr>)}
            {booting && <tr className="booting-row"><td className="select-cell"/><td className="moon-cell" colSpan={5}><span className="ship-link"><LoaderCircle size={20} className="spin"/><strong>{boot.ship}</strong></span><span className="muted">Booting...</span></td></tr>}
          </tbody>
        </table></div>
        {!visible.length && !booting && <div className="empty"><Orbit size={34}/><h2>{loading ? 'Loading fleet' : filter ? 'No matching moons' : 'No moons'}</h2>{!filter && online && <button className="primary" onClick={() => open('boot')}><Plus size={16}/>Boot moon</button>}</div>}
      </> : <>
        <div className="list-toolbar"><span className="muted">{snapshots.length} saved snapshots</span><button disabled={!canAct || !healthySelected} onClick={() => open('snapshot', selected)}><Camera size={16}/>New snapshot</button></div>
        <div className="snapshots">{snapshots.map(s => <article className="snapshot-row" key={s.path}><div className="snapshot-icon"><Camera size={21}/></div><div className="snapshot-info"><h2>{s.path}</h2><span className="muted">{dateLabel(s.created)}</span><div className="snapshot-ships">{s.ships.map(ship => <span key={ship}>{ship}</span>)}</div></div><span className={`badge ${s.compatible ? 'healthy' : 'degraded'}`}><i/>{s.compatible ? 'Compatible' : 'Runtime mismatch'}</span><div className="tools"><button disabled={!canAct || !s.compatible} onClick={() => open('restore', s)}><RotateCcw size={16}/>Restore</button><IconButton label={`Delete ${s.path}`} disabled={!canAct} onClick={() => open('delete', s)}><Trash2 size={17}/></IconButton></div></article>)}</div>
        {!snapshots.length && <div className="empty"><Camera size={34}/><h2>No snapshots</h2></div>}
      </>}
      </>}
      <footer><span>{online ? data?.host : 'Host unavailable'}</span><span>{data ? `${moons.length} moons / ${snapshots.length} snapshots` : 'Awaiting fleet state'}</span></footer>
    </main>
    {modal && <Dialog title={{boot: 'Boot moon', snapshot: 'Take snapshot', 'moon-snapshots': `Snapshots of ${modal.value?.ship}`, restore: 'Restore snapshot', kill: 'Remove moon', delete: 'Delete snapshot', landscape: 'Install Landscape', code: '+code', gateway: 'Web gateway'}[modal.type]} close={() => setModal(null)} busy={busy}><form onSubmit={confirm}>
      {modal.type === 'boot' && <><label>Moon name<div className="input-group"><input autoFocus aria-label="Moon name" value={form.ship} onChange={e => setForm({...form, ship: e.target.value})}/><IconButton type="button" label="Generate moon name" onClick={() => setForm({...form, ship: newMoon(data.host, moons.map(m => m.ship))})}><Shuffle size={18}/></IconButton></div></label><fieldset className="desk-picker"><legend>Desks</legend>{deskLoading && <div className="pending"><LoaderCircle size={15} className="spin"/>Loading host desks</div>}{deskCatalog?.map(row => {const auto=resolvedDesks.reasons.has(row.desk), checked=resolvedDesks.desks.includes(row.desk), pub=deskPublisher(row, data.host); return <div className="desk-choice" key={row.desk}><label><input type="checkbox" aria-label={`Include %${row.desk}`} checked={checked} disabled={row.desk === 'base' || auto} onChange={e => toggleDesk(row.desk,e.target.checked)}/><span><strong>%{row.desk}{row.title ? ` · ${row.title}` : ''}</strong><small>{row.running ? 'running' : 'suspended'}{row.source ? ` · ${row.source.ship}/%${row.source.desk}` : ' · local'}</small></span></label>{checked && pub && <select aria-label={`Updates for %${row.desk}`} value={form.from?.[row.desk] || 'host'} onChange={e => setForm(current => ({...current, from: {...(current.from || {}), [row.desk]: e.target.value}}))}><option value="host">Updates from {data.host}</option><option value="publisher">Updates from {pub.ship}</option></select>}</div>;})}</fieldset>{[...resolvedDesks.reasons].map(([dependency,owner]) => <p className="dependency-note" key={dependency}>Added <strong>%{dependency}</strong> because <strong>%{owner}</strong> has a Landscape tile.</p>)}</>}
      {modal.type === 'snapshot' && <>{snapshotFields(null, true)}<ul className="affected">{modal.value.map(s => <li key={s}>{s}</li>)}</ul></>}
      {modal.type === 'moon-snapshots' && <>
        {snapshotFields(modal.value.ship, false)}
        <h3 className="dialog-section">Saved snapshots</h3>
        {moonSnaps.length ? <ul className="snap-list">{moonSnaps.map(s => <li key={s.path}>
          <div className="snap-info"><strong>{s.path.slice(1)}</strong><span className="muted">{dateLabel(s.created)}{s.ships.length > 1 ? ` · with ${s.ships.filter(x => x !== modal.value.ship).join(', ')}` : ''}</span></div>
          {!s.compatible && <span className="badge degraded"><i/>Runtime mismatch</span>}
          <button type="button" disabled={!canAct || !s.compatible} onClick={() => open('restore', s)}><RotateCcw size={15}/>Restore</button>
          <IconButton type="button" label={`Delete ${s.path}`} disabled={!canAct} onClick={() => open('delete', s)}><Trash2 size={16}/></IconButton>
        </li>)}</ul> : <p className="muted">No snapshots of {modal.value.ship} yet. Take one above to have a point to return to.</p>}
      </>}
      {modal.type === 'restore' && <><p>Restore <strong>{modal.value.path}</strong>? This replaces the current state of every moon below. Changes since this snapshot will be lost.</p><ul className="affected">{modal.value.ships.map(s => <li key={s}>{s}</li>)}</ul><p className="restore-note">Theseus closes each moon's transport, registers a new network era, resets its local continuity, then resumes it only after the host confirms the new keys. Other ships drop their old connections, apps reconnect, and messages still in flight are lost.</p></>}
      {modal.type === 'kill' && <p>Remove <strong>{modal.value.ship}</strong> and close its transport? Its current state will be deleted. Saved snapshots are kept.</p>}
      {modal.type === 'delete' && <p>Permanently delete <strong>{modal.value.path}</strong>? Running moons will not be changed.</p>}
      {modal.type === 'landscape' && <p><strong>{modal.value.ship}</strong> does not have Landscape. Install it from this host? This runs <code>|install {data.host} %landscape</code> in the moon's Dojo; the download can take several minutes.</p>}
      {modal.type === 'gateway' && <p>{modal.value} Open the Gateway settings to see its status and how to start it.</p>}
      {modal.type === 'code' && <><p>Anyone with this code can log in to <strong>{modal.value.ship}</strong> and control it.</p><code className="secret" data-testid="moon-code">{modal.value.code}</code></>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="dialog-actions"><button type="button" onClick={() => setModal(null)} disabled={busy}>{modal.type === 'moon-snapshots' ? 'Close' : 'Cancel'}</button><button className={['kill', 'delete', 'restore'].includes(modal.type) ? 'danger' : 'primary'} type="submit" disabled={!canAct || (modal.type === 'boot' && (!deskCatalog || deskLoading))}>{busy ? 'Waiting...' : {boot: 'Boot moon', snapshot: 'Take snapshot', 'moon-snapshots': 'Take snapshot', restore: 'Restore & resume', kill: 'Remove moon', delete: 'Delete snapshot', landscape: 'Install Landscape', code: 'Copy code', gateway: 'Open Gateway settings'}[modal.type]}</button></div>
    </form></Dialog>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
