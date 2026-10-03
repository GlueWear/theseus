# Theseus no-sidecar transport

**Status: in use on `~siglup-narwet`; experimental.** Developed on branch
`udp-lick-transport`; now on `main`.

See [the hardening checkpoint](HARDENING.md) for the Siglup live-network baseline,
runtime fingerprint, memory observations, and remaining validation gates.

## What this branch does
Makes Theseus carry its guest ships' network traffic through **UDP-backed Lick
ports in the runtime**, replacing the external Node transport sidecar
(`bin/transport-sidecar.mjs`).

`app/theseus-pyre.hoon`, per guest ship, now:
- spins one Lick port **`/utp/<ship>`** — lazily, on that guest's first outbound
  packet (idempotent, so no persistent state);
- spits the outbound as `[kind lane(s) blob]` tagged `%send` (Ames, single lane) or
  `%push` (Mesa, lane list);
- routes the inbound soak (`%heer` mesa / `%hear` ames) on wire `/utp/<ship>` back
  into `%theseus` as `%mesa-inbound` / `%ames-inbound [who lane blob]`.
- closes that guest's Lick port with `%shut` when Theseus kills the guest;
  pausing or snapshotting a guest does not close its port;
- passes the guest's Ames sponsorship chain (`%saxo` effect) to its port as
  `[%saxo sponsors]`, so the runtime runs STUN to the guest's galaxy from the
  guest's own socket, and feeds the `%stun` results back into the guest's Ames
  (`%ames-stun` in `%theseus`). This keeps the guest's NAT mapping open, which
  galaxies need to relay packets to it, exactly as for a stock ship.

## ⚠️ Requires a patched runtime
This does **nothing** on stock Vere. It requires the UDP-Lick runtime:
**GlueWear/vere `main`** (commit `09b1224`, developed on `theseus-udp-lick`; see
its `NO-SIDECAR.md`). Running build: SHA-256 `a5b8bdcc…e1b8` (see
[HARDENING.md](HARDENING.md)). Each guest gets an OS-assigned UDP port on first
use and no configuration is needed. Guests that need a fixed port (for example a
router port-forward) use a `LICK_UDP` map, which always takes precedence, e.g.:
```
LICK_UDP="theseus-pyre/utp/~sondel-baltel-bidlys=39990,theseus-pyre/utp/~sonrup-baltel-bidlys=39991,..." \
  ./urbit <pier>
```

## Proven live
A moon under Theseus sent `|hi ~zod` over its own UDP port and got a reply, with
**no sidecar running**. Since per-guest STUN, moons also reach their host and
its sponsor star on the same network, and install desks over Ames.

## Base
Built on `stage2-clay-off-compile-time` (the host-kernel-portable Theseus).
