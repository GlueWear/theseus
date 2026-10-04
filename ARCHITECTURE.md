# Theseus architecture

How Theseus runs virtual moons inside a host ship, how they reach the network,
and how you manage them and use their web apps. Written October 2026 against
host `~siglup-narwet` on Zuse 408. For the console and gateway API and test
record see [MANAGEMENT-UI.md](MANAGEMENT-UI.md); for runtime builds see
[HARDENING.md](HARDENING.md).

## The pieces

```
 Browser
   │  http://localhost:<eyre>/apps/theseus          console (host's own origin)
   │  http://<moon>.localhost:<gateway>/...          a moon's web apps
   ▼
 Web gateway: Caddy (ops/Caddyfile.local), run by ops/theseus-gateway
   │  moon hostnames → /theseus/~<moon>/<path>; everything else unchanged
   ▼
 Host ship: patched Vere runtime + Arvo
   ├─ Eyre ─────────────┬─ %theseus-ui    console page, icon, gateway settings
   │                    └─ %theseus-pyre  /theseus/~<moon> web route, /blit
   ├─ %theseus           fleet: each moon's Arvo kernel, event queue, snapshots
   ├─ %theseus-pyre      the moons' "runtime": Ames transport, timers, Dill,
   │                     HTTP in and out
   └─ Lick ports /theseus-pyre/utp/~<moon>
          │  one UDP socket per moon, with STUN, in the runtime
          ▼
       Internet (galaxies, other ships, the host itself)
```

| Part | Where | Role |
| --- | --- | --- |
| `%theseus` | `app/theseus.hoon` | Holds every virtual ship's Arvo kernel and event queue; boots, pauses, kills, snapshots and restores them; injects events and collects effects. |
| `%theseus-pyre` | `app/theseus-pyre.hoon`, `lib/theseus-pyre.hoon` | Plays Vere for the moons: sends their packets through Lick, runs their timers, renders Dill output, carries their HTTP. |
| `%theseus-ui` | `app/theseus-ui.hoon`, `web/` | Serves the console and its icon to the host's owner; stores the web gateway settings and the gateway's last report. |
| Console | `ui/` → `web/theseus.html` | React single-page app at `/apps/theseus` and a Landscape tile. |
| Web gateway | `ops/` | Caddy plus a launcher and launchd helper; gives each moon its own browser origin. |
| Patched Vere | GlueWear/vere `main` | UDP-backed Lick ports with automatic ports and per-guest STUN. |

## How a moon runs

A moon is an Arvo kernel stored as a value inside `%theseus`. To run it,
`%theseus` feeds it events (a Dojo command, a timer firing, an incoming packet,
an HTTP request) and collects the effects the kernel produces. `%theseus-pyre`
turns those effects into real actions on the host: packets go out through the
runtime, timers through Behn, terminal output to the console's Dojo view.

- **Boot:** the console's **Boot moon**, or `:theseus|init-moon ~moon`. The host
  registers the moon's keys in its own Jael, then boots the kernel from a cache
  of desks (the default cache has only `%base`; install more per moon, e.g.
  `|install ~siglup-narwet %landscape` in the moon's Dojo). Building the
  moon's kernel takes well under a second; most of a boot is the moon's own
  first start (installing `%base` and starting its agents), and the whole boot
  runs as one event, so the host is busy until it finishes.
- **Pause/resume:** a paused moon queues events instead of running them.
- **Snapshot/restore:** a snapshot pauses the selected moons and copies their
  state; restoring replaces their state and resumes them.
- **Kill (Remove):** deletes the moon's state and closes its UDP socket.
  Snapshots are kept.

## How a moon reaches the network

Ames, Urbit's network protocol, normally lives in the runtime's UDP socket.
Arvo cannot send raw packets, so Theseus relies on a small runtime patch
(GlueWear/vere, see [NO-SIDECAR.md](NO-SIDECAR.md)):

1. When a moon first sends a packet, pyre opens a Lick port named
   `/theseus-pyre/utp/~<moon>`. The runtime gives that port its own UDP socket on
   an automatic port (or a fixed one listed in `LICK_UDP`) and logs
   `lick: udp transport ... bound 0.0.0.0:<port>`.
2. Outgoing packets go to that port as `%send`/`%push` and leave from the moon's
   socket. Incoming datagrams on the socket come back as `%hear`/`%heer` and are
   injected into the moon's Ames.
3. **STUN:** the moon's Ames reports its sponsorship chain (moon → host →
   `~nolset` → galaxy `~rus`). The runtime then runs STUN from the moon's socket
   to that galaxy every 25 seconds and reports the result back to the moon's
   Ames as a stock `%stun` event. This keeps the moon's NAT mapping open, so a
   galaxy can relay packets to it.

Why step 3 matters: on 2026-10-02 moons could answer `~zod` (a galaxy they
contacted directly) but never heard from the host or `~nolset`, which sit on
the same Mac behind the same router. The router does not loop traffic back to
its own public address, and nothing kept the moons' NAT mappings open for
relaying. After the STUN build, moon `~fopwyn-libryp-siglup-narwet` has direct
routes to both and installed `%landscape` over the network.

**The sponsor chain must be the real one.** Ships change sponsors: `~nolset`
was spawned under galaxy `~set` and escaped to `~rus`. Every step above
(`%ping`, STUN, relaying) uses the chain from the moon's own Jael. Theseus
seeds that chain when it boots a moon: `%dawn` carries each sponsor's keys
(`czar`) and its current sponsor (`spon`), both from the host's Jael
(`+boot-chain` in `app/theseus.hoon`). After boot, the moon's own Jael and
`%azimuth` agent track later changes, as on any ship.

Before 2026-10-03, `spon` was empty, so a new moon derived `~nolset`'s
sponsor from its @p (`~set`). It pinged, STUNned and relayed through `~set`,
which dropped everything, including the host's replies. The moon could reach
galaxies directly but not the host or `~nolset` until its own `%azimuth`
caught up, or until someone ran `|hi ~rus` from the moon.

With `+boot-chain`, verified on moon `~ropnet-tobryl-siglup-narwet`, the moon
reaches `~rus` and the host as soon as it boots. One window remains, and stock
moons have it too:

1. Shortly after boot, the moon's `%azimuth` loads the public snapshot from
   `bootstrap.urbit.org` (log: `ship: processing azimuth snapshot`).
2. That snapshot predates `~nolset`'s escape, so it sets `~nolset`'s sponsor
   back to `~set`, and traffic to `~nolset` fails.
3. When `%azimuth` catches up on newer events (log: `l2-sig-failed`),
   `~nolset` is under `~rus` again and pending messages go through.

The host and other ships whose sponsor hasn't changed are unaffected
throughout.

## The console

`http://localhost:<eyre port>/apps/theseus`, or the Theseus tile in Landscape.
Only the host's logged-in owner gets the page; anyone else is sent to the
login page.

| View | What it does |
| --- | --- |
| Moons | Health (vanes, identity, queue), oldest boot first; boot with a status bar; per moon: Dojo, Landscape, `+code`, pause/resume, snapshots, remove |
| Snapshots | Every snapshot, newest first: restore, delete |
| Gateway | Gateway status and settings (see below) |

Under the hood the page:

- reads `/~/scry/theseus/ui.json` every few seconds;
- sends commands as pokes that succeed only when the agent acknowledges them;
- subscribes to pyre's `/blit` for Dojo output.

- **Dojo.** Each moon's Dojo is a terminal. Keystrokes go to the moon's Dill as
  belts (the `term` command). Dill echoes them and draws the prompt and cursor,
  so there is no separate input box. The terminal also sends its size, and asks
  for a redraw whenever it can type.
- **Boot status.** A boot runs on the host for a few seconds before the host
  acknowledges it. The status bar shows that phase, then each chosen desk
  installing, until the moon is ready (or which desk failed and why).
- **Snapshots.** A moon's camera button opens its snapshots: take a new one
  (by default the moon keeps running), or restore one of its earlier ones.

## Choosing a moon's desks

**Boot moon** lists every desk on the host, not only Landscape apps. It reads
`/~/scry/theseus/desks.json`, which gives each desk's title, whether it runs,
and where the host's own copy comes from.

- `%base` is always included, and it tracks the host's `%kids`.
- `%kids` and `%theseus` are never offered.
- A desk with a docket (a Landscape app) brings `%landscape` with it, and the
  dialog says why.
- Each chosen desk takes updates from the host by default. If the host's own
  copy syncs from another ship (glurff from `~nolset`), you can choose that
  ship instead. The host works out that ship itself, so the console cannot
  point a moon at an arbitrary ship.

What happens on boot (`%init-moon-desks` in `app/theseus.hoon`):

1. **Boot cache.** Theseus builds a cache of the chosen desks from the host's
   Clay. It reuses the cache for the same set while the host's desk hashes
   match. At most 8 caches are kept, and stale ones are dropped.
2. **Boot with only `%base`.** Clay already holds every chosen desk's commits
   and files, but not the desks themselves. Kiln's `+on-init` revives every
   desk it finds during the boot cascade, and Eyre's `%init` runs later in that
   cascade and resets Eyre's bindings. An app started that way loses its
   `/apps/...` binding, so its pages return 404.
3. **Add the desks after boot.** `+inject-desks` adds them with their history
   intact. Clay `%zest %live` starts their agents.
4. **Install.** Each desk is `|install`ed from its chosen source. Its files are
   already local, so nothing is downloaded.
5. **Ally publishers.** If `%landscape` is on the moon, each publisher (the
   ship the host's copy syncs from) is allied in the moon's `%treaty`, as a
   Landscape install would do. Docket only installs apps whose treaty it has,
   so an app's in-app "install X" button needs this.
6. **Progress.** A 2-second timer reads the moon's Kiln until each desk runs
   from the expected source. A desk is marked failed only on a wrong source,
   or after 20 minutes. Each moon row shows each desk's stage, and hovering
   shows its source.

Verified live on 2026-10-03:

- Moons booted with `%glurff`, `%noltbook`, `%noltbook-data` and `%landscape`
  ran each desk from `~siglup-narwet` at the host's hash.
- Measured by the session that started this work: the second and third moon
  from the same cache added about 18 MB together.
- After the boot-ordering fix, moon `~holdep-namlys-siglup-narwet` serves
  `/apps/landscape/` and `/apps/glurff/` (307 to login, then the apps), and its
  Eyre has docket's and glurff's bindings.

Not yet tested live: the "publisher" source choice and the treaty allies.

## Snapshots and restore

A snapshot seals each chosen moon's whole Arvo state. Its moons pause while it
is taken, and by default they then carry on running. Restoring puts that state
back.

**Restore starts a new network era.** A restore rolls back the moon's Ames
message flows too, but every other ship keeps its own:

- they drop the moon's new messages as duplicates of ones they already have;
- they keep resending messages the moon no longer expects.

The result is stalled subscriptions. In Glurff this showed as "trying to
reconnect to world", with other users never appearing. It's the same reason a
real ship must never boot an old copy of its pier.

So when Theseus restores one of the host's moons, it runs a persisted recovery
transaction (`state-11` in `app/theseus.hoon`) and treats the restore as a
breach:

1. **Freeze before replacement.** Theseus unions the peers known by the live
   moon and the snapshot, shuts the moon's Pyre transport, restores it paused,
   and clears its input queue. Transport and operator input remain blocked
   while the recovery job is registering.
2. **New identity on the host.** The host's Jael gets a new rift and new keys
   for the moon, just as when a moon is re-initialized. Every ship tracking
   the moon learns both together and wipes its flows and subscriptions with
   it. Theseus reads Jael's life, rift and public key back before proceeding;
   it retries for 30 seconds and otherwise leaves the moon paused with a
   visible `%failed` recovery record.
3. **The same identity inside the moon.** Its own Jael point gets the new
   rift, life and key (state surgery, `+set-own-point`), then `%rekey`, and
   Ames rereads its rift (`%stir %rift`).
4. **The moon forgets its side.** It treats the captured peer union as
   breached, first in
   Ames (its flows are wiped) and then in Gall (its agents' subscriptions are
   kicked, so they resubscribe on fresh flows).

   This uses Jael's `%ruin`, aimed at one tracker at a time. In Jael's
   `+exec:su`, the fold over trackers keeps only the last one
   (`su(moz [[duct cad] moz])` reads the original `moz`, not the
   accumulator's), so `%ruin` reaches only one vane. That is an upstream bug
   worth reporting.

5. **Restart last.** Only after the host confirmation and local reset does
   Theseus send Pyre `%restart`. One more timer pass requires a healthy,
   unpaused, empty-queue moon before the recovery lock is removed. A Gall
   reload re-arms any persisted recovery timer.

Before Gall's step, the restore checks that the moon's Ames holds no flows
with those peers (`+stale-flows`); otherwise it fails and stops the moon, so
it can't run on with stalled flows. An earlier version ran the Gall step from
a copy of the moon taken before the Ames step, which threw the Ames wipe away.
The moon kept its old flows, and peers, having wiped theirs, waited forever
for message 1 (seen as Glurff's "reconnecting to world").

Data other ships already received stays with them. Messages still in flight
are lost. Snapshot recovery currently refuses planets and ships that are not
moons owned by the host; silently restoring their stale network continuity
would be unsafe.

The original local breach surgery was verified on a copy of moon
`~riltes-dinnub-siglup-narwet`, without storing the result:

- Ames moved to rift 1, life 2.
- Its 31 stale incoming flows with `~nolset` were wiped, and its agents
  resubscribed on new flows.
- Gall forgot every breached ship, then re-tracked the two it resubscribed to
  at once.
- Jael's trackers were restored.

The console warns about the new era before restoring.

The staged host-registration barrier still requires a live disposable-moon
acceptance test before it is considered release-proven. Local health after
restart is not a substitute for a real remote `|hi` and application reconnect.

## Moon web apps and the web gateway

A moon's apps (Landscape and anything installed on it) need their own browser
origin, `http://<moon>.localhost:<gateway port>`:

- Apps use absolute paths such as `/apps/landscape/` and `/~/channel`; on the
  host's own origin those would reach the host.
- The host's Eyre caches responses by URL. When the host and a moon both serve
  `/apps/landscape/assets/...`, the host's cache answers first and refuses the
  moon's session. This is what produced the blank white Landscape page.
- Each origin keeps its own login cookie.

The **web gateway** provides those origins. Caddy receives
`<moon>.localhost:<port>/<path>`, rewrites it to `/theseus/~<moon>/<path>` and
forwards it to the host's Eyre; pyre strips the prefix and hands the request to
the moon's own Eyre. Large responses stream back in 64 KiB pieces, and a
dropped browser connection is cancelled inside the moon too. A name that is not
one of the host's moons gets a 404.

**Landscape button:** the console reads the gateway's moon address, opens a tab,
reads the moon's `+code` and posts it to the moon's login page, so the tab lands
logged in. The code never appears in a URL. If the gateway isn't usable, the
console explains why instead of opening a blank tab. If the moon has no
`%landscape`, it offers to install it from the host.

### Gateway settings (console → Gateway)

| Mode | Behaviour |
| --- | --- |
| Automatic (default) | The launcher takes the first free port from 8084. |
| Declared port | The launcher uses exactly that port, or refuses to start. On `~siglup-narwet` this is **8086**. |
| Hosting | An operator-run proxy serves moons at a public address such as `https://{moon}.example.com`; nothing runs locally. |

The view shows a status:

| Status | Meaning |
| --- | --- |
| Running | A gateway reported in and forwards to the Eyre port the host uses now. |
| Not running | No gateway has reported in. |
| Out of date | The gateway forwards to an old Eyre port (the host restarted); it re-syncs on its own. |
| Applying change | A declared port changed; the gateway switches within a minute. |
| Hosting | Hosting mode; moon tabs open at the hosting address. |

### What the gateway does on this Mac

`ops/theseus-gateway` (run by launchd) keeps the gateway correct without
fixed ports:

- The host's Eyre port is not fixed (Vere takes the first free port from 8080 at
  boot, so it depends on which ships started first). The launcher reads it from
  `<pier>/.http.ports`, using only the public HTTP line, never the loopback port,
  which Eyre treats as the owner.
- It forwards only if `GET /~/host` answers `~siglup-narwet`, and Caddy repeats
  that check every 5 seconds. If another ship ever holds the port, browsers get
  503 rather than that ship.
- It tells Theseus where it listens (`[%live port eyre]`) through a thread over
  the pier's control socket (`conn.sock`), repeats that every 10 minutes, and
  reports `down` when it stops.
- It re-reads the console's settings every minute and restarts Caddy if the mode
  or declared port changed. A read that fails (ship busy or down) changes
  nothing.
- Its control-socket client always waits for the reply (up to 5 minutes) instead
  of hanging up. A client that hangs up while the ship is busy crashed runtimes
  without Vere's newt hang-up fix; see HARDENING.md, 2026-10-03 incident.
- Two launchd agents run it through a small helper program in
  `~/Library/Application Support/Theseus/io.theseus.gateway.siglup-narwet/`:
  `io.theseus.gateway.siglup-narwet` (starts at login, restarts on failure,
  waits for the ship) and `io.theseus.gateway.siglup-narwet.sync` (reloads Caddy
  when `.http.ports` changes, i.e. when the ship restarts). macOS refused to
  let launchd run the script with `/bin/bash` directly from `/Volumes/DEV`; the
  helper runs only this script, for this pier, with a fixed environment.

## Security model

- **Console and data:** Eyre marks only the owner's session as authenticated.
  The console page, `/~/scry` data and moon `+code`s are owner-only. Pokes and
  the `/blit` subscription require the host itself as sender, because guests
  (EAuth or anonymous) can open Eyre channels.
- **HTTP agents:** Eyre pokes HTTP agents as the requester's identity, and Gall
  gives no provenance for non-host senders. So `%theseus-ui` serves content only
  when the request is authenticated *and* comes from the host. A forged poke
  from another ship gets the login redirect.
- **Moon login:** the code is posted only to that moon's own origin, never in a
  URL. The tab's `opener` is cleared.
- **Gateway:** listens on loopback only. It never forwards to Eyre's loopback
  port, and it verifies the ship's identity continuously.
- **Gateway control:** the console can only change settings. The `live`/`down`
  reports come only from the local thread.
- **Helper:** accepts only `run`, `sync` or `check`, with the script path, pier
  and environment compiled in.
- **Moon output:** Dill text is stripped of control characters before it
  reaches the terminal view.

## Operations

| What | Where |
| --- | --- |
| Pier | `/Volumes/DEV/Enviorment/urbit-dev/ships/siglup-narwet` |
| Mounted desk | `<pier>/theseus` |
| Repository | `/Volumes/DEV/Enviorment/urbit-dev/ships/zod/theseus` (GitHub `GlueWear/theseus`) |
| Runtime source | `/Volumes/DEV/Enviorment/urbit-dev/ships/zod/vere` (GitHub `GlueWear/vere`) |
| Runtime receipts | `zod/.toolchain/theseus-runtime-20261002*/` (rollback copies) |
| Gateway logs | `~/Library/Logs/io.theseus.gateway.siglup-narwet*.log` |
| Gateway helper | `~/Library/Application Support/Theseus/io.theseus.gateway.siglup-narwet/` |

**Start order:** start the host ship; the gateway starts by itself at login and
waits for the ship. Open the console from the Landscape tile.

**Update the desk** (after changing Hoon or rebuilding the console with
`cd ui && npm run build`): copy `app lib sur mar ted web desk.bill
desk.docket-0` into `<pier>/theseus` (never `ui/` or `node_modules`), then run
`|commit %theseus` in the host's Dojo.

**Update the runtime:** build in the Vere repo (`zig build -Doptimize=ReleaseFast`,
plus `lick-test ames-test newt-test`). Then:
1. `|exit` the host.
2. Confirm no `.run` processes or lock remain.
3. Keep a hash-verified copy of the old `.run`.
4. Replace `.run` by atomic rename and verify the new hash.
5. Start the host.

The receipts in `.toolchain` include `install.sh` and `rollback.sh` scripts
that enforce these checks.

**Gateway commands** (from the repository; set `THESEUS_PIER` first):

```sh
export THESEUS_PIER=/Volumes/DEV/Enviorment/urbit-dev/ships/siglup-narwet
ops/theseus-gateway status       # agents, port, Eyre, Theseus' settings
ops/theseus-gateway check        # what would run; changes nothing
ops/theseus-gateway install      # (re)install launchd agents
ops/theseus-gateway sync         # re-sync now after a host restart
ops/theseus-gateway uninstall    # remove the agents (keeps the helper)
launchctl kickstart -k gui/$(id -u)/io.theseus.gateway.siglup-narwet   # restart it
```

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Landscape opens a blank white page | The tab is on the host's Eyre port instead of the gateway (console from before the gateway update) | Reload the console; the tab should open on the gateway port (8086). Check Gateway shows Running. |
| "No web gateway is running" | The gateway is stopped | `ops/theseus-gateway status`; if loaded but not running, read the log; `launchctl kickstart -k ...`; else `ops/theseus-gateway install`. |
| Gateway shows "Out of date" | The host restarted on another Eyre port | Waits for the sync agent; or `ops/theseus-gateway sync`. |
| Moon tab returns 503 | The gateway's Eyre port does not answer as `~siglup-narwet` (host down, or another ship has the port) | Start the host; then `ops/theseus-gateway sync`. |
| Moon tab returns 404 "No such moon" | The hostname isn't one of the host's moons | Check the moon name in the console. |
| `install` prints Full Disk Access steps | macOS blocks the helper from reading `/Volumes/DEV` | Follow the printed steps (add the helper in System Settings → Privacy & Security → Full Disk Access), then rerun `install`. |
| `+vats` on a moon shows "bad desk" | An install is waiting for its first download | The moon cannot reach the source ship; check the moon is running and its network (STUN). |
| Host crashes with `newt: write failed broken pipe` then a fault in `uv__drain` | A control-socket client hung up before the ship replied (fixed in runtime `7956112f`) | Install that runtime. Until then, don't use clients that time out early (`nc -w`, `click`) against a busy ship. |
| A moon cannot `\|hi` a ship on the same network | No relay path to the moon | Confirm the runtime is the STUN build (hash in HARDENING.md) and the moon has sent traffic recently. |
| A new moon reaches `~zod` but not the host or `~nolset`; `%ping` state names the wrong galaxy | The moon booted with a stale sponsor chain (Theseus before `+boot-chain`) | Commit the current desk and boot a new moon; an existing one recovers after its Azimuth snapshot loads, or `\|hi ~rus` from the moon. |
| A moon's `/apps/landscape/` (or another app) returns 404 "Not Found" | It was booted by the first desk-picker build: chosen apps started during boot and lost their Eyre bindings | Remove it and boot a new one; the current build adds chosen desks after boot. |
| After restoring a snapshot, a moon's apps can't reach other ships (e.g. Glurff "trying to reconnect to world") | The moon was restored by Theseus from before 2026-10-04, which didn't start a new network era | Restore it again with the current build, or remove it and boot a new moon. |
| An app's in-app install button says "Docket refused the installation" (`peek bad result` in `/app/treaty`) | The moon has no treaty from that app's publisher | `:treaty\|ally ~<publisher>` in the moon's Dojo, wait a few seconds, try again; moons booted with the current build ally publishers automatically. |
| A new moon reaches the host but `\|hi ~nolset` hangs for a few minutes after boot | The moon's Azimuth snapshot predates `~nolset`'s escape, so it routes through `~set` until `%azimuth` catches up | Wait for `l2-sig-failed` in the log; the pending `\|hi` then succeeds. |

## Known limits

- Needs the patched runtime. Automatic ports change on every host restart
  (STUN re-establishes reachability).
- The local gateway is loopback-only. Hosting mode needs an operator-run proxy
  with wildcard DNS and TLS that maps `<moon>.<domain>` to `/theseus/~<moon>/` on
  the host's Eyre, with the same identity check.
- Gateway setting changes apply within about a minute, not instantly.
- Not yet measured: Landscape speed inside a moon, long-running channel health,
  a whole boot end to end, memory under repeated boot/kill (see HARDENING.md
  gates).
- Not yet re-run live on a disposable moon: snapshot/restore and remove from the
  console, and an on-demand `|hi` between a moon and the host in both directions.
- Each moon shows its host's sigil (the sigil library cannot draw moons).
- A new moon can't reach ships that changed sponsors after the public
  Azimuth snapshot was taken (for example `~nolset`) until its `%azimuth` catches
  up, usually a few minutes. Seeding each moon's `%azimuth` from the host's
  caught-up state would close this; not built.

## History

- **2026-08:** the desk stopped vendoring `/sys` and uses the host kernel; the
  UDP-Lick transport replaced the Node sidecar.
- **2026-10-02 (morning):** hardening baseline: runtime leak fix, non-fatal
  socket errors, UDP close on kill.
- **2026-10-02:**
  - management console and Landscape tile
  - automatic guest UDP ports
  - per-guest STUN, which made local and relayed traffic reach moons
- **2026-10-03:**
  - runtime crash on control-socket hang-ups fixed (upstream newt fix,
    regression test, launcher client)
  - moon kernel construction from minutes to under a second (no `;;` over
    vane types)
  - web gateway with discovery, identity checks and launchd supervision
  - chunked moon responses
  - Gateway settings in the console
  - new Theseus icon
  - moons boot with the host's current sponsor chain, including escapes
    (`~nolset` → `~rus`), instead of chains derived from @p
- **2026-10-04:** restore starts a new network era (`+rebirth`), so restored moons reconnect; console redesign (terminal Dojo, boot status, per-moon snapshots, oldest-first, icon colours).
- **2026-10-04:** desk picker: choose any host desks for a new moon, seeded
  from the host's Clay and installed from the host or the desk's publisher
