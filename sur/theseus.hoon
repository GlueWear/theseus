::  We do not use the traditional arvo event naming scheme (ova/ovum).
::  Every card is either an `event` or an `effect`.
::  theseus-events are associated withs ships, unix-events are not
::  'timed' events/effects include the time of the event, used for logs
::
|%
::  Structural copy of +lane:pact from 408 %lull packet serialization.
::  We keep it local because +pact is not directly name-resolvable from this sur.
::
+$  mesa-lane  $@  @ux
               $%  [%if p=@ifF q=@udE]
                   [%is p=@isH q=@udE]
               ==
::
::  like unix-event:pill-lib but for all tasks
::
+$  unix-event
  %+  pair  wire
  $%  :: for boot sequence, see $wisp:arvo
      ::
      [%wack p=@]
      [%what p=(list (pair path (cask)))]
      [%whom p=ship]
      [%wyrd p=vere]
      [%verb p=(unit ?)]
      [%boot ? $%($>(%fake task:jael) $>(%dawn task:jael))]
      ::  for all other inputs
      ::  TODO: should we move to note-arvo instead?
      ::
      task-arvo
  ==
::
+$  unix-timed-event  [tym=@da ue=unix-event]
::
+$  unix-effect
  %+  pair  wire
  $%  ::  vere effects (%gifts) that %theseus-pyre can handle
      ::
      [%send p=lane:ames q=@]                 ::  ames send packet
      [%doze p=(unit @da)]                    ::  behn set timer
      [%ergo p=@tas q=mode:clay]              ::  clay ???
      [%blit p=(list blit:dill)]              ::  dill console effect
      [%thus p=@ud q=(unit hiss:eyre)]        ::  eyre ???
      [%response =http-event:http]            ::  eyre response
      [%request id=@ud request=request:http]  ::  iris request
      [%poke-ack p=(unit tang)]               ::  gall agent poke-ack
      ::  theseus specific effect
      ::
      [%kill ~]                               :: stop ship
  ==
::
+$  unix-both
  $%  [%event unix-timed-event]
      [%effect unix-effect]
  ==
::
+$  theseus-event    [who=ship ue=unix-event]
+$  theseus-events   [who=ship utes=(list unix-timed-event)]
+$  theseus-effects  [who=ship ufs=(list unix-effect)]
+$  theseus-effect   [who=ship uf=unix-effect]
+$  theseus-boths    [who=ship ub=(list unix-both)]
::
+$  action
  $%  ::  create or delete a ship
      ::
      [%init-ship who=ship cache=@tas]
      ::  like %init-ship but boots %dawn with a real key (ring) so the
      ::  virtual ship signs with a network-valid identity, AND registers the
      ::  public key with our (the host's) Jael as this moon's key -- the
      ::  self-sufficient resident-moon path.  key = sec:ex ring, pub = pub:ex.
      [%init-moon who=ship cache=@tas pub=pass key=@]
      [%kill-ships hers=(list ship)]
      ::  snapshot manipulation
      ::
      [%snap-ships =path hers=(list ship)]
      [%restore-snap =path]
      [%delete-snap =path]
      ::  pausing
      ::
      [%unpause-ships hers=(list ship)]
      [%pause-ships hers=(list ship)]
      ::  see +wish in arvo.hoon
      ::
      [%wish her=ship p=@t]
      ::  inject state into a running gall app
      ::
      [%slap-gall her=ship dap=term =vase]
      ::  sidecar -> virtual Ames packet injection.  The sidecar should not need
      ::  to know Theseus' internal newt wire; it supplies target moon, lane, blob.
      [%ames-inbound who=ship lane=lane:ames blob=@]
      ::  Mesa-era inbound packet injection. 408 Ames receives pact packets via
      ::  %heer with a pact lane, distinct from legacy %hear/+.lane.
      [%mesa-inbound who=ship lane=mesa-lane blob=@]
      ::  sidecar smoke-test path.  This proves the outbound fact -> sidecar ->
      ::  inbound poke loop without claiming the blob is a valid Ames packet.
      [%ames-test-inbound who=ship from=ship blob=@]
      ::  quick-build/caching
      ::
      ::    create a new cache, update it with %rebuild
      ::      name  : name of this cache
      ::      who   :  ~       use host ship's cache
      ::            : [~ ship] use theseus ship's cache
      ::      desks : list of desks to import for this cache
      [%cache name=@tas who=(unit ship) desks=(list desk)]
      ::    build ontop of a cache already in use
      ::      name  : name of this cache
      ::      park  : TODO should be $>(%park task:clay)
      [%rebuild name=@tas park=task-arvo]
  ==
::
::  Small sidecar-facing subset of $action.  Kept separate so the JSON mark
::  never has to clam through $action's `%rebuild park=task-arvo` arm, whose
::  runtime coercion crashes.  Widened to $action at compile time in on-poke.
+$  ames-in
  $%  [%ames-inbound who=ship lane=lane:ames blob=@]
      [%mesa-inbound who=ship lane=mesa-lane blob=@]
      [%ames-test-inbound who=ship from=ship blob=@]
  ==
::
+$  behn-pier  next-timer=(unit @da)
+$  eyre-pier  cookie=(unit @t)
+$  iris-pier  http-requests=(set @ud)
::
++  update
  $@  ~
  $%  [%snaps snap-paths=(list path)]
      [%snap-ships =path ships=(list ship)]
      [%ships ships=(list ship)]
      ::  Emitted by %theseus-pyre when a virtual ship's Ames produces a raw
      ::  packet send. This is the first bridge seam for an external sidecar.
      [%ames-outbound who=ship lane=lane:ames blob=@]
  ==
--
