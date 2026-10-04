# Theseus

`%theseus` runs virtual Urbit ships inside a host ship. The current product target
is virtual moons that boot, run Dojo, talk on live Ames through their own UDP
transport, and are managed from a web console. A patched Vere provides the
preferred native transport; the Node sidecar is an optional fallback for stock
Vere.

This repository is the canonical Theseus product repo. The older exploratory
history lives in `GlueWear/theseus-prototype`.

## Documentation

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces fit: agents, runtime transport, web gateway, console; operations and troubleshooting. Start here. |
| [MANAGEMENT-UI.md](MANAGEMENT-UI.md) | The console and web gateway in detail: API, security, build, deploy, verification. |
| [NO-SIDECAR.md](NO-SIDECAR.md) | Native UDP-Lick and automatic sidecar fallback. |
| [HARDENING.md](HARDENING.md) | Runtime builds and fingerprints, memory notes, remaining gates. |
| [THESEUS-REFERENCE.md](THESEUS-REFERENCE.md) | `%theseus` generators, scries and threads. |
| [408-OPERATIONS-NOTES.md](408-OPERATIONS-NOTES.md) | Earlier sidecar-era operations notes (historical). |

## Current Status

Verified on `[%zuse 408]` (October 2026, host `~siglup-narwet`):

- `%theseus`, `%theseus-pyre` and `%theseus-ui` install and run from a
  `%theseus` desk; the desk uses the host kernel (no vendored `/sys`).
- Virtual moons boot with real generated keys (`:theseus|init-moon` or the
  console) and run Dojo.
- Each moon talks on live Ames from its own UDP socket. Patched Vere
  (`GlueWear/vere`, branch `main`) is preferred and supplies automatic ports
  and per-moon STUN. On stock Vere, pyre falls back per moon to the optional
  Node sidecar. Moons have completed `|hi ~zod`, reached the host and its
  sponsor star, and installed `%landscape`; the fallback has also carried
  bidirectional live Ames traffic for a multi-moon fleet.
- The web console at `/apps/theseus` (also a Landscape tile): fleet health,
  boot individual moons or generated fleets with a choice of host desks,
  pause/resume/remove at moon or fleet scope, a terminal Dojo per moon,
  per-moon snapshots and restore, each moon's `+code`, and one-click Landscape
  per moon.
- Moon web apps open on their own origin, `http://<moon>.localhost:<port>`,
  through a local Caddy gateway that `ops/theseus-gateway` runs under launchd.

Known limits (details in ARCHITECTURE.md):

- Stock Vere needs the optional Node sidecar for live networking.
- The web gateway is loopback-only; public hosting needs an operator-managed
  proxy (the console's Hosting mode).
- Landscape speed and long-running channel health inside a moon are not yet
  measured.
- `:theseus|init-planet` (virtual real planets) is experimental.

## Repository Layout

- `app/theseus.hoon`: virtual ship state manager and control API.
- `app/theseus-pyre.hoon`: runtime bridge for virtual IO effects: UDP-Lick
  transport, STUN plumbing, timers, Dill, guest HTTP.
- `app/theseus-ui.hoon`, `ui/`, `web/`: the management console at
  `/apps/theseus`, its built page and icon, and the web gateway settings.
- `ted/theseus-gateway.hoon`: local control thread for the gateway launcher.
- `ops/theseus-gateway`, `ops/Caddyfile.local`, `ops/gateway-helper.c`: the
  local web gateway (launcher, proxy config, launchd helper).
- `gen/theseus/`: Dojo generators for init, moon init, kill, cache, snapshot,
  restore, and commands.
- `sur/theseus.hoon`, `sur/theseus-ui.hoon`: shared types.
- `lib/theseus-kernel.hoon`: kernel-building helpers against the host kernel.
- `bin/`: the optional Node transport sidecar and its isolated runner.

## Install

### What you need

- **A host ship.** A planet or a star with a real Azimuth identity, because
  moons are children of their host. A comet can't have moons, and a fake ship
  only works offline.
- **Kernel `[%zuse 408]`.** `+vats %base` shows it under `/sys/kelvin`. The desk
  declares only 408, so a ship already on 409 or later can't install it yet.
- **A network transport.** Use the patched runtime (recommended), or run the
  Node sidecar after installing the desk. Stock Vere has no native UDP-Lick.
- **Memory headroom.** Every moon lives inside the host's memory. Start the
  host with a larger loom (step 2).

### 1. Optional: build the native-transport runtime

This is the recommended transport. If you keep stock Vere, skip to step 3 and
start the sidecar after the desk is installed. Building the fork needs Zig
0.15.2 (`brew install zig`, or see the fork's `INSTALL.md`). There are no
prebuilt releases.

```sh
git clone https://github.com/GlueWear/vere.git
cd vere
zig build -Doptimize=ReleaseFast
```

The binary is `zig-out/<target>/urbit`, for example
`zig-out/aarch64-macos-none/urbit`.

### 2. Run the host on the patched runtime

Skip this step when using stock Vere with the sidecar. Otherwise stop the host
with `|exit`, then start it with the new binary and a larger loom:

```sh
/path/to/vere/zig-out/aarch64-macos-none/urbit --loom 34 /path/to/pier
```

- **Later starts.** On boot, Vere copies itself into the pier as `.run`, so
  after this you can start the host with `/path/to/pier/.run --loom 34`.
- **Loom size.** `--loom 34` reserves 16 GB of address space, not memory. The
  default (`--loom 31`, 2 GB) fills up after a few moons.
- **Runtime version.** The fork is based on Vere 4.6. Don't use it on a pier
  that has already run a newer runtime.
- **Networking.** Nothing to set up and no port forwarding. Each moon gets its
  own UDP port and keeps its NAT mapping open with STUN. To pin ports instead,
  see `LICK_UDP` in [NO-SIDECAR.md](NO-SIDECAR.md).

### 3. Install the desk

This repository holds more than the desk (the console's source, ops scripts and
docs). Clay rejects files it has no marks for, so copy only the desk itself.
Don't copy `desk.ship`.

In the host's Dojo:

```hoon
|new-desk %theseus
|mount %theseus
```

From this repository, adjusting the pier path:

```sh
cp -R app gen lib mar sur ted web desk.bill desk.docket-0 sys.kelvin /path/to/pier/theseus/
```

Back in the Dojo:

```hoon
|commit %theseus
|install our %theseus
+vats %theseus
```

`+vats` should show `/desk/bill: ~[%theseus %theseus-pyre %theseus-ui]`.

The console is at `http://localhost:<port>/apps/theseus` (log in as the host).
If the host runs `%landscape`, it also appears as a Theseus tile there.

### 4. Optional: open moon apps in a browser

Opening Landscape (or any app) on a moon needs the web gateway. The gateway
gives each moon its own address, `http://<moon>.localhost:<port>`.

1. Install [Caddy](https://caddyserver.com/docs/install), e.g.
   `brew install caddy`.
2. Start the gateway:
   - **macOS:** run `THESEUS_PIER=/path/to/pier ops/theseus-gateway install`.
     It runs at login and restarts if it fails. If the pier is on an external
     drive, macOS asks once for Full Disk Access for the gateway's helper; the
     command prints the steps.
   - **Linux:** no service setup is provided yet. Run
     `THESEUS_PIER=/path/to/pier ops/theseus-gateway run` under your own
     service manager.
3. If the pier's folder isn't named after the ship, also set
   `THESEUS_SHIP=~your-ship`. The gateway runs the pier's `.run` to talk to
   the ship.
4. Check that the console's **Gateway** view shows it running. Details are in
   [ARCHITECTURE.md](ARCHITECTURE.md), "Moon web apps and the web gateway".

You don't need Node when using native UDP-Lick. The built console
(`web/theseus.html`) is committed; Node is otherwise needed only for the
fallback sidecar or console development (`ui/`, see
[MANAGEMENT-UI.md](MANAGEMENT-UI.md)).

## Boot A Virtual Moon

From the console, click **Boot moon**:

- Choose any of the host's desks to put on the moon. Desks are copied from the
  host, so nothing is downloaded.
- For each desk, choose whether it takes updates from the host or from the
  ship the host got it from.
- A status bar shows the boot, then each desk installing, until the moon is
  ready.

The moon's Dojo opens as a terminal: click it and type. Its camera button holds
the moon's snapshots: take one, or restore an earlier one.

**Boot Fleet** creates a named group of 1-64 generated child moons with the
same desk plan. The folder persists before its members boot, so an interrupted
boot can resume with **Boot missing moons**. Expand the folder for each moon's
normal controls; the folder itself pauses, resumes, snapshots, or removes all
of its booted members together.

Or in Dojo:

```hoon
:theseus|init-moon ~dostex-dolten-dilpun
:theseus|dojo ~dostex-dolten-dilpun "+vats"
:theseus|dojo ~dostex-dolten-dilpun "(add 2 2)"
```

Replace `~dostex-dolten-dilpun` with a moon of your host. The generator creates
and registers resident moon keys through the host's Jael, then boots the virtual
moon with `%dawn`.

## Boot A Virtual Planet

This path is experimental and intended for real live-net testing with a fresh
planet identity, i.e. a `%duke` ship. Do not run a normal Vere pier for the same
planet at the same time.

The host must already know the planet's Azimuth state, and you must supply the
planet's normal `.key` file atom. Theseus reads `rift`, `life`, and the public
key from host Jael, checks that the keyfile feed matches the public key, and then
boots the virtual planet with `%dawn`.

```hoon
:theseus|init-planet ~sampel-palnet 0w...
:theseus|dojo ~sampel-palnet "+vats"
```

## Optional Node Transport Sidecar

The sidecar gives virtual ships live networking on a host running stock Vere.
It may also run alongside the patched runtime: pyre probes native UDP-Lick for
each moon, uses native when the runtime answers, and falls back to the connected
sidecar otherwise. Starting a sidecar later clears the cached choices so the
next packets are probed again.

The simplest setup is the console's **Sidecar** view. It downloads a standalone
`theseus-sidecar.mjs` with its JavaScript dependency already bundled, generates
the current fleet's `theseus-moons.json`, and builds the run command after you
enter the local pier path and host Ames port. It requires Node.js 20 or newer.

The preferred sidecar IPC is the noun Lick socket at
`<pier>/.urb/dev/theseus-pyre/ames`. Eyre remains available as a compatibility
fallback. The sidecar still uses the `--moon` option name for any single virtual
ship; use `--moons-map` for a fleet.

### Sidecar Setup

Do not run `npm ci` inside a mounted desk: Clay will try to commit
`node_modules/`. Use the runner, which installs dependencies under the system temp directory and launches a copied sidecar from there.

For a fleet, create a JSON map from each virtual ship name to its decimal `@p`,
then find the host Ames/Mesa UDP port. The sidecar binds one consecutive UDP
port per ship, beginning at `--bind`:

```json
{
  "~dostex-dolten-dilpun": "123456789"
}
```

Start the sidecar after `%theseus-pyre` is running, adjusting paths, ships and
ports. `--gateway-num` is the host's decimal `@p`; it keeps host-bound traffic
on the configured loopback route even after a moon learns a direct lane.

```bash
node bin/transport-sidecar-runner.mjs \
  --lick-socket /path/to/pier/.urb/dev/theseus-pyre/ames \
  --moons-map /path/to/moons.json \
  --gateway dolten-dilpun=127.0.0.1:55430 \
  --gateway-num 1234567890 \
  --bind 0.0.0.0:41237
```

Packet-by-packet logs are off by default. Add `--packet-log` temporarily when
diagnosing traffic.

For older setups without noun Lick IPC, use the Eyre channel instead. Find the
host HTTP port and `+code`, omit `--lick-socket`, and pass the login options:

- host: `~dolten-dilpun`
- HTTP: `http://localhost:8081`
- Ames/Mesa UDP: `55430`
- virtual moon: `~dostex-dolten-dilpun`
- sidecar UDP bind: `0.0.0.0:41237`

```bash
node bin/transport-sidecar-runner.mjs \
  --url http://localhost:8081 \
  --ship dolten-dilpun \
  --code <host-code> \
  --moon dostex-dolten-dilpun \
  --gateway dolten-dilpun=127.0.0.1:55430 \
  --bind 0.0.0.0:41237
```

Use a real numeric Ames port, never a placeholder such as `REAL_AMES_PORT`.

Then test from Dojo:

```hoon
:theseus|dojo ~dostex-dolten-dilpun "|hi ~zod"
```

Success looks like:

```text
"~dostex-dolten-dilpun: hi ~zod successful"
```

The sidecar logs should show parsed packets like:

```text
OUT ... sndr=@p:<moon-number> rcvr=~zod ...
IN  ... sndr=~zod rcvr=@p:<moon-number> ...
```

That is the live-net proof: the packet leaves as the virtual ship and returns
from `~zod` to that virtual ship.

Sidecar startup now fails early for malformed route ports, for example
`--gateway dolten-dilpun=127.0.0.1:REAL_AMES_PORT`. If a bind port is busy, use
`lsof -nP -iUDP:<port>` to find the existing process or choose another port.
Direct live-net mode should bind `0.0.0.0:<port>`; loopback binds are only for
local experiments.

The same path was verified for a real virtual planet:

```text
"~tadtus-tinluc: hi ~zod successful"
; ~tadtus-tinluc is your neighbor
```

### Sidecar galaxy-via-gateway mode

(Unrelated to the web gateway.) `transport-sidecar.mjs` also supports:

```bash
--galaxy-via-gateway
```

This sends galaxy-bound packets to the host Ames port instead of directly to
`<galaxy>.urbit.org`. It is useful for experiments, but it is not the current
proven live-net path. In testing it showed host/sidecar packet flow, but direct
mode was the path that produced `hi ~zod successful`.

## Development Direction

- Measure Landscape and channel behavior inside moons; tune pyre's HTTP path.
- Live acceptance of the remaining console flows on a disposable moon:
  snapshot/restore, remove, Landscape install on a fresh moon.
- Hosting: a documented public proxy setup (wildcard DNS, TLS) for the
  console's Hosting mode.
- Runtime: correct the version string to name the fork's commit; propose the
  UDP-Lick transport upstream.
- Virtual planets: finish the `init-planet` path on the new transport.
