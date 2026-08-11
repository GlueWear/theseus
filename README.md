# Theseus

`%theseus` runs virtual Urbit ships inside a host ship. The current product target
is virtual moons that can boot, run Dojo, and talk on live Ames through a small
Node transport sidecar. Longer term, the sidecar transport should move into Vere.

This repository is the canonical Theseus product repo. The older exploratory
history lives in `GlueWear/theseus-prototype`.

## Current Status

Verified on `[%zuse 408]`:

- `%theseus` and `%theseus-pyre` install and run from a `%theseus` desk.
- `:theseus|init-moon` boots a resident virtual moon with real generated keys.
- `:theseus|dojo` can run commands inside the virtual moon.
- The Node sidecar can subscribe to `%theseus-pyre /ames/outbound`.
- Direct sidecar UDP mode can send virtual moon Ames packets to live net and
  receive replies.
- A virtual moon successfully completed `|hi ~zod` over live net.

Known current limitations:

- The desk still vendors `/sys` files. This is intentional for the current
  baseline; stale vendored `/sys` was the original install failure, and removing
  this dependency needs a careful kernel-boundary refactor.
- The sidecar is still required for live Ames transport.
- Eyre channel pressure can still produce `eyre: clogged ...` messages during
  packet bursts. Live transport worked despite this, but it needs hardening.
- Direct live-net mode needs a reachable UDP bind port. In the proven local run,
  `0.0.0.0:41237` received replies from `~zod`.
- `--galaxy-via-gateway` exists as an experiment, but it has not proven live-net
  delivery. Direct mode is the known-good path.

## Repository Layout

- `app/theseus.hoon`: virtual ship state manager and control API.
- `app/theseus-pyre.hoon`: runtime bridge for virtual IO effects.
- `gen/theseus/`: Dojo generators for init, moon init, kill, cache, snapshot,
  restore, and commands.
- `sur/theseus.hoon`: shared types for events, effects, actions, and updates.
- `lib/theseus-kernel.hoon`: current runtime kernel-building helpers.
- `bin/transport-sidecar.mjs`: live Ames UDP sidecar.
- `bin/echo-sidecar.mjs`: synthetic transport/fact-loop helper.
- `sys/`: vendored 408 kernel files required by the current baseline.

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
/desk/bill: ~[%theseus %theseus-pyre]
```

## Boot A Virtual Moon

```hoon
:theseus|init-moon ~dostex-dolten-dilpun
:theseus|dojo ~dostex-dolten-dilpun "+vats"
:theseus|dojo ~dostex-dolten-dilpun "(add 2 2)"
```

Replace `~dostex-dolten-dilpun` with a moon of your host. The generator creates
and registers resident moon keys through the host's Jael, then boots the virtual
moon with `%dawn`.

## Sidecar Setup

Install Node dependencies once:

```bash
npm ci
```

Find the host HTTP port, Ames/Mesa UDP port, and host `+code`. In the proven run:

- host: `~dolten-dilpun`
- HTTP: `http://localhost:8081`
- Ames/Mesa UDP: `55430`
- virtual moon: `~dostex-dolten-dilpun`
- sidecar UDP bind: `0.0.0.0:41237`

Start the known-good direct live-net sidecar:

```bash
node bin/transport-sidecar.mjs \
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

That is the live-net proof: the packet leaves as the virtual moon and returns
from `~zod` to that virtual moon.

## Gateway Mode

`transport-sidecar.mjs` also supports:

```bash
--galaxy-via-gateway
```

This sends galaxy-bound packets to the host Ames port instead of directly to
`<galaxy>.urbit.org`. It is useful for experiments, but it is not the current
proven live-net path. In testing it showed host/sidecar packet flow, but direct
mode was the path that produced `hi ~zod successful`.

## Development Direction

Near-term hardening:

- Reduce or eliminate Eyre channel clogging under packet bursts.
- Add clearer sidecar startup/channel IDs to match Eyre clog logs.
- Keep `node_modules/` out of Git and Clay commits.
- Document port discovery and live-net verification commands.
- Keep `%sueseht`-style experiment desks separate from canonical `%theseus`.

Kernel/product refactor:

- Encapsulate Arvo/Clay coupling behind `lib/theseus-kernel.hoon`.
- Stop hand-modeling private kernel/vane molds.
- Eventually remove vendored `/sys` so network install works cleanly on matching
  kelvins.
- After sidecar behavior is solid, move transport into Vere so Theseus no longer
  needs Node for live Ames.
