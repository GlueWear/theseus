# theseus (zuse 409 backport)

`%theseus` runs **virtualized Urbit ships inside a single host ship**. Each virtual
ship is a real, independent Arvo — its own identity, its own Clay/Gall, its own
agents and state — booted and driven from the host's dojo, with no extra piers
and no real ships booted. It is a descendant of Urbit's `%aqua` integration-test
system.

This repository is a **backport of [`sigilante/theseus`](https://github.com/sigilante/theseus)
to run on a `[%zuse 409]` host.** Upstream targets zuse 412–416.

---

## What theseus does

- Boots fake/virtual ships (`~pel`, `~dem`, …) **inside one running host ship**.
- Each virtual ship is a full Arvo: its own `our`, its own desks, agents, and
  event log. Inside `~pel`, `our.bowl` really is `~pel`.
- Copies host desks into a virtual ship and installs/runs them there.
- Drives virtual ships from the host: run dojo commands, poke agents, snapshot,
  restore, pause, kill.
- All in one OS process. No additional piers, no booting real network ships.

Virtual ships are **isolated**. They can talk to each other inside the aquarium,
but they have **no connection to the real Ames network** and cannot reach the
host as a network peer.

---

## Requirements & install

- A host ship at **`[%zuse 409]`**.
- Use a **throwaway ship, fake ship, or moon** — `%theseus` can breach; do not run
  it on a ship you care about.

With the desk mounted at `<pier>/theseus`:

```
|commit %theseus
|install our %theseus
```

## Usage

```
:theseus|init ~pel                            :: boot virtual ~pel (fresh %base)
:theseus|commit ~pel %groups                  :: copy host desk %groups into ~pel
:theseus|dojo ~pel "|install our %groups"     :: run a dojo command inside ~pel
:theseus|dojo ~pel "+vats"                     :: inspect ~pel
:theseus|poke ~wes ~pel %groups %noun !>('hi') :: poke ~pel's agent as if from ~wes
:theseus|kill ~pel                            :: destroy ~pel and its state
```

Additional generators are present but **not verified by us**: `snap`, `restore`,
`pause`, `unpause`, `cache`, `pass`, `rebuild`. See `THESEUS-REFERENCE.md` for
upstream's full API documentation.

---

## What changed for zuse 409

One functional fix, in `lib/theseus.hoon` (`++park`): upstream scries
`/cx/<desk>/rang` to fetch a desk's prebuilt cache, but `[%zuse 409]` Clay does
not expose that scry, so the push crashed (`bail`). We pass an empty `rang`
instead, and the virtual ship rebuilds the pushed desk from source. A stray
helper generator was also removed. The bundled kernel/base files under `sys/`,
`lib/`, `mar/`, `sur/` are the 409 versions.

---

## Testing status — what we have actually verified

On a live `~sampel-palnet` fake ship at `[%zuse 409]`:

**Verified working**

- `%theseus` builds, commits, and installs on the 409 host after the `park` fix.
- `:theseus|init ~pel` boots a virtual ship (its own `%base`, kelvin 409).
- `:theseus|commit ~pel %<desk>` pushes a host desk into the virtual ship.
- **`%dingy`** pushed and installed → `app status: running`.
- **`%groups`** pushed → **all 20 agents** (`%groups %chat %channels
  %channels-server %activity %contacts %notify %reel %profile %grouper …`)
  booted and `running`.
- `:groups +dbug %bowl` inside `~pel` returned a live bowl with **`our=~pel`**
  and live inter-agent subscriptions — confirming the virtual ship has its own
  identity and the pushed apps are functionally interconnected inside it.

**Not yet tested by us**

- Traffic **between two virtual ships** (e.g. `~pel` ↔ `~dem`). The internal
  routing hook is visible (`%not-plowing-events ~dem` appears when a booted ship
  references an unbooted one), but we have not booted a second ship to confirm
  message delivery.
- The `snap` / `restore` / `pause` / `unpause` / `cache` / `pass` / `rebuild`
  generators.
- Any real-network behavior.

**Known limits & gotchas we hit**

- **No real networking.** Virtual ships are isolated; `newt`/`turf`/http effects
  are dropped as `%unknown-effect`. They cannot reach the real Ames network or
  peer with the host.
- **Push a clean desk.** A host desk with a stale mount or a tombstoned source
  blob fails to push (`%posh-fail`, or `clay: commit failed, file tombstoned`).
  Use freshly-committed desks with a healthy mount. This is desk hygiene, not a
  theseus bug.
- Upstream notes aqua/theseus has historically been "not functional for many
  kelvins." Treat this as experimental.

---

## Provenance

`%aqua` (Urbit) → `uqbar-dao/theseus` →
[`sigilante/theseus`](https://github.com/sigilante/theseus) → this zuse-409 backport.

Original work is by those authors; this repository only backports to zuse 409
and documents what we tested. Upstream carries no license file — check
provenance before reuse.
