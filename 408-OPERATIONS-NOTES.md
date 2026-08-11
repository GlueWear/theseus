# Theseus 408 Operations Notes

This file records the current known-good live-moon baseline and the remaining
hardening work.

## Known-Good Live-Net Baseline

Host under test:

- host ship: `~dolten-dilpun`
- virtual moon: `~dostex-dolten-dilpun`
- HTTP: `http://localhost:8081`
- Ames/Mesa UDP: `55430`
- sidecar bind: `0.0.0.0:41237`

Install and boot:

```hoon
|commit %theseus
|install our %theseus
:theseus|init-moon ~dostex-dolten-dilpun
:theseus|dojo ~dostex-dolten-dilpun "+vats"
```

Start sidecar through the runner, so dependencies install in the system temp directory instead of
inside the mounted desk:

```bash
node bin/transport-sidecar-runner.mjs \
  --url http://localhost:8081 \
  --ship dolten-dilpun \
  --code <host-code> \
  --moon dostex-dolten-dilpun \
  --gateway dolten-dilpun=127.0.0.1:55430 \
  --bind 0.0.0.0:41237
```

Live-net verification:

```hoon
:theseus|dojo ~dostex-dolten-dilpun "|hi ~zod"
```

Observed success:

```text
"~dostex-dolten-dilpun: hi ~zod successful"
```

Sidecar proof lines included:

```text
OUT ... sndr=@p:<moon-number> rcvr=~zod ...
IN  ... sndr=~zod rcvr=@p:<moon-number> ...
```

This proves direct live-net transport through the sidecar, not just local host
traffic.

Operational checks before starting sidecar:

- use the actual host Ames/Mesa UDP port, not `REAL_AMES_PORT` or another placeholder
- for direct live-net, bind `0.0.0.0:<free-port>`
- if a port is busy, check it with `lsof -nP -iUDP:<port>`
- avoid `npm ci` in a mounted desk; use `bin/transport-sidecar-runner.mjs`

## Direct Mode vs Gateway Mode

Direct mode is the known-good live-net path:

```bash
--bind 0.0.0.0:41237
```

No `--galaxy-via-gateway`.

Gateway mode:

```bash
--galaxy-via-gateway
```

routes galaxy-bound packets to the host Ames port. It produced local sidecar ↔
host Ames traffic, but it did not prove live-net delivery. Keep it as an
experiment, not the default production path.

## Verified Virtual Planet Live-Net Run

On `~dolten-dilpun`, `%theseus` booted a real virtual planet from a normal
`.key` file atom:

```hoon
:theseus|init-planet ~tadtus-tinluc 0w...
:theseus|dojo ~tadtus-tinluc "(add 2 2)"
:theseus|dojo ~tadtus-tinluc "+vats"
```

Observed:

```text
"~tadtus-tinluc: 4"
"~tadtus-tinluc: %base"
"~tadtus-tinluc: hi ~zod successful"
; ~tadtus-tinluc is your neighbor
```

Transport used direct live-net mode through the sidecar runner. Any ordinary
Vere pier for `~tadtus-tinluc` must remain stopped while the virtual planet is
running.

## Stale `/sys` Issue

The initial install failure on `~dolten-dilpun` came from stale vendored `/sys`
files inside the desk. `%base` and `%theseus` had the same kelvin 408, but
important files such as `gall`, `clay`, and `lull` had different mugs. Copying
the host's current 408 `/sys` into the desk recovered install and boot.

Current baseline still vendors `/sys`. This is intentional until the kernel
boundary is refactored. Do not replace the vendored files casually; keep them in
sync with the target kelvin when testing.

## Current Hardening Backlog

1. Eyre channel pressure

   Live transport works, but packet bursts can still produce:

   ```text
   eyre: clogged on theseus-transport-... for 1
   ```

   The sidecar now ACKs string and numeric event IDs and coalesces immediate
   ACKs, but this path still needs load testing and better startup/channel ID
   logging.

2. Sidecar operation

   Use `bin/transport-sidecar-runner.mjs` so npm dependencies install under the system temp directory instead of inside the mounted desk. Add clearer
   docs or commands for finding:

   - host HTTP port
   - host Ames/Mesa UDP port
   - host `+code`
   - free sidecar UDP bind port

3. Kernel boundary

   Move Arvo/Clay private type usage behind `lib/theseus-kernel.hoon`. Avoid
   partial hand-written Clay or Arvo molds. The failed `%sueseht` shim experiment
   showed this is brittle.

4. Network install

   Long-term product goal: `%theseus` should install over the network without
   users manually copying host `/sys` into the desk. This likely requires
   runtime kernel scries/building behind a stable internal API.

5. Vere integration

   The sidecar proves the transport shape. The future production design should
   move this transport seam into Vere so virtual moons can use live Ames without
   a Node sidecar.

## Virtual Planet Path

`%theseus` now has an experimental real-planet boot path:

```hoon
:theseus|init-planet ~sampel-palnet 0w...
```

The atom argument is the planet's normal `.key` file atom. The app does not
register keys in host Jael for planets. It reads `rift`, `life`, and public key
from host Jael/Azimuth, verifies the supplied keyfile feed derives that public
key, then boots `%dawn` with those continuity values.

Operational rule: never run a normal Vere pier and a Theseus virtual pier for the
same real planet at the same time.
