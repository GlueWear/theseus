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
  =/  arvo-snap=_arvo-adult  !<(_arvo-adult snap)
  =/  poke-result=(each vase tang)
    (mule |.((slym [-:!>(poke:arvo-adult) poke:arvo-snap] [now ue])))
  ?:  ?=(%| -.poke-result)  [%| %poke p.poke-result]
  =/  snap-result=(each _arvo-adult tang)
    (mule |.(!<(_arvo-adult [-:!>(*_arvo-adult) +.q.p.poke-result])))
  ?:  ?=(%| -.snap-result)  [%| %snap p.snap-result]
  [%& !>(p.snap-result) ;;((list ovum) -.q.p.poke-result)]
--
