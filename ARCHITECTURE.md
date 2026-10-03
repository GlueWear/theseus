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
  `|install ~siglup-narwet %landscape` in the moon's Dojo).
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

## The console

`http://localhost:<eyre port>/apps/theseus`, or the Theseus tile in Landscape.
Only the host's logged-in owner gets the page; anyone else is sent to the
login page.

| View | What it does |
| --- | --- |
| Moons | Health (vanes, identity, queue), boot, pause/resume, remove, a Dojo per moon, the moon's `+code`, Landscape |
| Snapshots | Take, restore, delete |
| Gateway | Gateway status and settings (see below) |

Under the hood the page reads `/~/scry/theseus/ui.json` every few seconds,
sends commands as pokes that succeed only when the agent acknowledges them, and
subscribes to pyre's `/blit` for Dojo output.

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
  the pier's control socket, repeats that every minute, and reports `down` when
  it stops.
- It re-reads the console's settings every minute and restarts Caddy if the mode
  or declared port changed.
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
| A moon cannot `\|hi` a ship on the same network | No relay path to the moon | Confirm the runtime is the STUN build (hash in HARDENING.md) and the moon has sent traffic recently. |

## Known limits

- Needs the patched runtime. Automatic ports change on every host restart
  (STUN re-establishes reachability).
- The local gateway is loopback-only. Hosting mode needs an operator-run proxy
  with wildcard DNS and TLS that maps `<moon>.<domain>` to `/theseus/~<moon>/` on
  the host's Eyre, with the same identity check.
- Gateway setting changes apply within about a minute, not instantly.
- Not yet measured: Landscape speed inside a moon, long-running channel health,
  boot timings, memory under repeated boot/kill (see HARDENING.md gates).
- Not yet re-run live on a disposable moon: snapshot/restore and remove from the
  console, and an on-demand `|hi` between a moon and the host in both directions.
- Each moon shows its host's sigil (the sigil library cannot draw moons).

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
  - web gateway with discovery, identity checks and launchd supervision
  - chunked moon responses
  - Gateway settings in the console
  - new Theseus icon
