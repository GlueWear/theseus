import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Orbit, LayoutList, Camera, TerminalSquare, Plus, RefreshCw, Pause, Play, Trash2, RotateCcw, X, ArrowUpRight, ArrowLeft, Send, AlertCircle, Check, Search, Download, LoaderCircle, Shuffle, AppWindow, KeyRound, Globe} from 'lucide-react';
import '@urbit/sigil-js';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {fleet, watchDojo, command, moonWeb, gateway, setGateway, reachable} from './api';
import {blitsToAnsi, newMoon, validateMoon, snapshotName, dateLabel, moonOrigin, validPort, validTemplate, gatewayProblem} from './model.mjs';
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
    Object.entries({point: parent, size, foreground:'#195b49', background:'#e9f1ed', detail:'none', space:'none'}).forEach(([name,value]) => icon.setAttribute(name,String(value)));
    ref.current.replaceChildren(icon);
  }, [parent,size]);
  return <span ref={ref} className="sigil" aria-hidden="true" style={{width: size, height: size}}/>;
}
function IconButton({label, children, ...props}) {return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;}
function Badge({moon}) {const label = moon.status !== 'healthy' ? moon.status : moon.paused ? 'paused' : 'running'; return <span className={`badge ${label}`}><i/>{label}</span>;}
function Dialog({title, children, close, busy}) {
  const ref = useRef();
  useEffect(() => {ref.current.showModal();}, []);
  return <dialog ref={ref} onCancel={e => {e.preventDefault(); if (!busy) close();}} aria-labelledby="dialog-title">
    <header><h2 id="dialog-title">{title}</h2><IconButton label="Close dialog" onClick={close} disabled={busy}><X size={18}/></IconButton></header>{children}
  </dialog>;
}
function Dojo({moon, connected, run, busy, close}) {
  const container = useRef();
  const terminal = useRef();
  const commandInput = useRef();
  const [input, setInput] = useState('');
  const history = useRef([]);
  const historyIndex = useRef(0);
  const canType = connected && !moon.paused && moon.status === 'healthy';
  const focusCommand = () => requestAnimationFrame(() => commandInput.current?.focus());
  useEffect(() => {if (canType) focusCommand();}, [canType, moon.ship]);
  useEffect(() => {
    const term = new Terminal({fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, scrollback: 2500, cursorBlink: false, disableStdin: true, theme: {background: '#17211e', foreground: '#dce8e0', cursor: '#97d2b5'}, convertEol: false});
    const fit = new FitAddon(); term.loadAddon(fit); term.open(container.current); terminal.current = term;
    fit.fit(); term.write(buffers.get(moon.ship) || '');
    const onText = (ship, text) => {if (ship === moon.ship) term.write(text);};
    listeners.add(onText);
    const observer = new ResizeObserver(() => {try {fit.fit();} catch { /* closing terminal */ }});
    observer.observe(container.current);
    return () => {listeners.delete(onText); observer.disconnect(); term.dispose();};
  }, [moon.ship]);
  async function submit(e) {
    e.preventDefault(); const value = input.trim(); if (!value) return;
    if (!canType || busy) return;
    if (await run('dojo', {who: moon.ship, command: value})) {
      history.current = [...history.current.slice(-99), value]; historyIndex.current = history.current.length; setInput('');
    }
    focusCommand();
  }
  function exportLog() {
    const lines = [];
    const active = terminal.current?.buffer.active;
    if (active) for (let i = 0; i < active.length; i++) lines.push(active.getLine(i)?.translateToString(true) || '');
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/plain'}));
    const a = document.createElement('a'); a.href = url; a.download = `${moon.ship.slice(1)}-dojo.txt`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="dojo">
    <div className="dojo-title"><div><ShipIcon ship={moon.ship}/><div><h2>{moon.ship}</h2><span className="muted">Dojo</span></div></div><div className="tools"><Badge moon={moon}/><IconButton label="Download transcript" onClick={exportLog}><Download size={17}/></IconButton><IconButton label="Close Dojo" onClick={close}><X size={18}/></IconButton></div></div>
    <div className="terminal" ref={container} data-testid="terminal" onClick={focusCommand}/>
    <form className="command" onSubmit={submit} aria-busy={busy} onClick={() => commandInput.current?.focus()}><span className="command-prompt" aria-hidden="true">&gt;</span><input ref={commandInput} aria-label={`Command for ${moon.ship}`} autoComplete="off" spellCheck="false" value={input} maxLength={8192} disabled={!canType} readOnly={busy} onChange={e => setInput(e.target.value)} onKeyDown={e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {e.preventDefault(); historyIndex.current = Math.max(0, Math.min(history.current.length, historyIndex.current + (e.key === 'ArrowUp' ? -1 : 1))); setInput(history.current[historyIndex.current] || '');}
    }} placeholder={moon.paused ? 'Moon paused' : connected ? busy ? 'Running command...' : 'Command' : 'Dojo disconnected'}/><IconButton label="Send command" type="submit" disabled={!input.trim() || !canType || busy}><Send size={18}/></IconButton></form>
  </section>;
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
    try {await command(kind, value); await refresh(); if (kind !== 'dojo') setNotice(`${({boot: 'Boot', snapshot: 'Snapshot', restore: 'Restore', delete: 'Delete', kill: 'Remove', pause: 'Pause', resume: 'Resume'})[kind]} accepted.`); return true;}
    catch (err) {setError(err.message || 'The host rejected this action. Check its Dojo for the error trace.'); return false;}
    finally {setBusy(false);}
  }
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
    setForm(type === 'boot' ? {ship: newMoon(data.host, data.moons.map(m => m.ship)), cache: data.caches.includes('default') ? 'default' : data.caches[0] || ''} : type === 'snapshot' ? {name: snapshotName()} : {});
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
    let payload;
    if (type === 'boot') {
      const err = validateMoon(form.ship, data.host);
      if (err || data.moons.some(m => m.ship === form.ship)) return setFormError(err || 'This moon already exists.');
      if (!form.cache) return setFormError('No boot cache is available.');
      payload = {who: form.ship, cache: form.cache};
    } else if (type === 'snapshot') {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(form.name)) return setFormError('Use a lowercase name with letters, numbers, and hyphens.');
      if (data.snapshots.some(s => s.path === `/${form.name}`)) return setFormError('A snapshot with this name already exists.');
      payload = {name: form.name, ships: value};
    } else if (type === 'kill') payload = {who: value.ship};
    else payload = {path: value.path};
    if (await run(type, payload)) {setModal(null); if (type === 'kill' && dojo === value.ship) setDojo(null);}
  }
  const moons = data?.moons || [];
  const snapshots = data?.snapshots || [];
  const activeMoon = moons.find(m => m.ship === dojo);
  const canAct = online && !busy;
  const visible = moons.filter(m => m.ship.includes(filter.toLowerCase()));
  const healthySelected = selected.length > 0 && selected.every(s => moons.find(m => m.ship === s)?.status === 'healthy');
  return <div className="shell">
    <aside className="sidebar"><a href="#" className="brand" onClick={e => {e.preventDefault(); setView('moons'); setDojo(null);}}><Orbit size={26}/>Theseus</a><span className="section-label">WORKSPACE</span><nav>
      <button className={view === 'moons' ? 'active' : ''} onClick={() => {setView('moons'); setDojo(null);}}><LayoutList size={18}/>Moons<span>{moons.length}</span></button>
      <button className={view === 'snapshots' ? 'active' : ''} onClick={() => {setView('snapshots'); setDojo(null);}}><Camera size={18}/>Snapshots<span>{snapshots.length}</span></button>
      <button className={view === 'gateway' ? 'active' : ''} onClick={() => {setView('gateway'); setDojo(null);}}><Globe size={18}/>Gateway<span>{gw?.status === 'ok' || gw?.status === 'external' ? 'on' : gw === undefined ? '' : 'off'}</span></button>
    </nav><div className="host"><span className="section-label">HOST SHIP</span><div>{data && <ShipIcon ship={data.host}/>}<strong>{data?.host || 'Not connected'}</strong></div><span className={`connection ${online ? 'live' : ''}`}><i/>{online ? 'Connected' : loading ? 'Connecting' : 'Offline'}</span></div></aside>
    <main><header className="page-header"><div><span className="section-label">THESEUS / {view.toUpperCase()}</span><h1>{activeMoon ? 'Dojo' : view === 'moons' ? 'Moons' : view === 'gateway' ? 'Gateway' : 'Snapshots'}</h1></div><div className="tools"><IconButton label="Refresh fleet" onClick={() => {setError(''); refresh();}} disabled={loading}><RefreshCw size={18}/></IconButton>{view === 'moons' && <button className="primary" disabled={!canAct || !data?.caches.length} onClick={() => open('boot')}><Plus size={17}/>Boot moon</button>}</div></header>
      {error && <div role="alert" className="banner error"><AlertCircle size={18}/><span>{error}</span>{!online && <a href="/~/login?redirect=/apps/theseus">Sign in <ArrowUpRight size={14}/></a>}<IconButton label="Dismiss error" onClick={() => setError('')}><X size={16}/></IconButton></div>}
      {notice && <div role="status" className="banner success"><Check size={17}/><span>{notice}</span><IconButton label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></IconButton></div>}
      {busy && <div className="pending" role="status"><LoaderCircle size={16} className="spin"/>Waiting for host acknowledgement</div>}
      {activeMoon ? <><button className="back" onClick={() => setDojo(null)}><ArrowLeft size={16}/>All moons</button><div className="detail-bar"><Badge moon={activeMoon}/><span>{activeMoon.vanes.length} vanes</span><span>{activeMoon.queued} queued</span><span>Dojo {channel}</span><div className="tools"><button disabled={!canAct} onClick={() => run(activeMoon.paused ? 'resume' : 'pause', {who: activeMoon.ship})}>{activeMoon.paused ? <Play size={16}/> : <Pause size={16}/>} {activeMoon.paused ? 'Resume' : 'Pause'}</button><button disabled={!canAct || activeMoon.status !== 'healthy' || activeMoon.paused} onClick={() => openLandscape(activeMoon)}><AppWindow size={16}/>Landscape</button><button disabled={!canAct || activeMoon.status === 'empty'} onClick={() => showCode(activeMoon)}><KeyRound size={16}/>+code</button><button disabled={!canAct || activeMoon.status !== 'healthy'} onClick={() => open('snapshot', [activeMoon.ship])}><Camera size={16}/>Snapshot</button></div></div><Dojo moon={activeMoon} connected={online && channel === 'connected'} run={run} busy={busy} close={() => setDojo(null)}/></> : view === 'gateway' ? <GatewayPanel key={`${gw?.mode}|${gw?.port}|${gw?.template}`} gw={gw} host={data?.host} canAct={canAct} save={saveGateway}/> : <>
      <div className="overview"><div><span className="metric">{moons.filter(m => m.status === 'healthy' && !m.paused).length}</span><span>Running</span></div><div><span className="metric">{moons.filter(m => m.paused).length}</span><span>Paused</span></div><div><span className="metric">{moons.filter(m => m.status !== 'healthy').length}</span><span>Need attention</span></div><div><span className="metric">{snapshots.length}</span><span>Snapshots</span></div></div>
      {view === 'moons' ? <><div className="list-toolbar"><div className="search"><Search size={16}/><input aria-label="Search moons" placeholder="Search moons" value={filter} onChange={e => setFilter(e.target.value)}/></div><button disabled={!canAct || !healthySelected} onClick={() => open('snapshot', selected)}><Camera size={16}/>Snapshot{selected.length ? ` (${selected.length})` : ''}</button></div><div className="table-wrap"><table><thead><tr><th className="select-cell"><input type="checkbox" aria-label="Select all visible moons" checked={visible.length > 0 && visible.every(m => selected.includes(m.ship))} onChange={e => setSelected(e.target.checked ? visible.map(m => m.ship) : [])}/></th><th>Moon</th><th>Status</th><th>Vanes</th><th>Queue</th><th className="right">Actions</th></tr></thead><tbody>{visible.map(m => <tr key={m.ship}><td><input type="checkbox" aria-label={`Select ${m.ship}`} checked={selected.includes(m.ship)} onChange={e => setSelected(p => e.target.checked ? [...p, m.ship] : p.filter(s => s !== m.ship))}/></td><td><button className="ship-link" onClick={() => setDojo(m.ship)}><ShipIcon ship={m.ship}/><strong>{m.ship}</strong></button></td><td><Badge moon={m}/></td><td>{m.vanes.length} / 9</td><td>{m.queued}</td><td><div className="row-actions"><IconButton label={`Open Dojo for ${m.ship}`} onClick={() => setDojo(m.ship)}><TerminalSquare size={18}/></IconButton><IconButton label={`Open Landscape for ${m.ship}`} disabled={!canAct || m.status !== 'healthy' || m.paused} onClick={() => openLandscape(m)}><AppWindow size={17}/></IconButton><IconButton label={`Show +code for ${m.ship}`} disabled={!canAct || m.status === 'empty'} onClick={() => showCode(m)}><KeyRound size={17}/></IconButton><IconButton label={`${m.paused ? 'Resume' : 'Pause'} ${m.ship}`} disabled={!canAct || m.status !== 'healthy'} onClick={() => run(m.paused ? 'resume' : 'pause', {who: m.ship})}>{m.paused ? <Play size={17}/> : <Pause size={17}/>}</IconButton><IconButton label={`Snapshot ${m.ship}`} disabled={!canAct || m.status !== 'healthy'} onClick={() => open('snapshot', [m.ship])}><Camera size={17}/></IconButton><IconButton label={`Remove ${m.ship}`} disabled={!canAct} onClick={() => open('kill', m)}><Trash2 size={17}/></IconButton></div></td></tr>)}</tbody></table></div>{!visible.length && <div className="empty"><Orbit size={34}/><h2>{loading ? 'Loading fleet' : filter ? 'No matching moons' : 'No moons'}</h2>{!filter && online && <button className="primary" onClick={() => open('boot')} disabled={!data?.caches.length}><Plus size={16}/>Boot moon</button>}</div>}</> : <><div className="list-toolbar"><span className="muted">{snapshots.length} saved snapshots</span><button disabled={!canAct || !healthySelected} onClick={() => open('snapshot', selected)}><Camera size={16}/>New snapshot</button></div><div className="snapshots">{snapshots.map(s => <article className="snapshot-row" key={s.path}><div className="snapshot-icon"><Camera size={21}/></div><div className="snapshot-info"><h2>{s.path}</h2><span className="muted">{dateLabel(s.created)}</span><div className="snapshot-ships">{s.ships.map(ship => <span key={ship}>{ship}</span>)}</div></div><span className={`badge ${s.compatible ? 'healthy' : 'degraded'}`}><i/>{s.compatible ? 'Compatible' : 'Runtime mismatch'}</span><div className="tools"><button disabled={!canAct || !s.compatible} onClick={() => open('restore', s)}><RotateCcw size={16}/>Restore</button><IconButton label={`Delete ${s.path}`} disabled={!canAct} onClick={() => open('delete', s)}><Trash2 size={17}/></IconButton></div></article>)}</div>{!snapshots.length && <div className="empty"><Camera size={34}/><h2>No snapshots</h2></div>}</>}
      </>}
      <footer><span>{online ? data?.host : 'Host unavailable'}</span><span>{data ? `${moons.length} moons / ${snapshots.length} snapshots` : 'Awaiting fleet state'}</span></footer>
    </main>
    {modal && <Dialog title={{boot: 'Boot moon', snapshot: 'Take snapshot', restore: 'Restore snapshot', kill: 'Remove moon', delete: 'Delete snapshot', landscape: 'Install Landscape', code: '+code', gateway: 'Web gateway'}[modal.type]} close={() => setModal(null)} busy={busy}><form onSubmit={confirm}>
      {modal.type === 'boot' && <><label>Moon name<div className="input-group"><input autoFocus aria-label="Moon name" value={form.ship} onChange={e => setForm({...form, ship: e.target.value})}/><IconButton type="button" label="Generate moon name" onClick={() => setForm({...form, ship: newMoon(data.host, moons.map(m => m.ship))})}><Shuffle size={18}/></IconButton></div></label><label>Boot cache<select value={form.cache} onChange={e => setForm({...form, cache: e.target.value})}>{data.caches.map(c => <option key={c}>{c}</option>)}</select></label></>}
      {modal.type === 'snapshot' && <><label>Snapshot name<input autoFocus value={form.name} onChange={e => setForm({name: e.target.value})} maxLength={64}/></label><p>The selected moons will be paused and saved. They stay paused until resumed.</p><ul className="affected">{modal.value.map(s => <li key={s}>{s}</li>)}</ul></>}
      {modal.type === 'restore' && <><p>Restore <strong>{modal.value.path}</strong>? This replaces the current state of every moon below and resumes them. Changes since this snapshot will be lost.</p><ul className="affected">{modal.value.ships.map(s => <li key={s}>{s}</li>)}</ul></>}
      {modal.type === 'kill' && <p>Remove <strong>{modal.value.ship}</strong> and close its transport? Its current state will be deleted. Saved snapshots are kept.</p>}
      {modal.type === 'delete' && <p>Permanently delete <strong>{modal.value.path}</strong>? Running moons will not be changed.</p>}
      {modal.type === 'landscape' && <p><strong>{modal.value.ship}</strong> does not have Landscape. Install it from this host? This runs <code>|install {data.host} %landscape</code> in the moon's Dojo; the download can take several minutes.</p>}
      {modal.type === 'gateway' && <p>{modal.value} Open the Gateway settings to see its status and how to start it.</p>}
      {modal.type === 'code' && <><p>Anyone with this code can log in to <strong>{modal.value.ship}</strong> and control it.</p><code className="secret" data-testid="moon-code">{modal.value.code}</code></>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="dialog-actions"><button type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button className={['kill', 'delete', 'restore'].includes(modal.type) ? 'danger' : 'primary'} type="submit" disabled={!canAct}>{busy ? 'Waiting...' : {boot: 'Boot moon', snapshot: 'Snapshot & pause', restore: 'Restore & resume', kill: 'Remove moon', delete: 'Delete snapshot', landscape: 'Install Landscape', code: 'Copy code', gateway: 'Open Gateway settings'}[modal.type]}</button></div>
    </form></Dialog>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
