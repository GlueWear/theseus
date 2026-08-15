::  Theseus kernel plumbing.  NO compile-time /sys import: Clay's private molds
::  (raft/dojo/room) are obtained at RUNTIME from the host's clay.ker.  (slam
::  (clay-src our now) *ship) yields the clay vane vase, whose subject carries the
::  stdlib and those molds, and every clay read/build/mutation is a slap/slam gate
::  against that vane (see +clay-src / +cache-desks / +cache-from-host / +seed-clay).
::
|%
+$  weft  [lal=@tas num=@ud]
+$  wynn  (list weft)
+$  kernel
  $:  arvo=vase
      hoon=vase
      lull=vase
      zuse=vase
      ames=vase
      behn=vase
      clay=vase
      dill=vase
      eyre=vase
      gall=vase
      iris=vase
      jael=vase
      khan=vase
  ==
::
++  sys-path
  |=  [our=ship now=@da]
  ^-  path
  /(scot %p our)/base/(scot %da now)/sys
::
++  build
  |=  [our=ship now=@da]
  ^-  kernel
  =/  sys  (sys-path our now)
  :*  arvo=.^(vase %ca (welp sys /arvo/hoon))
      hoon=.^(vase %ca (welp sys /hoon/hoon))
      lull=.^(vase %ca (welp sys /lull/hoon))
      zuse=.^(vase %ca (welp sys /zuse/hoon))
      ames=.^(vase %ca (welp sys /vane/ames/hoon))
      behn=.^(vase %ca (welp sys /vane/behn/hoon))
      clay=.^(vase %ca (welp sys /vane/clay/hoon))
      dill=.^(vase %ca (welp sys /vane/dill/hoon))
      eyre=.^(vase %ca (welp sys /vane/eyre/hoon))
      gall=.^(vase %ca (welp sys /vane/gall/hoon))
      iris=.^(vase %ca (welp sys /vane/iris/hoon))
      jael=.^(vase %ca (welp sys /vane/jael/hoon))
      khan=.^(vase %ca (welp sys /vane/khan/hoon))
  ==
::  +clay-src: the host's compiled Clay vane source (the |= our ... gate) as a
::  vase.  Slam it with a ship to get the clay vane, whose subject carries the
::  stdlib and Clay's private molds -- the runtime replacement for the old
::  compile-time /sys/vane/clay import.  (Same scry +build makes for clay.ker.)
::
++  clay-src
  |=  [our=ship now=@da]
  ^-  vase
  .^(vase %ca (welp (sys-path our now) /vane/clay/hoon))
::
++  runtime-wynn
  |=  ker=kernel
  ^-  wynn
  :~  [%zuse ;;(@ud q:(slap zuse.ker limb+%zuse))]
      [%lull ;;(@ud q:(slap lull.ker limb+%lull))]
      [%arvo ;;(@ud q:(slap arvo.ker limb+%arvo))]
      [%hoon ;;(@ud q:(slap hoon.ker limb+%hoon-version))]
  ==
::
++  mugs
  |=  ker=kernel
  ^-  (list [term @])
  :~  [%arvo (mug q.arvo.ker)]
      [%hoon (mug q.hoon.ker)]
      [%lull (mug q.lull.ker)]
      [%zuse (mug q.zuse.ker)]
      [%ames (mug q.ames.ker)]
      [%behn (mug q.behn.ker)]
      [%clay (mug q.clay.ker)]
      [%dill (mug q.dill.ker)]
      [%eyre (mug q.eyre.ker)]
      [%gall (mug q.gall.ker)]
      [%iris (mug q.iris.ker)]
      [%jael (mug q.jael.ker)]
      [%khan (mug q.khan.ker)]
  ==
::  +cache-desks: the desks in a cache (a packed +raft vase).  Read-only: builds
::  a desk-lister gate against a runtime clay vane (its subject carries the stdlib
::  + raft mold), then slams the cache raft into it.  No compile-time clay type.
::
++  cache-desks
  |=  [our=ship now=@da cache=vase]
  ^-  (set desk)
  =/  vane  (slam (clay-src our now) !>(*@p))
  !<((set desk) (slam (slap vane !,(*hoon |=(r=_ruf ~(key by dos.rom.r)))) cache))
::  +snap-raft: a running virtual ship's Clay raft, as a vase, sliced straight
::  out of its %clay vane (+clay-vane-of gives a self-typed vane vase carrying the
::  stdlib + raft mold, so `ruf` resolves via slap).
::
++  snap-raft
  |=  snap=vase
  ^-  vase
  (slap (clay-vane-of snap) !,(*hoon ruf))
::  +snap-raft-desks: just the desk set of a moon's raft, for compare/list.
::  Mole-wrapped so a vaneless / empty snap (a paused or half-built pier, whose
::  van map has no %clay vane) yields the empty set instead of crashing: on an
::  empty map ~(got by ...) has a void value type and faults, while ~(key by ...)
::  does not -- the same asymmetry +arvo-vitals guards against.  An empty result
::  correctly excludes such a pier from any "does it have these desks?" check.
::
++  snap-raft-desks
  |=  snap=vase
  ^-  (set desk)
  =/  got
    %-  mole
    |.  !<((set desk) (slap (clay-vane-of snap) !,(*hoon ~(key by dos.rom.ruf))))
  ?~(got ~ u.got)
::  +seed-clay: build a fresh virtual ship's %clay vane, seeded from a cached raft,
::  as a vase ready to hand to +make-arvo.  Slam the host clay source (`src` =
::  clay.ker) with the ship to get the vane, then slam the cache raft into a gate
::  that installs it as `ruf` with the %kids desk dropped (a %kids raft breaks
::  first boot).  Runtime replacement for (clay-vane who) / =. ruf / del %kids.
::
++  seed-clay
  |=  [src=vase who=ship cache=vase]
  ^-  vase
  =/  clay  (slam src !>(who))
  ::  Drop %kids from the cached raft with a gate whose RESULT is just a raft
  ::  (cheap), then splice it into the vane's `ruf` by NOUN surgery at ruf's axis.
  ::  A `=. ruf.clay` (i.e. `+>(ruf r)`) would type-substitute into the whole clay
  ::  vane type on every boot -- minutes of runtime each -- so we never do a
  ::  vane-typed mint.  The axis comes from ruf's read-nock; legs compile to
  ::  `[0 ax]` or axis-composed `[7 [0 a] ...]`, which we fold into one axis.
  =/  clean=vase
    %+  slam
      (slap clay !,(*hoon |=(r=_ruf r(dos.rom (~(del by dos.rom.r) %kids)))))
    cache
  =/  nk  q:(~(mint ut p.clay) %noun !,(*hoon ruf))
  =/  ax=@
    |-  ^-  @
    ?+  nk  ~|([%theseus-seed-clay-ruf-nock nk] !!)
      [%0 @]         +.nk
      [%7 [%0 @] *]  (peg +.+<.nk $(nk +>.nk))
      [%11 * *]      $(nk +>.nk)
    ==
  clay(q .*([q.clay q.clean] [%10 [ax %0 3] %0 2]))
::  +cache-from-moon: build a build-cache (packed raft vase) from a running virtual
::  ship's raft, copying its .ran and the requested desks' domes.  The build runs
::  as a gate slapped against the source moon's own clay vane (stdlib + raft/dojo
::  molds via +clay-vane-of), with the desk list slammed in.
::
++  cache-from-moon
  |=  [snap=vase desks=(list desk)]
  ^-  vase
  %+  slam
    %+  slap  (clay-vane-of snap)
    !,  *hoon
    |=  dez=(list @tas)
    =/  out  *raft
    ::  408 Clay no longer exposes .fad/flow in raft; keep default empty fad.
    =.  ran.out  ran.ruf
    =.  dos.rom.out
      |-  ^+  dos.rom.out
      ?~  dez  dos.rom.out
      =.  dos.rom.out
        %+  ~(put by dos.rom.out)  i.dez
        =/  dj  *dojo
        ~|  [%theseus-cache-desk-missing i.dez]
        =.(dom.dj dom:(~(got by dos.rom.ruf) i.dez) dj)
      $(dez t.dez)
    out
  !>(desks)
::  +cache-from-host: build a build-cache (packed raft vase) from the HOST ship's
::  Clay -- scry its rang and per-desk domes (public clay types), then build the
::  raft in a gate slapped against a runtime clay vane, slamming in the scried
::  rang + (desk . dome) pairs.  Needs our/now for the %cx scries + clay source.
::
++  cache-from-host
  |=  [our=ship now=@da desks=(list desk)]
  ^-  vase
  ::  408 Clay no longer exposes /flow as a public scry; keep default empty fad.
  =/  rng   .^(rang:clay %cx /(scot %p our)//(scot %da now)/rang)
  =/  cone  .^(cone:clay %cx /(scot %p our)//(scot %da now)/domes)
  =/  dznz=(list [desk dome:clay])
    %+  turn  desks
    |=  d=desk
    ~|  "{<d>} doesn't exist on {<our>}"
    [d (~(got by cone) [our d])]
  =/  vane  (slam (clay-src our now) !>(*@p))
  %+  slam
    %+  slap  vane
    !,  *hoon
    |=  [r=_ran:*raft dz=(list [@tas _dom:*dojo])]
    =/  out  *raft
    =.  ran.out  r
    =.  dos.rom.out
      |-  ^+  dos.rom.out
      ?~  dz  dos.rom.out
      =.  dos.rom.out
        %+  ~(put by dos.rom.out)  -.i.dz
        =/  dj  *dojo
        =.(dom.dj +.i.dz dj)
      $(dz t.dz)
    out
  !>([rng dznz])
::  +pack-snap-raft: a running virtual ship's whole raft, packed as a cache vase
::  (== the raft vase +snap-raft already produces).  Used by %rebuild to re-make
::  the cache from the ship it rebuilt on.
::
++  pack-snap-raft  snap-raft
::  +inject-raft: splice a source raft (carried as a packed cache vase) into a
::  running virtual ship's %clay vane -- copy its .ran and rebuild the named desks'
::  domes (let/hit reset).  Runs as a mutator gate slapped against the target's own
::  clay vane (stdlib + raft/dojo molds via +clay-vane-of); the source raft + desk
::  list are slammed in as one [raft (list desk)] sample via +slop, then the
::  modified vane is re-installed into the snap by +put-clay-vane.
::
++  inject-raft
  |=  [who=ship snap=vase cache=vase desks=(set desk)]
  ^-  vase
  =/  mutator
    %+  slap  (clay-vane-of snap)
    !,  *hoon
    |=  [src=_ruf dez=(list @tas)]
    ::  408 Clay no longer exposes .fad/flow in raft; keep default empty fad.
    %=    +>
        ran.ruf  ran.src
        dos.rom.ruf
      |-  ^+  dos.rom.ruf
      ?~  dez  dos.rom.ruf
      =.  dos.rom.ruf
        %+  ~(put by dos.rom.ruf)  i.dez
        =/  dj  *dojo
        ~|  [%theseus-rebuild-desk-missing i.dez]
        =/  dm  dom:(~(got by dos.rom.src) i.dez)
        =.  let.dm  0
        =.  hit.dm  *_hit.dm
        ::  TODO might have to bunt some other stuff
        =.(dom.dj dm dj)
      $(dez t.dez)
    ==
  (put-clay-vane snap (slam mutator (slop cache !>(~(tap in desks)))))
::  +poke-arvo: run one unix-event against a virtual ship's saved Arvo snapshot
::  (carried as a self-typed vase).  On success returns the new snapshot vase and
::  the effect list; on failure returns which stage broke -- %poke (the event
::  crashed Arvo) or %snap (the result could not be re-cast) -- with its stack.
::  Lifted verbatim from the +plow inner loop in app/theseus.hoon so the agent
::  stops naming poke:arvo-adult / Arvo-private types directly.  Both crash casts stay
::  inside +mule so a bad packet drops instead of taking down the caller.
::
++  poke-arvo
  |=  [snap=vase now=@da ue=*]
  ^-  (each [snap=vase effects=(list ovum)] [stage=?(%poke %snap) =tang])
  ::  resolve the snapshot's own +poke gate via self-typed slap -- no compile-time
  ::  Arvo-private types (proven resolvable on a healthy snap).
  =/  poke-result=(each vase tang)
    (mule |.((slym (slap snap !,(*hoon poke)) [now ue])))
  ?:  ?=(%| -.poke-result)  [%| %poke p.poke-result]
  ::  poke:arvo is typed `^-  ^`, so the new Arvo (+.q) is statically *.  Re-vase
  ::  it by reusing the INCOMING snap's type part -- NOT (slot 3 ...), which would
  ::  persist an opaque [* noun] snap and poison the pier.  Guard: never store an
  ::  opaque snap; an opaque snap also fails the slap above (%poke), so this is the
  ::  defensive backstop for the %snap stage.
  ?:  ?=(%noun p.snap)  [%| %snap ~[leaf+"theseus-poke-opaque-snap"]]
  =/  new-snap=vase  [p.snap +.q.p.poke-result]
  [%& new-snap ;;((list ovum) -.q.p.poke-result)]
::  +peek-arvo: read a virtual ship's Arvo namespace.  Takes the snapshot vase
::  plus a fully-built peek argument [lyc=gang pov=path omen] (the exact sample
::  of ~(peek le:part ...) in arvo.hoon) and returns the read cage, recovering
::  and re-vasing the data exactly as the old inline +scry/+remote-scry did.
::  The caller still builds the omen (via de-omen for local paths, or an %ax
::  beam for remote scries); only the le:part peek itself moves here, so the
::  agent stops naming le:part / pit / vil / sol / Arvo-private types on this path.
::
++  peek-arvo
  |=  [snap=vase arg=[lyc=gang pov=path =omen]]
  ^-  (unit (unit cage))
  ::  run the le:part peek against the self-typed snap -- no compile-time Arvo type.
  =/  res=(unit (unit [mark *]))
    !<  (unit (unit [mark *]))
    (slam (slap snap !,(*hoon ~(peek le:part [[pit vil] sol]))) !>(arg))
  ?~  res  ~
  ?~  u.res  res
  ::  positional access (-.=mark, +.=data): the recovered [mark *] has no p/q faces.
  ``[-.u.u.res !<(vase [-:!>(*vase) +.u.u.res])]
::  +make-arvo: construct a fresh virtual ship's Arvo snapshot from the
::  runtime host-%base kernel.  It starts from arvo.ker's adult Arvo core, sets
::  the same soul as the old compile-time constructor, asserts all nine vanes,
::  and returns a self-typed vase sourced from the runtime Arvo -- never [* noun].
::
++  make-arvo
  |=  [who=ship ker=kernel files=(axal (cask)) clay=vase]
  ^-  vase
  =/  vanes=(list (pair term vase))
    :~  [%ames (slam ames.ker !>(who))]
        [%behn (slam behn.ker !>(who))]
        [%clay clay]
        [%dill (slam dill.ker !>(who))]
        [%eyre (slam eyre.ker !>(who))]
        [%gall (slam gall.ker !>(who))]
        [%iris (slam iris.ker !>(who))]
        [%jael (slam jael.ker !>(who))]
        [%khan (slam khan.ker !>(who))]
    ==
  =/  builder=vase
    %+  slap  arvo.ker
    !,  *hoon
    |=  [who=@p fat=* lul=vase zus=vase wyn=* vns=*]
    =/  new  ..^load:+>
    =.  sol.new
      ^-  soul
      :*  [who *@da *@uvJ]
          &
          :_  |
          :-  [~.nonce /theseus]
          ;;(wynn wyn)
          :^  ;;((axal (cask)) fat)  lul  zus
          %-  ~(gas by *(map term vane))
          %+  turn  ;;((list (pair term vase)) vns)
          |=([t=term v=vase] [t v *worm])
      ==
    new
  =/  snap=vase
    (slam builder !>([who files lull.ker zuse.ker (runtime-wynn ker) vanes]))
  =/  vit  (arvo-vitals snap)
  ?~  vit
    ~|([%theseus-init-vane-build-failed who %empty] !!)
  =/  wanted=(set term)
    (sy ~[%ames %behn %clay %dill %eyre %gall %iris %jael %khan])
  ?.  =(wanted vanes.u.vit)
    ~|([%theseus-init-vane-build-failed who vanes.u.vit] !!)
  snap
::  +arvo-vitals: a snapshot's identity + vane-name set, for +health-of.  Wrapped
::  in a mole so a corrupt/empty snap yields ~ instead of crashing.
::
++  arvo-vitals
  |=  snap=vase
  ^-  (unit [our=ship vanes=(set term)])
  ::  operate against the self-typed snap via slap -- no compile-time Arvo type.
  =/  got  (mole |.((slap snap !,(*hoon [our.sol ~(key by van.mod.sol)]))))
  ?~  got  ~
  `;;([ship (set term)] q.u.got)
::  +clay-vane-of: the %clay vane's vase inside a snapshot, for the raft reader.
::
++  clay-vane-of
  |=  snap=vase
  ^-  vase
  ::  read the %clay vane vase from the self-typed snap -- no compile-time Arvo type.
  !<(vase (slap snap !,(*hoon vase:(~(got by van.mod.sol) %clay))))
::  +put-clay-vane: replace the %clay vane's vase inside a snapshot, returning
::  the modified snapshot as a vase.  For the cache/rebuild inject path.
::
++  put-clay-vane
  |=  [snap=vase clay=vase]
  ^-  vase
  ::  replace the %clay vane in the self-typed snap via a slap'd mutator gate, then
  ::  re-pair the modified Arvo noun with the incoming snap's type (p.snap) so the
  ::  result stays Arvo-typed, never opaque -- same guarantee as poke-arvo's store.
  =/  mut=vase
    (slap snap !,(*hoon |=(cv=vase +>(van.mod.sol (~(put by van.mod.sol) %clay [cv *worm])))))
  ::  slam unwraps one vase level, so pass !>(clay) -- the whole clay vane vase
  ::  reaches the gate as cv (a vase), matching the make-arvo/peek-arvo slam
  ::  convention (slam always takes !>(argument)).
  [p.snap q:(slam mut !>(clay))]
::  +wish-arvo: evaluate hoon text against a snapshot's Arvo (the %wish hook).
::
++  wish-arvo
  |=  [snap=vase txt=@]
  ^-  *
  ::  call the snapshot's own +wish arm via slap -- no compile-time Arvo type.
  q:(slam (slap snap !,(*hoon wish)) !>(txt))
::  +peek-path-arvo: local scry -- turn a (timestamp-adjusted) scry path into an
::  omen via de-omen, then peek it.  Same result shape as the old inline path.
::
++  peek-path-arvo
  |=  [snap=vase =path]
  ^-  (unit (unit cage))
  ?~  mon=(de-omen path)  ~
  (peek-arvo snap [~ / u.mon])
--
