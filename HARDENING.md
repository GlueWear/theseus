# Theseus hardening checkpoint

Recorded 2026-10-02. This is an engineering baseline, not a production-readiness
claim. The initial inspection was read-only. The runtime was subsequently rebuilt,
installed after a clean shutdown, and the user reported a successful restart.
The UDP-close change is also staged in the mounted desk; its Dojo activation and
live kill/re-init acceptance have not been independently confirmed. No live moon
was killed to test it automatically.

## Working installation

- Host: `~siglup-narwet`, Zuse 408, Hoon 135.
- Pier: `/Volumes/DEV/Enviorment/urbit-dev/ships/siglup-narwet`.
- Host HTTP: `http://localhost:8083`.
- Guest: `~sampel-siglup-narwet`, UDP port 41237.
- Canonical Theseus repo: `/Volumes/DEV/Enviorment/urbit-dev/ships/zod/theseus`.
- Remote: `https://github.com/GlueWear/theseus.git`.
- Working branch: `udp-lick-transport`.
- Initial deployed code: `5fd1849725813d9262169429f12364ccbefad00e`.
- `main` remains at `9ac7852`; it is not this no-sidecar release.
- The mounted desk includes the `%kill` -> `%shut` change in this checkpoint.
  There is no vendored `/sys`, Node dependency directory, or sidecar in the
  deployment.

Runtime source checkout:

- Repo: `/Volumes/DEV/Enviorment/urbit-dev/ships/zod/vere`.
- Branch: `theseus-udp-lick`.
- Inspection HEAD: `76f93c4404423fce6f83606394a20cd129f76c97`.
- Docked executable: `siglup-narwet/.run`.
- Version string: `urbit 4.6-8ddc4b7`.
- Initial binary SHA-256: `b1eb662517e1641f8418fb61bf4f299cd8f3dc115f6fff08d3760557accbcbf6`.
- Installed rebuild SHA-256: `eb1f5c81a38c46f7e91b28537e764779111f06363229074f136e69dac151a5de`.
- Rebuild source: inspection HEAD plus the fix/tests now committed as `b5dab2e`.
- Compiler: Zig 0.15.2; flags: `-Doptimize=ReleaseFast -j2` (default pace `once`).
- Local build receipt, source patch, tests, and rollback executable are under
  `zod/.toolchain/theseus-runtime-20261002/`; binaries are not committed to Git.

The version string still names an upstream commit, not the fork HEAD, because
the existing build script derives the revision from a reflog buffer. That upstream
commit alone does not contain UDP-Lick. Use the source revision and binary hash
above to identify this build. Future release builds must correct the version
generation and record a clean source commit, compiler, flags, and binary hash.

Known working launch configuration (only use after the existing ship has shut
down cleanly; never start a second process against the same pier):

```sh
LICK_UDP='theseus-pyre/utp/~sampel-siglup-narwet=41237' \
  /Volumes/DEV/Enviorment/urbit-dev/ships/siglup-narwet/.run --loom 34
```

User-observed acceptance evidence:

```text
lick: udp transport /theseus-pyre/utp/~sampel-siglup-narwet bound 0.0.0.0:41237
~sampel-siglup-narwet: (add 2 2) -> 4
~sampel-siglup-narwet: hi ~zod successful
```

This demonstrates an external round trip through the native transport. It does
not measure boot latency, long-term memory use, restart reliability, or scaling.
`l2-sig-failed` also appeared in the boot transcript; its cause remains unverified.

## Memory observations

Read-only macOS `vmmap -summary` samples, local EDT timestamps. No synthetic
traffic or moon spawning was performed during these samples. Background events
continued, and an isolated C test was built on the same machine.

| Process | PID | First sample | Physical footprint | Later sample | Physical footprint | Peak |
| --- | --- | --- | --- | --- | --- | --- |
| Controller | 93127 | 08:24:44 | 68.6M | 08:34:36 | 68.7M | 71.2M |
| Worker | 93128 | 08:24:48 | 498.2M | 08:33:17 | 505.3M | 655.2M |

Units above are reported by vmmap. Both processes launched at 08:09:00.
The `.vere.lock` PID was the worker, not the controller. Rediscover PIDs after
every restart before measuring.

The 16 GB loom reservation is not consumed physical memory. RSS alone is also
misleading on this machine because much of the footprint is swapped/compressed.
The worker's mapped-file contribution changed during the interval. These two
samples cannot establish a leak rate or exclude a leak; measure native heap,
loom/live nouns, retained snapshots, and file mappings separately.

## Confirmed native allocation defect

`vere/pkg/vere/io/lick.c` allocates a temporary path with `_lick_it_path()` in
both `_lick_ef_spit()` and `_lick_ef_shut()`. Neither function released that
lookup string on success or missing-port paths. The separately owned port name
is not the same allocation.

This leaks one string per Lick send effect, including effects that emit no UDP
packet, and one per close request. It is not yet evidence that this explains
all reported memory growth. Lick runs in the controller; worker growth needs
independent investigation.

The original docked binary was inspected with `otool -tvV`. Its inlined spit path calls
`_lick_it_path` at `0x100016e34`, then reaches both missing-port and UDP dispatch
paths without freeing the lookup. The shut lookup at `0x100016e90` has the same
omission. These addresses apply only to the initial binary hash recorded above.

A four-free fix and `pkg/vere/lick_tests.c` were added to the Vere
checkout. The test follows the existing include-driver C test pattern and
tracks Lick C allocations separately from the noun loom and libuv. It covers
10,000 existing-port spits/duplicate spins, missing-port send/close, and 100
two-port asynchronous UDP close cycles. The empty lane list sends no traffic.
It does not cover the full Unix-stream lifecycle or real UDP buffer completion.

From the Vere checkout:

```sh
../.toolchain/zig-aarch64-macos-0.15.2/zig build lick-test -Doptimize=ReleaseFast -j2
```

The original source fails with `expected 0 live allocations, got 1` after the
first spit. The fixed source passes. The full runtime rebuild and the Lick, Ames,
and Newt regression suites passed. Disassembly of the rebuilt executable confirms
the missing frees are present. The rebuilt `.run` was installed atomically after
both ship processes exited, preserving a hash-verified rollback executable.
The user reported that restart looked good after receiving the existing-moon
evaluation and external `|hi` test commands; a new raw acceptance transcript was
not captured. A post-fix memory soak remains outstanding.

## Guest UDP close implementation

The `%kill` branch in `app/theseus-pyre.hoon` now returns a Lick `%shut` card
for `/utp/<ship>` after deleting the guest's existing shim entries. This is the
same name used by `%spin` and `%spit`; Gall supplies the `%theseus-pyre` prefix.
The host's Lick vane removes the owner and sends `%shut` to Vere, whose existing
UDP handler unlinks the port and closes it asynchronously. No Arvo changes or
new runtime protocol are required.

Additional native regression coverage binds actual ephemeral loopback UDP ports
for two guests and repeats 100 cycles. It verifies that the port is occupied
before close, is reusable immediately after close (before the close callback),
that repeated close is harmless, that the other guest keeps its binding, and
that all tracked names are released after callbacks. `zig build lick-test
-Doptimize=ReleaseFast -j2` passes. This is native-handler coverage, not yet a
live Gall-to-Lick acceptance test. Hoon compilation remains the Dojo commit gate.

The modified agent file is staged at
`siglup-narwet/theseus/app/theseus-pyre.hoon`. Activate it in the host Dojo:

```hoon
|commit %theseus
+vats %theseus
:theseus|dojo ~sampel-siglup-narwet "(add 2 2)"
```

Use a disposable guest for the destructive acceptance test: confirm its UDP
binding with `lsof`, kill it through Theseus, confirm the binding disappears,
then re-initialize it and verify local evaluation and an external successful
`|hi`. Do not kill the working guest unless discarding its state is intended.
This change does not retroactively close ports left by earlier kills, close
paused guests, or add timer/HTTP cancellation. Those remain separate work.
The C allocation fix is included in the installed rebuild. The agent's new
`%shut` request works with both that rebuild and the previous UDP-Lick fork.

## Remaining gates

1. **Runtime ownership and provenance.** The leak fix is built and installed.
   Correct version generation and test UDP success/error callbacks, port collisions,
   malformed `LICK_UDP`, Unix setup failure, and repeated close/reopen on a test
   host before claiming production readiness. Socket setup failures must not kill the host
   or free memory still referenced by libuv.
2. **Guest lifecycle cleanup.** The UDP `%shut` change above is implemented and
   native-tested; live acceptance is pending. Pyre still emits no cancellation
   of outstanding Behn/Iris work when deleting its maps.
   Verify whether late callbacks recreate entries, then fix and test teardown
   and restore together. Repeated spawn/kill must release sockets/requests and
   return live allocations to a stable baseline. Named snapshots intentionally
   retain state and already have `%delete-snap`; measure them separately.
3. **Performance and soak measurement.** Record cold-cache and warm-cache
   spawn timings, time to local `(add 2 2)`, and time to external `hi successful`
   separately. Record sample count, median/p95, host responsiveness, packet
   count, and per-process memory. Init currently builds runtime kernel material
   and drains events synchronously; profile before changing it. Preserve rich
   snapshot vase types: never store the opaque result type of a poke's tail.
   Also bound or expose paused queues, snapshot retention, and pending I/O.
4. **Operator workflow, then UI.** Remove manual per-moon environment-map
   setup from the intended distribution workflow, expose readable health and
   resource metrics, test snapshot/restore and restart, and then build the
   monitoring/spawn/snapshot UI on those tested operations. A UI must not hide
   an incomplete boot or label an accepted `|hi` as a successful round trip.

No boot duration has been measured yet. Do not turn the earlier successful
transcript into a guessed timing target or claim that the memory issue is solved.
