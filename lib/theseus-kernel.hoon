::  Clay's vane core is imported here (compile-time) so the main agent no longer
::  has to.  This centralizes the last private-Clay dependency in one lib.  A
::  later stage replaces it with a runtime host-%base build (see +build), after
::  which this /= import and the desk-local /sys can both go away.  /sys/arvo is
::  still imported by app/theseus.hoon, so the desk keeps vendoring /sys for now.
::
/=  clay-core  /sys/vane/clay
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
--
