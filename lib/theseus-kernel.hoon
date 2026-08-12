::  Clay's vane core is imported here (compile-time) so the main agent no longer
::  has to.  This centralizes the last private-Clay dependency in one lib.  A
::  later stage replaces it with a runtime host-%base build (see +build), after
::  which this /= import and the desk-local /sys can both go away.  /sys/arvo is
::  still imported by app/theseus.hoon, so the desk keeps vendoring /sys for now.
::
/=  clay-core  /sys/vane/clay
::  Arvo core imported here too, for the +poke-arvo execution path lifted out of
::  app/theseus.hoon (Phase 3a slice 1).  A later slice swaps this for the
::  runtime host-%base build (+build), after which /sys can go entirely.
::
/=  arvo-core  /sys/arvo
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
::  +arvo-adult: the host's adult Arvo core (type + value), recovered from the
::  imported arvo core.  Type source for a virtual ship's saved snapshot.
::
++  arvo-adult  ..^load:+>.arvo-core
::  +poke-arvo: run one unix-event against a virtual ship's saved Arvo snapshot
::  (carried as a self-typed vase).  On success returns the new snapshot vase and
::  the effect list; on failure returns which stage broke -- %poke (the event
::  crashed Arvo) or %snap (the result could not be re-cast) -- with its stack.
::  Lifted verbatim from the +plow inner loop in app/theseus.hoon so the agent
::  stops naming poke:arvo-adult / _arvo-adult directly.  Both crash casts stay
::  inside +mule so a bad packet drops instead of taking down the caller.
::
++  poke-arvo
  |=  [snap=vase now=@da ue=*]
  ^-  (each [snap=vase effects=(list ovum)] [stage=?(%poke %snap) =tang])
  ::  resolve the snapshot's own +poke gate via self-typed slap -- no compile-time
  ::  _arvo-adult (proven resolvable on a healthy snap).
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
::  agent stops naming le:part / pit / vil / sol / _arvo-adult on this path.
::
++  peek-arvo
  |=  [snap=vase arg=[lyc=gang pov=path =omen]]
  ^-  (unit (unit cage))
  =/  arvo-snap=_arvo-adult  !<(_arvo-adult snap)
  ?~  res=(~(peek le:part:arvo-snap [[pit vil] sol]:arvo-snap) arg)  ~
  ?~  u.res  res
  ``[p.u.u.res !<(vase [-:!>(*vase) q.u.u.res])]
::  +make-arvo: construct a fresh virtual ship's Arvo snapshot -- an adult Arvo
::  core with its soul set: identity, runtime version stamp, the host lull/zuse,
::  and a nine-vane map built from the runtime kernel.  Clay is passed in already
::  seeded and vased by the caller.  Lifted verbatim from the three init sites in
::  app/theseus.hoon so the agent stops naming soul / vane / worm / van.mod /
::  _arvo-adult / sol.  Asserts all nine vanes are present (never expose a
::  partial pier), then returns the snapshot as a vase.
::
++  make-arvo
  |=  [who=ship ker=kernel files=(axal (cask)) clay=vase]
  ^-  vase
  =/  new-snap=_arvo-adult  *_arvo-adult
  =.  sol.new-snap
    ^-  soul
    :*  [who *@da *@uvJ]                              ::  mien
        &                                            ::  fad
        :_  |                                        ::  zen
        :-  [~.nonce /theseus]
        (runtime-wynn ker)
        :^  files  lull.ker  zuse.ker                ::  mod
        %-  ~(gas by *(map term vane))               ::  van.mod
        :~  [%ames [(slam ames.ker !>(who)) *worm]]
            [%behn [(slam behn.ker !>(who)) *worm]]
            [%clay [clay *worm]]
            [%dill [(slam dill.ker !>(who)) *worm]]
            [%eyre [(slam eyre.ker !>(who)) *worm]]
            [%gall [(slam gall.ker !>(who)) *worm]]
            [%iris [(slam iris.ker !>(who)) *worm]]
            [%jael [(slam jael.ker !>(who)) *worm]]
            [%khan [(slam khan.ker !>(who)) *worm]]
    ==  ==
  =/  built=(set term)  ~(key by van.mod.sol.new-snap)
  =/  wanted=(set term)
    (sy ~[%ames %behn %clay %dill %eyre %gall %iris %jael %khan])
  ?.  =(wanted built)
    ~|([%theseus-init-vane-build-failed who built] !!)
  !>(new-snap)
::  +arvo-vitals: a snapshot's identity + vane-name set, for +health-of.  Wrapped
::  in a mole so a corrupt/empty snap yields ~ instead of crashing.
::
++  arvo-vitals
  |=  snap=vase
  ^-  (unit [our=ship vanes=(set term)])
  ::  operate against the self-typed snap via slap -- no compile-time _arvo-adult.
  =/  got  (mole |.((slap snap !,(*hoon [our.sol ~(key by van.mod.sol)]))))
  ?~  got  ~
  `;;([ship (set term)] q.u.got)
::  +clay-vane-of: the %clay vane's vase inside a snapshot, for the raft reader.
::
++  clay-vane-of
  |=  snap=vase
  ^-  vase
  ::  read the %clay vane vase from the self-typed snap -- no compile-time _arvo-adult.
  !<(vase (slap snap !,(*hoon vase:(~(got by van.mod.sol) %clay))))
::  +put-clay-vane: replace the %clay vane's vase inside a snapshot, returning
::  the modified snapshot as a vase.  For the cache/rebuild inject path.
::
++  put-clay-vane
  |=  [snap=vase clay=vase]
  ^-  vase
  =/  arvo-snap=_arvo-adult  !<(_arvo-adult snap)
  =.  van.mod.sol.arvo-snap
    (~(put by van.mod.sol.arvo-snap) %clay [clay *worm])
  !>(arvo-snap)
::  +wish-arvo: evaluate hoon text against a snapshot's Arvo (the %wish hook).
::
++  wish-arvo
  |=  [snap=vase txt=@]
  ^-  *
  ::  call the snapshot's own +wish arm via slap -- no compile-time _arvo-adult.
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
