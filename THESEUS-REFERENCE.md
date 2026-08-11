# `%theseus` Documentation

## [`%theseus` Contents](#theseus-documentation)
* [`%theseus` Quick Start](#theseus-quick-start)
* [`%theseus` Architecture](#theseus-architecture)
* [`%theseus` Inputs](#theseus-inputs)
* [`%theseus` Outputs](#theseus-outputs)
* [`%theseus` Threads](#theseus-threads)

# `%theseus` Documentation
Last updated as of June 05, 2023. For a video version of this documentation, watch [this](https://www.youtube.com/watch?v=-zD3xbCROQ8) video

## `%theseus` Quick Start
`%theseus` is not currently `|install`able over the network. To use it in your development flow, copy the code into the ship you are developing on (I would *not* reccomend putting this on a ship you do not want to breach - use a moon, comet, or fake ship).

Basic installation should be familiar to most - 
```
|new-desk %theseus
|mount %theseus
:: make sure to cp -RL urbit/pkg/theseus <PIER>/theseus (urbit/pkg to preserve symlinks)
|commit %theseus
|install our %theseus
```
Using `%theseus`:
```
:theseus|init ~nec                     :: initialize fake ~nec
:theseus|init ~bud                     :: initialize fake ~bud
:theseus|commit ~nec %foo              :: copy host desk %foo into ~nec
:theseus|dojo ~nec "|install our %foo" :: install %foo desk into ~nec
:theseus|dojo ~nec "=bar 5"            :: run a dojo command
:theseus|snap /baz ~[~nec ~bud]        :: take a snapshot of ~nec and ~bud named /baz
:theseus|restore /baz                  :: restore ~nec and ~bud to /baz state
:theseus|pause ~nec                    :: stop processing events for ~nec
:theseus|unpause ~nec                  :: resume processing events for ~nec
:theseus|kill ~nec                     :: remove ~nec and all it's state
:theseus|pass ~nec ...                 :: same as |pass - for experts only!
:theseus|cache %cax ~[%desk-1 %d2 ...] :: create a cache named %cax with %desk-1 and %d2 
```

## `%theseus` Workflow
### `:theseus|cache` : Quickly Initializing a ship with many desks
To quick boot many desks on a fake-ship, first make sure that the desks you want are installed on the host ship. For example, if we want to make a cache called `%cax` to quick boot `%desk-1`, `%desk-2` and `%desk-3`, those three desks *must* be installed on the host ship. Create the cache with this command:
```
:theseus|cache %cax ~[%desk-1 %desk-2 %desk-2]
```
To boot a ship with this cache:
```
:theseus|init ~nec, =cache %cax
```
And it will come preloaded with `%base`, `%desk-1`, `%desk-2`, and `%desk-3` - and boot *extremely* quickly.

### `:theseus|snap` : Taking Snapshots
Snapshots store the state of your fake ships so that you can return to them later
```
:theseus|snap /my/snaps/name ~[~nec ~bud ~wes ~rus]
```
To restore the snapshot:
```
:theseus|restore /my/snaps/name
```
NOTE: this will kill all running ships and restore *just* the ships in that snapshot - in this case, `~nec` `~bud` `~wes` and `~rus`

### Scries
You can scry into a `%theseus` ship. Anything that you can scry out of a normal ship, you can scry out of a `%theseus` ship.
```hoon
.^(my-mold %gx /=theseus=/i/~nec/gx/~nec/my-desk/0/some/path/my-mark/my-mark)
```
The scry path format is like this:  `/i/<THESEUS-SHIP>/<CARE>/<SHIP>/<DESK>/<CASE>/<PATH-GOES-HERE>`. Note that `<CASE>` gets automatically filled in with `now` - so if you want to put `0` or some arbitrary value there, you can.
Note:
1. All scries into `%theseus` ships must have a double mark at the end (e.g. `/noun/noun`, `/bill/bill`, etc.)
2. The `%theseus` ship and the [care](https://developers.urbit.org/reference/arvo/concepts/scry) must be specified at the start of the path.

There is also a convenience scry for `%gx` cares into agents running on `%theseus` ships:
```hoon
.^(mold %gx /=theseus=/~nec/myapp/my-path-goes-here/mark/mark)
```

### Remote Scry
Remote scry works on theseus ships!
```
:theseus|dojo ~nec "-keen [~bud /c/x/1/kids/ted/keen/hoon]"
```
NOTE: this feature has not been thoroughly tested - please message `~dachus-tiprel` with any errors

## `%theseus` Threads
`%theseus` tests are meant to be written as threads. Common functions for using threads live in `/lib/theseus/theseus.hoon`
NOTE: This documentation is outdated
```
;<  ~  bind:m  (init:theseus ~nec)
;<  ~  bind:m  (init:theseus ~bud)
;<  ~  bind:m  (commit:theseus ~[~nec ~bud] our %base now)
;<  ~  bind:m  (snap:theseus /my-snapshot ~[~nec~bud])
;<  ~  bind:m  (dojo:theseus ~nec "(add 2 2)")
;<  ~  bind:m  (poke:theseus ~nec ~bud %my-app %my-mark !>(%payload))
;<  ~  bind:m  (restore:theseus /my-snapshot) :: TODO this isn't written
```

# Architecture Documentation (Advanced)
`%theseus` simulates individual ships, handles their state, their I/O, and snapshots

`%theseus-pyre` is the virtual runtime for %theseus ships. It handles ames sends, behn timers, iris requests, eyre responses, and dojo outputs. Not all runtime functionality is implemented - just the most important pieces.

## `%theseus` inputs
Just like a normal ship, the only interface for interacting with a `%theseus` ship is to pass it `$task-arvo`s. Using raw `$task`s requires a good knowledge of `lull.hoon`, so the most common I/O is implemented in `/lib/theseus/theseus.hoon` and `/gen/theseus/` for your convenience.

## `%theseus` outputs
###  Effects
All `$unix-effect`s can be subscribed to by an app or thread. However, `%theseus-pyre` automatically handles the most important `$unix-effects` for you. Handling unix effects by yourself in an app/thread requires a good knowledge of `lull.hoon` - to look for a specific output, look at each vane's `$gift`s.
