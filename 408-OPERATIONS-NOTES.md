# Theseus on `%zuse 408`: current operations and open validation

This note records the current, proven bring-up procedure and the remaining
validation work. It is intentionally conservative: the current demo fleet is
working, but snapshot restore has not yet been established as safe for normal
networked application use.

## Host Azimuth seeding

Fresh virtual moons initially load the public Azimuth snapshot bundled with
`%base`. On the current 408 stack that snapshot is substantially behind the
host. The moon's `%eth-watcher` then asks the configured Ethereum RPC service
for a 100,000-block log range, while that service accepts at most 10,000
blocks. The result is a repeating `range 100000 exceeds limit of 10000` error.

`gen/theseus/seed-azimuth.hoon` copies the host's current materialized Azimuth
state into an already-booted moon through the standard typed `%azimuth-poke`
`%load` path. This avoids changing the host's `%base` desk or patching the 408
kernel.

Current provisioning order:

1. Run `:theseus|init-moon ~<moon>`.
2. Wait until the initial `%base`/`%kids` merge and bootstrap activity settle.
3. Run `:theseus|seed-azimuth ~<moon>`.
4. Verify `+azimuth/block` and `|hi ~zod` from the moon.
5. Install and configure applications.

Seeding during `init-moon` was tested and rejected: the asynchronous public
snapshot load can finish later and overwrite the newer host state. Production
automation must trigger seeding from a real post-bootstrap readiness condition,
not from a fixed delay.

## Snapshot restore remains under test

The snapshot implementation now drains pending work, pauses the moon, captures
the full virtual Arvo state, and reinitializes runtime shims on restore. A
controlled snapshot/kill/restore test preserved desks and `|hi ~zod` worked.

However, an earlier restored fleet could reach Ames peers while Noltbook
Cover/Gossip messages between the host and moons did not arrive. Freshly booted
moons later passed the same bidirectional application test. Host Azimuth seeding
addresses stale chain state, but it does not by itself prove that rolled-back
Ames flows, Gall subscriptions, or application protocol state recover when
remote peers have continued forward.

Before snapshot recycling is used for production or relied upon for demos, run
this controlled test with a sacrificial moon:

1. Establish baseline bidirectional Noltbook/Cover traffic and plugin state.
2. Pause and snapshot the moon.
3. Resume it and create identifiable post-snapshot traffic.
4. Kill and restore the snapshot.
5. Seed Azimuth from the host again.
6. Confirm the expected local rollback, app/pal/code state, `|hi`, bidirectional
   Cover traffic, and plugin artifacts.
7. Repeat the restore to test idempotence.

Until that passes, prefer freshly initialized moons for the demo fleet and
treat snapshots as experimental recovery points rather than production-safe
backups.

## Current demo routing

The tracked mignes deployment maps the new pool candidates `~dozful`,
`~dozpen`, `~dozsyt`, `~dozdur`, and `~dozwep`. Broker login codes and assignment
state remain server-side, gitignored deployment secrets and must not be added to
Git.
