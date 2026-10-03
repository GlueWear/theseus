# Theseus

`%theseus` runs virtual Urbit ships inside a host ship. The current product target
is virtual moons that boot, run Dojo, talk on live Ames through their own UDP
transport in a patched Vere runtime, and are managed from a web console.

This repository is the canonical Theseus product repo. The older exploratory
history lives in `GlueWear/theseus-prototype`.

## Documentation

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces fit: agents, runtime transport, web gateway, console; operations and troubleshooting. Start here. |
| [MANAGEMENT-UI.md](MANAGEMENT-UI.md) | The console and web gateway in detail: API, security, build, deploy, verification. |
| [NO-SIDECAR.md](NO-SIDECAR.md) | The UDP-Lick transport and the runtime it needs. |
| [HARDENING.md](HARDENING.md) | Runtime builds and fingerprints, memory notes, remaining gates. |
| [THESEUS-REFERENCE.md](THESEUS-REFERENCE.md) | `%theseus` generators, scries and threads. |
| [408-OPERATIONS-NOTES.md](408-OPERATIONS-NOTES.md) | Earlier sidecar-era operations notes (historical). |

## Current Status

Verified on `[%zuse 408]` (October 2026, host `~siglup-narwet`):

- `%theseus`, `%theseus-pyre` and `%theseus-ui` install and run from a
  `%theseus` desk; the desk uses the host kernel (no vendored `/sys`).
- Virtual moons boot with real generated keys (`:theseus|init-moon` or the
  console) and run Dojo.
- Each moon talks on live Ames from its own UDP socket, run by the patched Vere
  (`GlueWear/vere`, branch `main`): automatic ports, per-moon STUN keepalive. No
  Node sidecar. Moons have completed `|hi ~zod`, reached the host and its
  sponsor star, and installed `%landscape`.
- The web console at `/apps/theseus` (also a Landscape tile): fleet health,
  boot/pause/resume/remove, a Dojo per moon, snapshots and restore, each moon's
  `+code`, and one-click Landscape per moon.
- Moon web apps open on their own origin, `http://<moon>.localhost:<port>`,
  through a local Caddy gateway that `ops/theseus-gateway` runs under launchd.

Known limits (details in ARCHITECTURE.md):

- Requires the patched runtime; stock Vere has no UDP-Lick.
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
- `bin/`: the legacy Node transport sidecar (not needed with the patched
  runtime).

## Install Desk

Mount or copy this repository as a desk named `%theseus` in a host pier.

In Dojo:

```hoon
|commit %theseus
|install our %theseus
+vats %theseus
```

Expected bill:

```text
/desk/bill: ~[%theseus %theseus-pyre %theseus-ui]
```

The host must run the patched runtime (see NO-SIDECAR.md). For moon web apps,
also start the web gateway (see ARCHITECTURE.md, "Web gateway").

## Boot A Virtual Moon

From the console (**Boot moon**), or in Dojo:

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

## Legacy: Node Transport Sidecar

Before the patched runtime, a Node sidecar carried virtual ships' Ames traffic
over Eyre. It is kept for reference and experiments; it is not needed with the
UDP-Lick runtime, and should not run alongside it. It uses the `--moon` option
name for any virtual ship.

### Sidecar Setup

Do not run `npm ci` inside a mounted desk: Clay will try to commit
`node_modules/`. Use the runner, which installs dependencies under the system temp directory and launches a copied sidecar from there.

Find the host HTTP port, Ames/Mesa UDP port, and host `+code`. In the proven run:

- host: `~dolten-dilpun`
- HTTP: `http://localhost:8081`
- Ames/Mesa UDP: `55430`
- virtual moon: `~dostex-dolten-dilpun`
- sidecar UDP bind: `0.0.0.0:41237`

Start the known-good direct live-net sidecar from the mounted desk or repo. Use a real numeric Ames port, never a placeholder such as `REAL_AMES_PORT`:

```bash
node bin/transport-sidecar-runner.mjs \
  --url http://localhost:8081 \
  --ship dolten-dilpun \
  --code <host-code> \
  --moon dostex-dolten-dilpun \
  --gateway dolten-dilpun=127.0.0.1:55430 \
  --bind 0.0.0.0:41237
```

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
