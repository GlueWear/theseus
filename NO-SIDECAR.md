# Theseus no-sidecar transport (`udp-lick-transport`)

**Status: experimental, for review.**

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

## ⚠️ Requires a patched runtime
This does **nothing** on stock Vere. It requires the UDP-Lick runtime:
**GlueWear/vere branch `theseus-udp-lick`** (see that branch's `NO-SIDECAR.md`).
Run the host on that binary with a `LICK_UDP` map — one UDP port per guest, e.g.:
```
LICK_UDP="theseus-pyre/utp/~sondel-baltel-bidlys=39990,theseus-pyre/utp/~sonrup-baltel-bidlys=39991,..." \
  ./urbit <pier>
```

## Proven live
A moon under Theseus sent `|hi ~zod` over its own UDP port and got a reply, with
**no sidecar running**.

## Base
PR is against `stage2-clay-off-compile-time` (the host-kernel-portable Theseus), so
the diff is only the transport change (`app/theseus-pyre.hoon`).
