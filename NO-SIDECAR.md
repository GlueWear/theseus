# Theseus transport selection

**Status: native UDP-Lick in use on `~siglup-narwet`; sidecar fallback tested
with a live multi-moon fleet. Experimental.** Native transport was developed on
branch `udp-lick-transport`; adaptive selection is on `support_sidecar`.

See [the hardening checkpoint](HARDENING.md) for the Siglup live-network baseline,
runtime fingerprint, memory observations, and remaining validation gates.

## What this branch does

Theseus prefers **UDP-backed Lick ports in the runtime** and can fall back to
the external Node transport sidecar (`bin/transport-sidecar.mjs`). The choice is
ephemeral and made per guest:

1. Pyre opens `/utp/<ship>` and probes the native path on first outbound traffic.
2. A native connection or inbound packet selects native UDP-Lick.
3. A missing native port, or a probe timeout while the sidecar is connected,
   selects the sidecar.
4. A later sidecar connection clears cached choices and causes another probe.

This lets the same desk run unchanged on a patched or stock Vere host. The
sidecar may safely be present on a patched host; confirmed native traffic wins.

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

## Native UDP-Lick runtime

Native transport requires the UDP-Lick runtime:
**GlueWear/vere `main`** (commit `09b1224`, developed on `theseus-udp-lick`; see
its `NO-SIDECAR.md`). Running build: SHA-256 `a5b8bdcc…e1b8` (see
[HARDENING.md](HARDENING.md)). Each guest gets an OS-assigned UDP port on first
use and no configuration is needed. Guests that need a fixed port (for example a
router port-forward) use a `LICK_UDP` map, which always takes precedence, e.g.:
```
LICK_UDP="theseus-pyre/utp/~sondel-baltel-bidlys=39990,theseus-pyre/utp/~sonrup-baltel-bidlys=39991,..." \
  ./urbit <pier>
```

Stock Vere instead needs the optional sidecar. Prefer its noun Lick connection
to `/theseus-pyre/ames`; the older Eyre subscription/poke transport remains as
a compatibility fallback. See the sidecar section in [README.md](README.md).

## Proven live
A moon under Theseus sent `|hi ~zod` over its own UDP port and got a reply, with
**no sidecar running**. Since per-guest STUN, moons also reach their host and
its sponsor star on the same network, and install desks over Ames. The sidecar
fallback has separately carried outbound and inbound Ames packets for multiple
moons in a live fleet on a stock host.

## Base
Built on `stage2-clay-off-compile-time` (the host-kernel-portable Theseus).
