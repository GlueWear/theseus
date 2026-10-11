import Urbit from '@urbit/http-api';
import { validateFleet, validateHostDesks, validateProfiles } from './model.mjs';
export const api = new Urbit('');
let started = false;
// http-api 3.0.0 registers an unbound `this.delete` on beforeunload, which
// throws before reaching Eyre. Delete the channel explicitly so closed tabs do
// not leave a channel accumulating /blit facts until Eyre reaps it.
window.addEventListener('pagehide', () => {if (api.lastEventId > 0) api.delete();});
window.addEventListener('pageshow', e => {if (e.persisted) location.reload();});
// A timed-out read means the host is busy with a long event (a boot, a
// snapshot, a restore). It is marked .busy so the console keeps going and
// retries instead of calling itself offline.
export const HOST_BUSY = 'The host is busy and did not answer within 15 seconds. Retrying...';
export async function fleet() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let res;
    try {res = await fetch('/~/scry/theseus/ui.json', {credentials: 'same-origin', signal: controller.signal, cache: 'no-store'});}
    catch (err) {if (controller.signal.aborted) throw Object.assign(new Error(HOST_BUSY), {busy: true}); throw err;}
    if (res.status === 403 || res.status === 401 || res.redirected) throw new Error('Sign in to your host ship to connect.');
    if (!res.ok) throw new Error(`Theseus API returned HTTP ${res.status}. The updated desk may not be installed.`);
    const data = validateFleet(await res.json());
    api.ship = data.host.slice(1);
    return data;
  } finally { clearTimeout(timer); }
}
export async function hostDesks() {
  const res = await fetch('/~/scry/theseus/desks.json', {credentials: 'same-origin', cache: 'no-store'});
  if (!res.ok) throw new Error(`Could not read host desks (HTTP ${res.status}).`);
  return validateHostDesks(await res.json());
}
// Every ship's name and picture: its own Noltbook profile, or a nickname kept
// by Theseus. Read only when asked (load, refresh, after a change).
export async function profiles() {
  const res = await fetch('/~/scry/theseus/profiles.json', {credentials: 'same-origin', cache: 'no-store'});
  if (!res.ok) throw new Error(`Could not read names and pictures (HTTP ${res.status}).`);
  return validateProfiles(await res.json());
}
// The host's own picture, sent as Noltbook's own page sends it: the picture
// as the body of an upload, then the profile pointed at it. The version in
// the profile changes the picture's address, so viewers fetch the new one.
const UPLOAD_REFUSED = {400: 'Noltbook did not take this file as a picture.', 413: 'This picture is too large for Noltbook.', 503: "The host's Noltbook has no %noltbook-data desk to keep pictures in."};
export async function uploadHostPicture(base64) {
  const body = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const res = await fetch('/apps/noltbook/upload-avatar', {method: 'POST', body, credentials: 'same-origin'});
  if (!res.ok) throw new Error(UPLOAD_REFUSED[res.status] || `Noltbook did not take the picture (HTTP ${res.status}).`);
  return poke('noltbook', 'noltbook-api', {action: 'update-profile', data: {avatar: {type: 'urbit', url: Date.now().toString(36)}}}, 'Noltbook kept the picture but did not set it on the profile.');
}
// Host-only: the moon's login code and whether %landscape is installed.
export async function moonWeb(who) {
  const res = await fetch(`/~/scry/theseus/web/${who}.json`, {credentials: 'same-origin', cache: 'no-store'});
  if (!res.ok) throw new Error(`Could not read ${who} (HTTP ${res.status}).`);
  const data = await res.json();
  if (data?.ship !== who || typeof data.landscape !== 'boolean' || (data.code !== null && !/^[a-z]+(-[a-z]+)*$/.test(data.code))) throw new Error('Theseus returned an unexpected moon record.');
  return data;
}
// Web gateway settings and status (%theseus-ui). Null when the host's
// theseus desk predates the gateway.
export async function gateway() {
  const res = await fetch('/~/scry/theseus-ui/gateway.json', {credentials: 'same-origin', cache: 'no-store'});
  if (!res.ok) return null;
  const data = await res.json();
  return ['auto', 'declared', 'hosting'].includes(data?.mode) ? data : null;
}
export function setGateway(settings) {
  return poke('theseus-ui', 'theseus-gateway', {set: settings}, 'The host rejected these gateway settings.');
}
// Reachable from this browser? no-cors resolves on any HTTP response and
// rejects only when nothing answers.
export async function reachable(origin) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {await fetch(`${origin}/~/host`, {mode: 'no-cors', cache: 'no-store', signal: controller.signal}); return true;}
  catch {return false;}
  finally {clearTimeout(timer);}
}
export async function watchDojo(event, status) {
  if (started) return;
  started = true;
  api.onOpen = () => status('connected');
  api.onRetry = () => status('reconnecting');
  // A fatal SSE error leaves subscriptions registered on a dead channel.
  // Start a fresh channel; the next fleet refresh resubscribes.
  api.onError = () => {started = false; profilesStarted = false; uiStarted = false; status('disconnected'); api.reset();};
  try {
    return await api.subscribe({app: 'theseus-pyre', path: '/blit', event,
      err: () => {started = false; status('disconnected');},
      quit: () => {started = false; status('disconnected');}});
  } catch (e) {started = false; status('disconnected'); throw e;}
}
// "The moons, fleets or snapshots changed", pushed by %theseus after an
// action, and during boots, installs and restores. The console reads ui.json
// again when told, instead of on a timer.
let uiStarted = false;
export async function watchUi(event) {
  if (uiStarted) return;
  uiStarted = true;
  try {
    return await api.subscribe({app: 'theseus', path: '/ui', event: () => event(),
      err: () => {uiStarted = false;},
      quit: () => {uiStarted = false;}});
  } catch (e) {uiStarted = false; throw e;}
}
// Names and pictures as they change, pushed by %theseus: one ship's profile
// row per fact, whenever its Noltbook profile changes, from anywhere. No
// polling. Resubscribed with the Dojo after the channel is reset.
let profilesStarted = false;
export async function watchProfiles(event) {
  if (profilesStarted) return;
  profilesStarted = true;
  const one = row => {try {validateProfiles({host: row, moons: []}); event(row);} catch { /* not a profile row */ }};
  try {
    return await api.subscribe({app: 'theseus', path: '/profiles', event: one,
      err: () => {profilesStarted = false;},
      quit: () => {profilesStarted = false;}});
  } catch (e) {profilesStarted = false; throw e;}
}
// Resolves only when Gall acks the poke, not on HTTP acceptance.
function poke(app, mark, json, rejected) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No acknowledgement yet. The action may still complete; refresh the fleet before retrying.')), 90000);
    const finish = fn => value => {clearTimeout(timer); fn(value);};
    api.poke({app, mark, json,
      onSuccess: finish(resolve),
      onError: finish(() => reject(new Error(rejected))),
    }).catch(finish(reject));
  });
}
export function command(kind, value) {
  return poke('theseus', 'theseus-ui', {[kind]: value}, 'The host rejected this action. Check its Dojo for the error trace.');
}
// A moon's terminal: keystrokes, window size, prompt redraw. One poke at a
// time, so keys reach Dill in the order they were typed.
let termQueue = Promise.resolve();
export function term(who, act) {
  const next = termQueue.then(() => poke('theseus', 'theseus-ui', {term: {who, act}}, `${who} did not take that input.`));
  termQueue = next.catch(() => {});
  return next;
}
