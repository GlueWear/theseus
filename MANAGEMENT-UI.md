# Theseus management console

**Status: uncommitted candidate. Built and tested off-line; not deployed.**

An authenticated web console at `/apps/theseus` on the host ship for booting
moons, watching their health, opening a Dojo per moon, and taking, restoring and
deleting snapshots. The guest HTTP proxy at `/theseus` is unchanged.

## Pieces

| Path | Role |
| --- | --- |
| `app/theseus-ui.hoon` | Binds `/apps/theseus`; serves `web/theseus.html` (`no-store`) and the tile icon `web/icon.png` to the authenticated owner only. Keeps the web gateway settings and the launcher's last report. |
| `desk.docket-0`, `mar/docket-0.hoon`, `lib/docket.hoon`, `sur/docket.hoon` | Landscape tile (`site+/apps/theseus`). Support files are byte-identical to the host's `%landscape`. |
| `app/theseus.hoon` | `%theseus-ui` poke (host-only) and `/x/ui` JSON scry. |
| `app/theseus-pyre.hoon` | `/blit` (all guest Dill output) is host-only; guest HTTP responses are streamed to the browser in bounded chunks. |
| `sur/theseus-ui.hoon`, `mar/theseus/ui.hoon` | JSON command contract. |
| `lib/server.hoon`, `mar/html.hoon` | Standard Urbit helpers the desk did not carry. |
| `ui/` | React/Vite source. `npm run build` writes the single-file `web/theseus.html`. |
| `ops/Caddyfile.local` | Loopback-only local web gateway that namespaces moon requests before host Eyre cache lookup, and only forwards to the expected ship. |
| `ops/theseus-gateway` | Launcher: discovers and verifies the host's Eyre port, runs Caddy per the console's Gateway settings, reports to Theseus, installs launchd agents. |
| `ops/gateway-helper.c` | Per-ship launchd program built by `install`: runs only `ops/theseus-gateway run|sync|check` for that pier, in a fixed environment. |
| `ted/theseus-gateway.hoon`, `mar/theseus/gateway.hoon` | The launcher's local control thread (over `conn.sock`) and the console's settings mark. |

### API

- `GET /~/scry/theseus/ui.json` →
  `{version: 2, host, caches: [..], moons: [{ship, status, paused, queued, identity, vanes, desks}], snapshots: [{path, created, compatible, ships}]}`.
  `desks` is the moon's install plan, `[{desk, stage, reason, source: {ship, desk}}]`,
  with `stage` one of `installing`, `running`, `failed`. It is empty for
  moons booted before the desk picker.
- `GET /~/scry/theseus/desks.json` → `{version: 1, desks: [{desk, title, running, hash, source: {ship, desk} | null, dependencies}]}`:
  every host desk except `%kids` and `%theseus`. `source` is where the host's
  own copy syncs from.
- Poke `%theseus` with mark `theseus-ui`, one key per command:
  `boot {who, desks: [{desk, from: "host"|"publisher"}]}`, `dojo {who, command}`,
  `pause|resume|kill {who}`, `snapshot {name, ships}`, `restore|delete {path}`.
  See "Choosing a moon's desks" in ARCHITECTURE.md for what `boot` does.
- `GET /~/scry/theseus/web/~<moon>.json` → `{ship, code, landscape}`: the moon's
  login code (no `~`) and whether `%landscape` is installed, read from inside the
  moon when asked.
- `GET /~/scry/theseus-ui/gateway.json` →
  `{mode, port, template, live: {port, upstream, at} | null, eyre, url, status}`.
  `url` is the moon address template (`http://{moon}.localhost:8084`), `status`
  one of `ok`, `down`, `stale`, `mismatch`, `external`.
- Poke `%theseus-ui` with mark `theseus-gateway`:
  `{set: {mode: "auto"|"declared"|"hosting", port: number|null, template: string|null}}`.
- Subscribe `%theseus-pyre` `/blit` for `{ship, blits}` Dill output.

### Per-moon Landscape and +code

Each moon gets its own browser origin,
`http://<moon>.localhost:<gateway port>/`, and therefore its own
`urbauth-~<moon>` cookie. The local Caddy gateway rewrites every request to
`/theseus/~moon/<original path>` before forwarding it to host Eyre. Pyre strips
that namespace and presents the original path to the virtual moon.

The gateway is required because Eyre's response cache is keyed by URL, not by
HTTP host. Without namespacing, a host and moon that both cache
`/apps/landscape/assets/...` collide: host Eyre handles the cached entry before
the moon hostname binding and returns 403 for the moon session. The gateway
prevents that collision without sharing host cookies or weakening either
ship's authentication.

**Landscape** takes the moon's origin from the gateway's address, whichever
port the console itself was opened on (the Landscape tile opens it on Eyre's
port). It opens a tab synchronously (so pop-up blockers allow it), reads the
code and posts it to the moon's `/~/login` with `redirect=/apps/landscape/`. The
code never appears in a URL, and the tab's `opener` is cleared. If no gateway is
usable it explains why and offers the Gateway settings instead of opening a
blank tab. If the moon has no `%landscape`, the console offers to run
`|install <host> %landscape` in the moon's Dojo instead.

**+code** shows the code in a dialog with a copy button; it is not kept after
the dialog closes.

Pyre returns 404 for a `/theseus/~<moon>` path that is malformed or names no
moon (instead of hanging), and tells the moon's Eyre `%cancel-request` when the
browser drops a request (the streaming channel). On load it removes any
per-hostname Eyre bindings left by the earlier design.

### Web gateway

Settings live in the console's **Gateway** view:

- **Automatic** (default): the launcher takes the first free port from 8084.
- **Declared port**: the launcher listens on exactly that port, or refuses to
  start.
- **Hosting**: an operator-managed proxy serves moons at a public address such
  as `https://{moon}.example.com`; nothing runs locally. `{moon}` must be in
  the hostname, because moon apps use absolute paths.

`ops/theseus-gateway` runs Caddy with `ops/Caddyfile.local`:

- The host's Eyre port is not fixed (Vere takes the first free port from 8080
  at boot). The launcher reads it from `<pier>/.http.ports`, using only the
  public HTTP line: never the loopback port, which Eyre treats as the owner.
- It accepts the port only if `GET /~/host` answers with the host's name, and
  Caddy keeps checking that every 5 seconds; if another ship holds the port,
  clients get 503 rather than that ship.
- It reports `[%live port eyre]` to `%theseus-ui` through
  `ted/theseus-gateway` over the pier's `conn.sock` (Khan), so the console knows
  where moons live, and repeats it every 10 minutes so Theseus' view heals on
  its own. Its control-socket client waits for each reply instead of timing
  out (see the 2026-10-03 incident in HARDENING.md), and a settings read that
  fails keeps the current settings. It reports `[%down ~]` when it stops, unless another gateway has already
  taken over its admin address. It re-reads the settings about once a minute
  and restarts Caddy when the mode or declared port changes.
- `install` builds a small per-ship helper in
  `~/Library/Application Support/Theseus/io.theseus.gateway.<ship>/` and loads
  two launchd agents that run it: `io.theseus.gateway.<ship>` (runs at login,
  restarts on failure, waits for the ship) and `io.theseus.gateway.<ship>.sync`,
  which watches `.http.ports` and reloads Caddy in place when the host restarts
  on another port.
- macOS blocks launchd jobs from reading external volumes unless the job's
  program is allowed. Running `/bin/bash` directly was blocked; the helper is
  the program macOS judges instead. `install` first runs a one-off test job; if
  macOS refuses it, it prints the one-time Full Disk Access steps for the
  helper alone and leaves any running gateway untouched. The helper is rebuilt
  only when its source or settings change, so a granted permission survives
  reinstalls.

```sh
export THESEUS_PIER=/path/to/pier      # or put it in ops/theseus-gateway.env
ops/theseus-gateway check              # what would run; changes nothing
ops/theseus-gateway install            # launchd agents (stops a manual gateway)
ops/theseus-gateway status
ops/theseus-gateway uninstall
```

Logs: `~/Library/Logs/io.theseus.gateway.<ship>*.log`. Set `THESEUS_ADMIN` to
give each host's gateway its own Caddy admin address when several run on one
machine.

The UI reports success only after Gall acks the poke (`onSuccess`), not on HTTP
acceptance. Taking a snapshot pauses the selected moons and leaves them paused;
restoring resumes every moon in the snapshot.

### Security

- Eyre marks a request `authenticated` only for the owner's session (`%ours`);
  `/~/scry` returns 403 otherwise. The page redirects anonymous visitors to
  `/~/login`.
- EAuth and anonymous guests can open channels, so the `%theseus-ui` poke and
  the `/blit` watch check `src == our`.
- Eyre pokes and watches an HTTP agent *as the requester's identity*, and Gall
  leaves `sap` empty for any sender other than `our`. So the UI agent cannot
  assert on `src` or `sap` (a logged-out visitor would get a 500 instead of the
  login redirect). It serves content only when `authenticated` is set *and*
  `src == our`; everyone else, including a ship poking it directly with a
  forged request, gets the login redirect.
- The moon's code is only readable through `/~/scry` (owner only) and only
  posted to that moon's own origin.
- Boot only accepts moons of the host (`child-of`). Dojo commands are capped at
  16 KiB. Snapshots take 1-64 ships.
- Dill text is stripped of control characters before reaching xterm; only the
  renderer emits terminal escapes.
- `@urbit/http-api` 3.0.0 registers an unbound `beforeunload` delete that throws,
  so the UI deletes its channel on `pagehide` itself, and starts a fresh channel
  after a fatal SSE error so the Dojo resubscribes.

## Build

```sh
cd ui
npm ci
npm test            # model unit tests
npm run test:e2e    # Playwright against test/mock-host.mjs (mock Eyre on :8085)
npm run build       # writes ../web/theseus.html
```

## Incident and fixes (2026-10-03, afternoon)

The host crashed twice while a moon booted. The launcher's `nc -w 10` hung up
on the busy ship; the late reply failed with EPIPE and the runtime freed the
connection twice (upstream bug, fixed in Vere `c0a35c6`). The launcher also
treated the failed settings read as a switch to automatic mode and moved the
gateway from 8086 to 8084. Fixes: the launcher's client waits for replies and
failed reads keep the settings (tested against a fake socket replying after
12 seconds, a forced 2-second timeout, and the live ship); the runtime carries
the upstream fix plus a regression test that reproduces the double destructor
call without it (build `7956112f`, staged for install).

## Verification done (2026-10-03, web gateway)

- Clay builds on the check desk: all three agents, `ted/theseus-gateway`, the
  `theseus-gateway` and `theseus-ui` marks.
- `%theseus-ui`: migrates from the stateless version to `auto`; 4 valid and 9
  invalid settings (missing port or template, port 70000, path-prefix,
  `{moon}`-less, double `{moon}`, `ftp://`, trailing path, whitespace) accepted
  and rejected as expected; the JSON mark cannot set `live`; foreign `src`
  rejected; status `down`, `ok`, `stale`, `mismatch`, `external` against the real
  Eyre port.
- Pyre: path parsing; real moon forwarded with the prefix stripped; 404 for an
  unknown moon, a malformed name and a bare prefix; on load it disconnects the
  three leftover per-hostname bindings on the live host.
- Caddy: wrong ship on the upstream port (`~dolten-dilpun` on 8082) gives 503
  on both routes; the right ship forwards.
- Launcher, against the live host on a spare port and admin address: discovery
  and verification, `check`, `run`, `sync` reload, refusal of a second `run`,
  clean stop in about 2 seconds; settings and `.http.ports` parsing unit-tested,
  including ignoring the loopback port. Registration with Theseus is pending the
  desk commit.
- Browser: 3 unit and 11 Playwright tests (adds: no gateway explains instead of
  opening a blank tab; settings validate, apply and drive moon origins; Gateway
  view at phone width).
- Live, after the desk commit: the launcher reads the settings over
  `conn.sock` (declared 8086) and registers; Theseus reports `ok`. Under launchd:
  `/bin/bash` as the job program was refused by macOS, the helper was allowed;
  a killed Caddy is restarted within a second and re-registers; touching
  `.http.ports` triggers the sync agent, which reloads in place. Found and fixed
  live: numbers sent to Hoon need dot grouping (`8.086`), and a replaced
  gateway's late `down` report erased the new one's registration.

## Verification done (2026-10-02)

On `~siglup-narwet`, against the uninstalled check desk `%theseus-ui-check`
(no agent started, no live state touched):

- Clay builds of all three agents, both new marks, `sur/theseus-ui` and
  `lib/server`.
- JSON decoding through the real `json -> theseus-ui` mark tube: all eight
  commands decode; bare `@p`, invalid `@tas`, non-array ships, relative paths,
  unknown and multi-key commands are rejected.
- The real agent loaded with a fabricated fleet: `/x/ui` JSON for healthy,
  empty, paused and runtime-mismatched entries; pause, delete and resume reflected
  in `/x/ui`; foreign `src`, non-child boot and over-size Dojo rejected.
- `theseus-ui` HTTP handler, with the `src`/`sap` Gall actually delivers: owner
  GET 200 with the page and the SVG icon; a guest gets 307 to login; a forged
  authenticated poke from another ship also gets 307; POST 405.
- `desk.docket-0` parses to a `%site` tile.
- `/x/web` against the real `~sampel-siglup-narwet` kernel (live state read
  through `dbug`, loaded into the check-desk agent): a valid 27-character code
  and `landscape: false`.
- Pyre: hostname parsing; moon-origin requests forwarded with the URL untouched;
  404 for unknown moons; the old prefix route unchanged; one `%cancel-request`
  on browser leave and none after completion; site binding; kill reads the live
  Eyre bindings without error. `web` rejects unknown moons, bad ports and
  foreign senders.
- Browser: 3 unit tests and 8 Playwright tests (adds: Landscape login post to the
  moon origin, install prompt for a moon without Landscape, +code copy).

**Not verified:** anything against the live agent, real Dill output in the
console, real boot/snapshot/restore, or networking of a moon booted from the UI.
The mock host proves only the UI's behavior against the documented API.

## Deploy (coordinate first)

The console works on the currently installed runtime. Automatic guest UDP ports
need the candidate runtime in
`zod/.toolchain/theseus-runtime-20261002-autoudp/` (see its `BUILD.md`). Without
it, a newly booted moon has no network until it is added to `LICK_UDP` and the
host restarts.

1. Desk: copy only `app/ lib/ sur/ mar/ web/ desk.bill desk.docket-0` into
   `siglup-narwet/theseus/` (never `ui/` or `node_modules`). In the host Dojo:

   ```hoon
   |commit %theseus
   +vats %theseus
   ```

   Kiln starts `%theseus-ui` from `desk.bill`. The `%theseus` state type is
   unchanged (`%5`); no migration runs. Docket picks up `desk.docket-0` and
   adds the Theseus tile to Landscape.
2. Start the web gateway (see "Web gateway"): `ops/theseus-gateway install`
   with `THESEUS_PIER` set. The console's Gateway view should show **Running**.
3. Open the console from the Landscape tile or at `/apps/theseus` on any port,
   logged in to the host.
4. Runtime (optional, separate window): follow the gate in the candidate's
   `BUILD.md`. Keep the existing moon's `LICK_UDP` mapping if it must keep port
   41237; new moons need no mapping.

### Acceptance on the live host

Use a fresh, disposable moon; do not restore snapshots or remove
`~sampel-siglup-narwet` without agreement.

1. Boot a new moon from the console. Confirm the host logs
   `lick: udp transport /theseus-pyre/utp/~<moon> bound 0.0.0.0:<port>` after its
   first outbound packet, and `lsof -nP -iUDP:<port>` shows the runtime.
2. In its Dojo: `(add 2 2)` shows `4`; `|hi ~zod` returns `hi ~zod successful`.
3. Snapshot it (it pauses), resume, restore (it resumes), delete the snapshot.
4. Install Landscape on it from the console prompt, then open Landscape: the tab
   should land logged in at `http://<moon>.localhost:8084/apps/landscape/`.
5. Remove it; confirm the UDP port closes.

### Rollback

- Gateway: `ops/theseus-gateway uninstall`.
- Console only: remove `%theseus-ui` from `desk.bill` and delete
  `desk.docket-0`, `|commit %theseus`, then `|rein %theseus [| %theseus-ui]`.
- Full: restore the desk files from `e63e7ca` and `|commit %theseus`.
- Runtime: reinstall the hash-verified previous `.run` per its `BUILD.md`.

## Known limits

- Automatic ports change on every host restart; inbound reachability relies on
  outbound traffic opening NAT mappings.
- A failed UDP bind is logged by the runtime only; the console still shows the
  moon healthy.
- Console health reflects the kernel's vane set and identity, not network
  liveness.
- Every moon renders its host's sigil (sigil-js does not draw moons).
- The tile's license reads `Unspecified`: the repo declares no license.
- The included gateway is deliberately loopback-only. Hosting mode needs
  wildcard DNS, TLS, and an equivalent reverse-proxy rule that maps each public
  moon hostname to `/theseus/~moon/<original path>` (with the same `/~/host`
  identity check); do not expose this local HTTP configuration directly.
- Changing the Gateway settings takes effect when the launcher next reads them
  (within about a minute), not instantly.
- Not yet measured: how fast Landscape loads when every request is an event
  inside a moon inside the host, or whether its channel stays healthy over time.
- Installing Landscape needs the moon to reach the host over Ames.
