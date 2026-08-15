::  Clay's vane core is imported here (compile-time) so the main agent no longer
::  has to.  This centralizes the last private-Clay dependency in one lib.  A
::  later stage replaces it with a runtime host-%base build (see +build), after
::  which this /= import and the desk-local /sys can both go away.
::
/=  clay-core  /sys/vane/clay
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
::  +clay-vane: the host's Clay vane core, specialized to a ship.  Used to seed a
::  fresh virtual ship's Clay state at init: (clay-vane who) == the old inline
::  (clay-core who) the agent used to build.
::
++  clay-vane  clay-core
::  +clay-types: type source for Clay's private state molds (+raft/+dojo/+room),
::  which the agent still names to build and seed the virtual Clay cache.  Re-
::  exported here so app/theseus.hoon can drop its direct /sys/vane/clay import.
::
++  clay-types  (clay-core *ship)
::  +cache-desks: the desks present in a cache -- a packed +raft vase, as built
::  by the agent's +pack-raft (!>(raft)).  Read-only: recovers the raft with
::  compile-time +clay-types and returns just its desk set, so the agent can
::  answer "what desks are in this cache?" without naming +raft:clay-types or
::  +dos/+rom on the read path.  Mirrors the old inline +raft-desks . +unpack-raft.
::
++  cache-desks
  |=  cache=vase
  ^-  (set desk)
  ~(key by dos.rom:!<(raft:clay-types cache))
::  +snap-raft: a running virtual ship's Clay raft, recovered from its Arvo
::  snapshot -- pulls the %clay vane vase via +clay-vane-of and decodes it with
::  compile-time (tail clay-types).  The one place the agent's read/build paths
::  get a moon's raft, so app/theseus.hoon stops naming (tail clay-types)/ruf.
::
++  snap-raft
  |=  snap=vase
  ^-  raft:clay-types
  ruf:!<((tail clay-types) (clay-vane-of snap))
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
  =/  got  (mole |.(~(key by dos.rom:(snap-raft snap))))
  ?~(got ~ u.got)
::  +seed-clay: build a fresh virtual ship's %clay vane, seeded from a cached
::  raft, as a vase ready to hand to +make-arvo.  Specializes the host Clay vane
::  to the ship, installs the cached raft (recovered from the packed cache vase),
::  and drops the %kids desk (a %kids raft breaks first boot).  Byte-for-byte the
::  old inline init seeding -- (clay-vane who) / =. ruf.clay / del %kids -- lifted
::  out of app so the three init paths stop naming raft:clay-types / ruf / dos/rom.
::
++  seed-clay
  |=  [who=ship cache=vase]
  ^-  vase
  =/  clay  (clay-vane who)
  =.  ruf.clay  !<(raft:clay-types cache)
  =.  dos.rom.ruf.clay  (~(del by dos.rom.ruf.clay) %kids)
  !>(clay)
::  +cache-from-moon: build a build-cache (packed raft vase) from a running
::  virtual ship's raft, copying its .ran and the requested desks' domes.  Src
::  is only for the "desk doesn't exist" trace.  Byte-for-byte the old inline
::  %cache who=[~ ship] branch, lifted out of app so it stops naming
::  raft:clay-types / dojo:clay-types / dos/rom/ran/dom.
::
++  cache-from-moon
  |=  [src=ship snap=vase desks=(list desk)]
  ^-  vase
  =/  ruf  (snap-raft snap)
  =|  =raft:clay-types
  !>
  %=    raft
      ::  408 Clay no longer exposes .fad/flow in raft; keep default empty fad.
      ran  ran.ruf
      dos.rom
    |-
    ?~  desks  dos.rom.raft
    =.  dos.rom.raft
      %+  ~(put by dos.rom.raft)  i.desks
      =|  doj=dojo:clay-types
      ~|  "{<i.desks>} doesn't exist on {<src>}"
      =.  dom.doj  dom:(~(got by dos.rom.ruf) i.desks)
      doj
    $(desks t.desks)
  ==
::  +cache-from-host: build a build-cache (packed raft vase) from the HOST ship's
::  Clay, scrying its rang and per-desk domes.  Byte-for-byte the old inline
::  %cache who=~ branch, lifted out of app.  Needs our/now for the %cx scries.
::
++  cache-from-host
  |=  [our=ship now=@da desks=(list desk)]
  ^-  vase
  =|  =raft:clay-types
  ::  408 Clay no longer exposes /flow as a public scry; keep default empty fad.
  =.  ran.raft
    .^(rang:clay %cx /(scot %p our)//(scot %da now)/rang)
  =.  dos.rom.raft
    |-
    ?~  desks  dos.rom.raft
    =+  .^(=cone:clay %cx /(scot %p our)//(scot %da now)/domes)
    ~|  "{<i.desks>} doesn't exist on {<our>}"
    =/  =dome:clay  (~(got by cone) our i.desks)
    =.  dos.rom.raft
      %+  ~(put by dos.rom.raft)  i.desks
      =|  doj=dojo:clay-types
      =.  dom.doj  dome  doj
    $(desks t.desks)
  !>(raft)
::  +pack-snap-raft: a running virtual ship's whole raft, packed as a cache vase.
::  Used by %rebuild to re-make the cache from the ship it rebuilt on.  Replaces
::  the old inline (pack-raft raft:(pe i.all)).
::
++  pack-snap-raft
  |=  snap=vase
  ^-  vase
  !>((snap-raft snap))
::  +inject-raft: splice a source raft (carried as a packed cache vase) into a
::  running virtual ship's %clay vane -- copy its .ran and rebuild the named
::  desks' domes (let/hit reset), then re-vase the vane via +put-clay-vane.  Who
::  is only for the "desk doesn't exist" trace.  Byte-for-byte the old inline
::  %rebuild injection, lifted out of app so it stops naming (tail clay-types) /
::  dojo:clay-types / ran / dos/rom / put-clay-vane.
::
++  inject-raft
  |=  [who=ship snap=vase cache=vase desks=(set desk)]
  ^-  vase
  =/  raf  !<(raft:clay-types cache)
  =/  cay  !<((tail clay-types) (clay-vane-of snap))
  ::  408 Clay no longer exposes .fad/flow in raft; keep default empty fad.
  =.  ran.ruf.cay  ran.raf
  =.  dos.rom.ruf.cay
    =/  dl  ~(tap in desks)
    |-
    ?~  dl  dos.rom.ruf.cay
    =.  dos.rom.ruf.cay
      %+  ~(put by dos.rom.ruf.cay)  i.dl
      =|  doj=dojo:clay-types
      ~|  "{<i.dl>} doesn't exist on {<who>}"
      =/  dom  dom:(~(got by dos.rom.raf) i.dl)
      =.  let.dom  0
      =.  hit.dom  *(map aeon:clay tako:clay)
      ::  TODO might have to bunt some other stuff
      =.  dom.doj  dom
      doj
    $(dl t.dl)
  (put-clay-vane snap !>(cay))
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
