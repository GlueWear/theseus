::  An ~~inferno~~ of virtual ships
::  Use with %theseus-pyre, the virtual runtime, for the best experience
::
::  Usage:
::  |start %zig %theseus
::  :theseus|init ~nec
::  :theseus|commit ~nec %base
::  :theseus|dojo ~nec "(add 2 2)"
::  :theseus|snap /my-snapshot ~[~nec ~bud]
::  :theseus|restore /my-snapshot
::  :theseus|pause ~nec
::  :theseus|unpause ~nec
::  :theseus|kill ~nec
::
/-  *theseus
/+  theseus=theseus,
    default-agent,
    pill=pill,
    dbug, verb, dingy, theseus-kernel
::
::  All Arvo/Clay kernel internals now come through lib/theseus-kernel, so this
::  agent imports no /sys files directly.  (theseus-kernel still holds the
::  compile-time /sys/vane/clay import for now.)
::
=>  |%
    ++  clay-types  clay-types:theseus-kernel
    ::  +fine-req-path: parse an inbound Ames blob; if it is a %fine REQUEST
    ::  packet, produce [requester sndr-tick rcvr-tick origin requested-path],
    ::  else ~.  Inlined from lull +sift-shot / +sift-wail because gall agents don't
    ::  expose lull's arms.  Header (low 32 bits, LE): bit2=req bit3=sam (loobean,
    ::  wire-bit 0 = yes); ranks at [7 2]/[9 2]; relayed at [31 1].
    ::  +is-fine-req: cheap header-only test -- is this a %fine REQUEST packet?
    ::  (req=yes bit2=0, sam=no bit3=1).  Distinct from fine-req-path, which
    ::  ALSO parses the scry path and can fail on request shapes we don't serve
    ::  yet.  A fine-request must NEVER be injected as %hear (ames bails), even
    ::  when we can't parse/serve it -- so the handler gates on this first.
    ++  is-fine-req
      |=  blob=@
      ^-  ?
      ::  Header-only fine request detector.  Good enough for smoke: drop fine
      ::  requests instead of injecting them as %hear while serve-fine is disabled.
      =/  header  (end 5 blob)
      &(=(0 (cut 0 [2 1] header)) =(1 (cut 0 [3 1] header)))
    ++  fine-req-path
      |=  blob=@
      ^-  (unit [sndr=ship stik=@ rtik=@ origin=(unit @) pax=path])
      ?.  (is-fine-req blob)  ~
      =/  header  (end 5 blob)
      =/  sndr-size  (bex +((cut 0 [7 2] header)))
      =/  rcvr-size  (bex +((cut 0 [9 2] header)))
      ::  The wire bit is loobean: 0 means yes/relayed, 1 means no.
      =/  relayed    =(0 (cut 0 [31 1] header))
      =/  body0  (rsh 5 blob)
      ::  relayed packets carry a 6-byte origin (the requester's real transport
      ::  address) at the low end of the body -- respond to it as a direct lane
      ::  so we don't have to DNS-dial the requesting ship.
      =/  origin  ?:(relayed `(end [3 6] body0) ~)
      =/  body   ?:(relayed (rsh [3 6] body0) body0)
      =/  stik   (cut 0 [0 4] body)           ::  request sndr-tick (requester life)
      =/  rtik   (cut 0 [4 4] body)           ::  request rcvr-tick (moon life)
      =/  sndr   `@p`(cut 3 [1 sndr-size] body)
      =/  off    (add 1 (add sndr-size rcvr-size))
      =/  content  (cut 3 [off (sub (met 3 body) off)] body)
      ::  wire wail = tag byte (0) + peep[num(4) len(2) path(len)].
      ::  This must mirror 408 +sift-wail/+sift-peep exactly; treating the
      ::  bytes after the tag as raw path text makes every real request fail
      ::  parsing and get silently dropped by the header-only guard below.
      ?.  =(0 (end 3 content))  ~
      =/  peep  (rsh 3 content)               ::  drop the %0 wail tag
      =/  len   (cut 3 [4 2] peep)
      =/  pat   (cut 3 [6 len] peep)
      =/  pax=(unit path)
        (rush pat ;~(pfix fas (most fas (cook crip (star ;~(less fas prn))))))
      ?~  pax  ~
      `[sndr stik rtik origin u.pax]
    ::  +etch-response: build a %fine RESPONSE packet blob (inlined lull
    ::  +etch-shot + ames +etch-peep).  content = purr = peep ++ meow(yowl).
    ::  Response is sndr=moon rcvr=requester, req=%.n sam=%.n, ticks swapped
    ::  from the request (response sndr-tick = request rcvr-tick, etc).
    ++  etch-response
      |=  [moon=ship rcvr=ship stik=@ rtik=@ frag=@ud pax=path yowl=@]
      ^-  @
      ::  peep = num(4) + wid(2) + path-text(wid)
      =/  pat  (spat pax)
      =/  wid  (met 3 pat)
      =/  peep  (can 3 ~[4^frag 2^wid wid^`@`pat])
      =/  content  (mix peep (lsh [3 (met 3 peep)] yowl))
      ::  ship-meta -> [size rank]
      =/  ssz  (met 3 moon)
      =/  smt  ?:((lte ssz 2) [2 0] ?:((lte ssz 4) [4 1] ?:((lte ssz 8) [8 2] [16 3])))
      =/  rsz  (met 3 rcvr)
      =/  rmt  ?:((lte rsz 2) [2 0] ?:((lte rsz 4) [4 1] ?:((lte rsz 8) [8 2] [16 3])))
      =/  body=@
        ;:  mix
          rtik                                ::  response sndr-tick = req rcvr-tick
          (lsh 2 stik)                        ::  response rcvr-tick = req sndr-tick
          (lsh 3 moon)
          (lsh [3 +(-.smt)] rcvr)
          (lsh [3 +((add -.smt -.rmt))] content)
        ==
      =/  cksum  (end [0 20] (mug body))
      =/  head=@
        %+  can  0
        :~  [2 0]                             ::  reserved
            [1 1]                             ::  req = %.n
            [1 1]                             ::  sam = %.n
            [3 0]                             ::  protocol-version %0
            [2 +.smt]                         ::  sndr rank
            [2 +.rmt]                         ::  rcvr rank
            [20 cksum]
            [1 1]                             ::  relayed = no (wire bit 1)
        ==
      (mix head (lsh 5 body))
    ::  +pier is the typed, in-memory view used while executing a moon.
    ::  %2/%3 stored the Arvo noun as *, then recovered it with ;;.  That cast
    ::  normalizes the noun to the mold's bunt on 408, silently erasing the
    ::  vane map.  %4 stores a vase instead: the noun remains opaque at load,
    ::  while its type is carried alongside it for an exact !< recovery.
    +$  pier
      $:  snap=vase
          next-events=(qeu unix-event)
          paused=?
          scry-time=@da
      ==
    +$  runtime-id  wynn
    +$  saved-pier
      $:  snap=vase
          next-events=(qeu unix-event)
          paused=?
          scry-time=@da
      ==
    +$  fleet  (map ship saved-pier)
    +$  fleet-snapshot
      $:  created-at=@da
          runtime=runtime-id
          ships=fleet
      ==
    +$  moon-health
      $:  who=ship
          status=?(%healthy %degraded %empty)
          vanes=(set term)
          queued=@ud
          paused=?
          identity-ok=?
      ==
    +$  state-5
      $:  %5
          piers=fleet
          fleet-snaps=(map path fleet-snapshot)
          :: quickboot caching
          ::
          files=(axal (cask))
          park=vase
          caches=(map @tas vase)
      ==
    +$  versioned-state  $%(state-5)
    ++  pack-park
      |=  pak=task:clay
      ^-  vase
      !>(pak)
    ++  unpack-park
      |=  pak=vase
      ^-  task:clay
      !<(task:clay pak)
    ++  pack-raft
      |=  raf=raft:clay-types
      ^-  vase
      !>(raf)
    ++  unpack-raft
      |=  raf=vase
      ^-  raft:clay-types
      !<(raft:clay-types raf)
    ++  current-runtime
      ^-  runtime-id
      :~  zuse+zuse
          lull+lull
          arvo+arvo
          hoon+hoon-version
          nock+4
      ==
    ++  pack-pier
      |=  run=pier
      ^-  saved-pier
      :*  snap.run
          next-events.run
          paused.run
          scry-time.run
      ==
    ++  unpack-pier
      |=  saved=saved-pier
      ^-  pier
      :*  snap.saved
          next-events.saved
          paused.saved
          scry-time.saved
      ==
    ++  health-of
      |=  [who=ship saved=saved-pier]
      ^-  moon-health
      =/  vit  (arvo-vitals:theseus-kernel snap.saved)
      ?~  vit
        [who %empty *(set term) 0 paused.saved |]
      =/  vanes=(set term)  vanes.u.vit
      =/  wanted=(set term)
        (sy ~[%ames %behn %clay %dill %eyre %gall %iris %jael %khan])
      =/  queued=@ud  (lent ~(tap to next-events.saved))
      =/  identity-ok=?  =(who our.u.vit)
      =/  okay=?
        ?&  identity-ok
            =(wanted vanes)
        ==
      =/  status=?(%healthy %degraded %empty)
        ?:(okay %healthy ?:(=(~ vanes) %empty %degraded))
      [who status vanes queued paused.saved identity-ok]
    ++  snapshot-ready
      |=  [who=ship saved=saved-pier]
      ^-  ?
      =/  hel  (health-of who saved)
      ?&  =(%healthy status.hel)
          paused.hel
          =(0 queued.hel)
      ==
    ::
    +$  card  $+(card card:agent:gall)
    --
::
=|  state-5
=*  state  -
=<
  %-  agent:dbug
  %+  verb  |
  ^-  agent:gall
  |_  =bowl:gall
  +*  this       .
      hc         ~(. +> bowl)
      def        ~(. (default-agent this %|) bowl)
  ++  on-init
    =.  files
      %-  ~(gas of *(axal (cask)))
      %+  user-files:pill
        /(scot %p p.byk.bowl)/base/(scot %da now.bowl)
      ~[/scripts]
    =.  park  (pack-park (park:theseus our.bowl %base %da now.bowl))
    :_  this
    :_  ~
    :: poke-our to add base
    :*  %pass  /  %agent  [our dap]:bowl
        %poke  theseus-action+!>([%cache %default ~ ~[%base]])
    ==
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  old-vase=vase
    ^-  (quip card _this)
    ::  Never turn a failed state load into a successful empty on-init.  Gall
    ::  already preserves the previous agent when on-load bails; swallowing a
    ::  cast failure here used to erase every pier and every snapshot.
    ?:  ?=([%5 *] q.old-vase)
      =/  old  !<(state-5 old-vase)
      ~&  [%theseus-state-load %5]
      `this(state old)
    ~|  [%theseus-unknown-state -.q.old-vase]
    !!
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      ?+  mark  ~|([%theseus-bad-mark mark] !!)
        %theseus-events  (poke-theseus-events:hc !<((list theseus-event) vase))
        %theseus-action  (poke-action:hc !<(action vase))
        ::  Narrow JSON control surface for the external recycle orchestrator.
        ::  Refuse a missing, multi-ship, or wrong-ship snapshot before restore.
        %theseus-recycle
          =/  rec  !<(recycle vase)
          =/  sip  (~(get by fleet-snaps) path.rec)
          ?~  sip  ~|([%theseus-recycle-missing path.rec] !!)
          =/  hers  (turn ~(tap by ships.u.sip) head)
          ?.  =(~[who.rec] hers)
            ~|([%theseus-recycle-snapshot-mismatch who.rec path.rec hers] !!)
          (poke-action:hc [%restore-snap path.rec])
        ::  sidecar Ames injection: widen the tiny $ames-in to $action (a
        ::  compile-time nest, so no task-arvo runtime coercion) and reuse
        ::  the existing %ames-inbound / %ames-test-inbound handlers.
        %theseus-ames-in  (poke-action:hc `action`!<(ames-in vase))
      ==
    [cards this]
  ::
  ++  on-peek
    |=  =path :: TODO (pole knot) faceless path
    ^-  (unit (unit cage))
    ?+    path  ~
        [%x %snaps ~]
      :^  ~  ~  %theseus-update
      !>(`update`[%snaps (turn ~(tap by fleet-snaps) head)])
    ::
        [%x %ships ~]
      ``noun+!>([%ships (turn ~(tap by piers) head)])
    ::
        [%x %ships %noun ~]
      ``noun+!>([%ships (turn ~(tap by piers) head)])
    ::
        [%x %snap-ships ^]
      =+  sips=(~(get by fleet-snaps) t.t.path)
      :^  ~  ~  %theseus-update
      !>  ^-  update
      ?~  sips  ~
      [%snap-ships t.t.path (turn ~(tap by ships.u.sips) head)]
    ::  operational health; never exposes the embedded Arvo noun
    ::
        [%x %health ~]
      =/  health=(list moon-health)
        %+  turn  ~(tap by piers)
        |=  [who=ship saved=saved-pier]
        (health-of who saved)
      ``noun+!>(health)
    ::
        [%x %health @ ~]
      =/  who  (slav %p i.t.t.path)
      =/  saved  (~(get by piers) who)
      ?~  saved  ``noun+!>(~)
      ``noun+!>(`moon-health`(health-of who u.saved))
    ::  cache scries
    ::
        [%x %caches ~]   ``noun+!>((turn ~(tap by caches) head))
        [%x %cache @ ~]
      =-  ``noun+!>(-)
      ~(tap in (cache-desks:theseus-kernel (~(got by caches) i.t.t.path)))
    ::  scry into running virtual ships
    ::  ship, care, ship, desk, time, path
    ::  NOTE: requires a double mark at the end
    ::
        [%x %i @ @ @ @ @ *]
      =/  who  (slav %p i.t.t.path)
      =*  paf  t.t.t.path
      (scry:(pe who) paf)
    ::  remote-scry into running virtual ships
    ::  NOTE: requires a double mark at the end
    ::
        [%x %r @ @ @ @ta @ta *]  :: TODO [%x %r @ ^]
      =/  who  (slav %p i.t.t.path)
      (remote-scry:(pe who) [%fine %hunk '1' '13' t.t.path]) :: TODO 1.000.000
    ::  convenience scry for a virtual ship's running gall app
    ::  ship, app, path
    ::
        [%x @ @ *]
      ?:  =(%ships i.t.path)
        ``noun+!>([%ships (turn ~(tap by piers) head)])
      =/  who  (slav %p i.t.path)
      =*  her  i.t.path
      =*  dap  i.t.t.path
      =/  paf  t.t.t.path
      (scry:(pe who) (weld /gx/[her]/[dap]/0 paf))
    ==
  ::
  ++  on-watch  on-watch:def
  ++  on-leave  on-leave:def
  ++  on-agent  on-agent:def
  ++  on-arvo   on-arvo:def
  ++  on-fail   on-fail:def
  --
::
::  unix-{effects,events,boths}: collect jar of effects and events to
::    brodcast all at once to avoid gall backpressure
::
::  TODO we don't do anything with events/boths so we can probably delete them 
=|  unix-effects=(jar ship unix-effect)
=|  unix-events=(jar ship unix-timed-event)
=|  unix-boths=(jar ship unix-both)
=|  cards=(list card)
|_  =bowl:gall
::
++  this  .
::
::  Represents a single ship's state.
::
++  pe
  |=  who=ship
  ::  Missing piers are never materialized implicitly.  Only an init action
  ::  may insert a new pier; all other callers must target an existing one.
  =/  saved  (~(got by piers) who)
  ::  Recover the exact typed noun carried by the vase.  Do not use ;; here:
  ::  on 408 it normalizes an opaque Arvo noun to the empty mold bunt.
  =+  (unpack-pier saved)
  =*  pier-data  -
  |%
  ::
  ::  Done; install data
  ::
  ++  abet-pe
    ^+  this
    =/  out=saved-pier  (pack-pier pier-data)
    =.  piers  (~(put by piers) who out)
    this
  ::
  ++  slap-gall
    |=  [dap=term =vase]
    ^+  ..abet-pe
    ~&  [%theseus-slap-gall-disabled who dap]
    ..abet-pe
  ::
  ::  return raft (containing the build cache of desks) from a theseus ship
  ::
  ++  raft  :: TODO get rid of this, not needed +ugly
    ^-  raft:clay-types
    =/  cay  !<((tail clay-types) (clay-vane-of:theseus-kernel snap))
    ruf.cay
  ::
  ::  Enqueue events to child arvo
  ::
  ++  push-events
    |=  ues=(list unix-event)
    ^+  ..abet-pe
    =.  next-events  (~(gas to next-events) ues)
    ..abet-pe
  ::
  ::  Process the events in our queue.
  ::
  ++  plow
    |-  ^+  ..abet-pe
    ?:  =(~ next-events)  ..abet-pe
    ::  Skip plowing into a paused/absent pier.  This is hit constantly and
    ::  harmlessly when a moon's internal route targets a real (non-virtual)
    ::  ship -- the sidecar does the real delivery -- so drop it quietly.
    ?:  paused  ..abet-pe
    =^  ue  next-events  ~(get to next-events)
    ::  Poke execution now lives in lib/theseus-kernel (Phase 3a slice 1); this
    ::  loop no longer names poke:arvo-adult / Arvo-private types.  Both crash casts are
    ::  still contained (inside +mule there) so a bad %hear result drops instead
    ::  of crashing lick %soak.
    =/  res  (poke-arvo:theseus-kernel snap now.bowl ue)
    ?:  ?=(%| -.res)
      ?:  ?=(%poke stage.p.res)
        ((slog >%theseus-crash< >who< tang.p.res) $)
      ((slog >%theseus-snap-cast-crash< >who< tang.p.res) $)
    =.  snap  snap.p.res
    =.  scry-time  now.bowl
    =.  ..abet-pe  (publish-event now.bowl ue)
    =.  ..abet-pe  (handle-effects effects.p.res)
    $
  ::
  ::  Handle all the effects produced by a single event.
  ::
  ++  handle-effects
    |=  effects=(list ovum)
    ^+  ..abet-pe
    ?~  effects  ..abet-pe
    =.  ..abet-pe
      ?^  sof=((soft unix-effect) i.effects)
        ?:  =(%push -.q.u.sof)
          ~&  [%theseus-captured-push who]
          (publish-effect u.sof)
        (publish-effect u.sof)
      ?:  =(p.card.i.effects %push)
        ~&  [%theseus-rejected-push who]
        ..abet-pe
      ?:  &(=(p.card.i.effects %unto) ?=(^ q.card.i.effects))
        ((slog (flop ;;(tang +.q.card.i.effects))) ~&(who=who ..abet-pe))
      ..abet-pe
    $(effects t.effects)
  ::
  ++  publish-effect
    |=  uf=unix-effect
    ^+  ..abet-pe
    =.  unix-effects  (~(add ja unix-effects) who uf)
    =.  unix-boths  (~(add ja unix-boths) who [%effect uf])
    ..abet-pe
  ::
  ++  publish-event
    |=  ute=unix-timed-event
    ^+  ..abet-pe
    =.  unix-events  (~(add ja unix-events) who ute)
    =.  unix-boths  (~(add ja unix-boths) who [%event ute])
    ..abet-pe
  ::
  ++  scry
    |=  =path
    ^-  (unit (unit cage))
    ?.  ?=([@ @ @ @ *] path)  ~
    ::  alter timestamp to match %theseus fake-time
    =.  i.t.t.t.path  (scot %da scry-time)
    ::  execute scry -- de-omen + le:part peek both live in theseus-kernel now.
    (peek-path-arvo:theseus-kernel snap path)
  ::
  ++  remote-scry
    |=  =spur
    ^-  (unit (unit cage))
    ::  the le:part peek lives in theseus-kernel now
    (peek-arvo:theseus-kernel snap [~ / [%ax [who %$ da+scry-time:pier-data] spur]])
  ::
  ::  When paused, events are added to the queue but not processed.
  ::
  ++  pause    .(paused &)
  ++  unpause  .(paused |)
  --
::
::  ++apex-theseus and ++abet-theseus must bookend calls from gall
::
++  apex-theseus
  ^+  this
  =:  cards         ~
      unix-effects  ~
      unix-events   ~
      unix-boths    ~
    ==
  this
::
++  abet-theseus
  ^-  (quip card _state)
  ::
  =.  this
    %-  emit-cards
    %-  zing
    %+  turn  ~(tap by unix-effects)
    |=  [=ship ufs=(list unix-effect)]
    %+  turn  ufs
    |=  uf=unix-effect
    :^  %pass  /theseus-pyre  %agent
    :+  [our.bowl %theseus-pyre]  %poke
    theseus-effect+!>(`theseus-effect`[ship uf])
  [(flop cards) state]
::
++  emit-cards
  |=  ms=(list card)
  =.  cards  (weld ms cards)
  this
::
::  Apply a list of events tagged by ship
::
++  poke-theseus-events
  |=  events=(list theseus-event)
  ^-  (quip card _state)
  =.  this  apex-theseus  =<  abet-theseus
  ::  Runtime events can race a kill/restore.  Drop events for absent piers
  ::  instead of letting an external timer, browser request, or packet create
  ::  a default ghost pier (or crash the whole batch).
  =/  known=(list theseus-event)
    %+  skim  events
    |=  pev=theseus-event
    (~(has by piers) who.pev)
  ::  Thread the parent Theseus core explicitly.  The generic +turn-events
  ::  callback returned a nested +pe core; after state %4 moved the Arvo noun
  ::  into a vase, that polymorphic callback could lose the parent fleet
  ::  subject and +pe would see a missing ship that +health could still scry.
  =.  this
    =/  pending  known
    |-  ^+  this
    ?~  pending  this
    =.  this
      abet-pe:(push-events:(pe who.i.pending) [ue.i.pending]~)
    $(pending t.pending, this this)
  ::  Drain every unpaused moon after the whole batch has been enqueued.
  |-
  =/  active=(unit ship)
    =/  pers  ~(tap by piers)
    |-
    ?~  pers  ~
    ?:  &(?=(^ next-events.q.i.pers) !paused.q.i.pers)
      `p.i.pers
    $(pers t.pers)
  ?~  active  this
  =.  this  abet-pe:plow:(pe u.active)
  $
::
++  poke-action
  |=  act=action
  ^-  (quip card _state)
  ?-    -.act
  ::
      %init-ship
    =.  this  apex-theseus  =<  abet-theseus
    ?:  (~(has by piers) who.act)
      ~|([%theseus-init-existing who.act] !!)
    =/  ker=kernel:theseus-kernel
      (build:theseus-kernel our.bowl now.bowl)
    =/  clay
      (clay-vane:theseus-kernel who.act)
    =.  ruf.clay
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (unpack-raft (~(got by caches) cache.act))
    :: have to get rid of the kids desk otherwise boot fails
    =.  dos.rom.ruf.clay  (~(del by dos.rom.ruf.clay) %kids)
    =/  new=pier  *pier
    =.  snap.new  (make-arvo:theseus-kernel who.act ker files !>(clay))
    =.  piers  (~(put by piers) who.act (pack-pier new))
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ^-  (list unix-event)
      :~  [/d/term/1 %boot & %fake who.act]  ::  start vanes
          [/b/behn/0v1n.2m9vh %born ~]
          [/i/http-client/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %live 8.080 `8.445]  :: TODO do we need this event
          [/a/newt/0v1n.2m9vh %born ~]
          [/c/commit/(scot %p who.act) (prune-boot-park (unpack-park park))]
      ==
    (pe who.act)
  ::
      %init-moon
    ?:  (~(has by piers) who.act)
      ~|([%theseus-init-existing who.act] !!)
    ::  Re-initializing a moon discards its Arvo state, so it is a breach as
    ::  well as a key rotation.  Advancing only life falsely preserves the
    ::  old continuity namespace: remote peers can then request Clay revisions
    ::  from the discarded pier (for example /c/z/2/kids) that the new pier
    ::  cannot serve.  Advance rift and life together, and boot %dawn with the
    ::  exact pair registered in the host's Jael.
    =/  old-life=(unit @ud)
      .^  (unit @ud)  %j
        /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p who.act)
      ==
    =/  prior=(unit [rift=@ud life=@ud])
      ?~  old-life  ~
      =/  old-rift=(unit @ud)
        .^  (unit @ud)  %j
          /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p who.act)
        ==
      ~|  [%theseus-init-missing-rift who.act u.old-life]
      =/  old-rift-val=@ud  (need old-rift)
      `[old-rift-val u.old-life]
    =/  moon-rift=@ud  ?~(prior 0 +(rift.u.prior))
    =/  moon-life=@ud  ?~(prior 1 +(life.u.prior))
    ::  Provision the moon with correct CURRENT keys for its whole sponsor
    ::  chain (us -> star -> galaxy), scried from our Jael.  A minimal czar
    ::  (just the galaxy) left stale rift/life for the sponsor, causing
    ::  %fine-mismatch on remote scry and breaking third-party key
    ::  resolution.  Unit scries (%lyfe/%ryft/%puby) so an unknown ship is
    ::  skipped, never crashing the poke.
    =/  chain=(list ship)
      .^((list ship) %j /(scot %p our.bowl)/saxo/(scot %da now.bowl)/(scot %p our.bowl))
    =/  czar=(map ship [rift=@ud life=@ud =pass])
      %+  roll  chain
      |=  [s=ship acc=(map ship [rift=@ud life=@ud =pass])]
      =/  ul=(unit @ud)
        .^((unit @ud) %j /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p s))
      ?~  ul  acc
      =/  ur=(unit @ud)
        .^((unit @ud) %j /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p s))
      ?~  ur  acc
      =/  uk=(unit [suite=@ud =pass])
        .^  (unit [@ud pass])  %j
          /(scot %p our.bowl)/puby/(scot %da now.bowl)/(scot %p s)/(scot %ud u.ul)
        ==
      ?~  uk  acc
      (~(put by acc) s [u.ur u.ul pass.u.uk])
    =/  turves=(list turf)
      .^((list turf) %j /(scot %p our.bowl)/turf/(scot %da now.bowl))
    ::  register the moon's public key with our Jael (self-sufficient
    ::  resident moon; no separate dingy agent). jael only accepts our moons.
    =/  rift-card=card
      :*  %pass  /theseus/moon-rift/(scot %p who.act)  %arvo  %j
          %moon  who.act  [*id:block:jael %rift moon-rift %.n]
      ==
    =/  key-card=card
      :*  %pass  /theseus/moon/(scot %p who.act)  %arvo  %j
          %moon  who.act  [*id:block:jael %keys [moon-life 1 pub.act] %.n]
      ==
    =/  reg-cards=(list card)
      ?~(prior [key-card ~] [rift-card key-card ~])
    =^  cards  state
      =.  this  apex-theseus  =<  abet-theseus
    =/  ker=kernel:theseus-kernel
      (build:theseus-kernel our.bowl now.bowl)
    =/  clay
      (clay-vane:theseus-kernel who.act)
    =.  ruf.clay
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (unpack-raft (~(got by caches) cache.act))
    :: have to get rid of the kids desk otherwise boot fails
    =.  dos.rom.ruf.clay  (~(del by dos.rom.ruf.clay) %kids)
    ::  Build the complete typed pier off-map.  Never expose an empty placeholder:
    ::  if construction fails, no fleet record exists; if it succeeds, the first
    ::  visible record already contains all nine vanes.
    =/  new=pier  *pier
    =.  new  new(snap (make-arvo:theseus-kernel who.act ker files !>(clay)), paused |)
    =.  piers  (~(put by piers) who.act (pack-pier new))
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ^-  (list unix-event)
      ::  boot %dawn with the real key (ring) + galaxy trust anchor (czar) and
      ::  turf, scried from our Jael.  spon stays empty (jael doesn't expose
      ::  full azimuth points); the galaxy key is enough to start bootstrap.
      ::  feed %2 = [[%2 ~] who rift [life ring]~].
      :~  [/d/term/1 %boot & %dawn [[%2 ~] who.act moon-rift [moon-life key.act]~] ~ czar turves 0 ~]
          [/b/behn/0v1n.2m9vh %born ~]
          [/i/http-client/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %live 8.080 `8.445]
          [/a/newt/0v1n.2m9vh %born ~]
          [/c/commit/(scot %p who.act) (prune-boot-park (unpack-park park))]
      ==
      (pe who.act)
    [(weld reg-cards cards) state]
  ::
      %init-planet
    ?:  (~(has by piers) who.act)
      ~|([%theseus-init-existing who.act] !!)
    ?.  ?=(%duke (clan:title who.act))
      ~|([%theseus-init-planet-not-duke who.act] !!)
    =/  planet-life=(unit @ud)
      .^  (unit @ud)  %j
        /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p who.act)
      ==
    ?~  planet-life
      ~|([%theseus-init-planet-missing-life who.act] !!)
    =/  planet-rift=(unit @ud)
      .^  (unit @ud)  %j
        /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p who.act)
      ==
    ?~  planet-rift
      ~|([%theseus-init-planet-missing-rift who.act] !!)
    =/  planet-pub=(unit [suite=@ud =pass])
      .^  (unit [@ud pass])  %j
        /(scot %p our.bowl)/puby/(scot %da now.bowl)/(scot %p who.act)/(scot %ud u.planet-life)
      ==
    ?~  planet-pub
      ~|([%theseus-init-planet-missing-public-key who.act u.planet-life] !!)
    =/  fed=feed:jael  feed.act
    =/  feed-who=ship
      ?@  -.fed
        `ship`-.fed
      `ship`-.+.fed
    ?.  =(who.act feed-who)
      ~|([%theseus-init-planet-wrong-keyfile who.act feed-who] !!)
    =/  kyz=(list [lyf=life key=ring])
      ?@  -.fed
        :_  ~
        :-  `life`-.+.fed
        `ring`-.+.+.fed
      ?-  -.fed
        [%1 ~]  `(list [lyf=life key=ring])`+.+.fed
        [%2 ~]  `(list [lyf=life key=ring])`+.+.+.fed
      ==
    =/  feed-rift=(unit @ud)
      ?@  -.fed
        ~
      ?-  -.fed
        [%1 ~]  ~
        [%2 ~]
          =/  tail=[who=ship ryf=rift kyz=(list [lyf=life key=ring])]  +.fed
          `ryf.tail
      ==
    =/  key-row=(unit [lyf=life key=ring])
      =/  rows  kyz
      |-
      ?~  rows  ~
      ?:  ?&  =(u.planet-life lyf.i.rows)
              =(pass.u.planet-pub (pub-from-ring:dingy key.i.rows))
          ==
        `i.rows
      $(rows t.rows)
    ?~  key-row
      ~|([%theseus-init-planet-key-mismatch who.act u.planet-life] !!)
    =/  rift-ok=?
      ?~  feed-rift  %.y
      =(u.planet-rift u.feed-rift)
    ?.  rift-ok
      ~|([%theseus-init-planet-rift-mismatch who.act u.planet-rift] !!)
    =/  priv=ring  key.u.key-row
    =/  chain=(list ship)
      .^((list ship) %j /(scot %p our.bowl)/saxo/(scot %da now.bowl)/(scot %p who.act))
    =/  sponsors=(list ship)
      ?~(chain ~ t.chain)
    =/  czar=(map ship [rift=@ud life=@ud =pass])
      %+  roll  sponsors
      |=  [s=ship acc=(map ship [rift=@ud life=@ud =pass])]
      =/  ul=(unit @ud)
        .^((unit @ud) %j /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p s))
      ?~  ul  acc
      =/  ur=(unit @ud)
        .^((unit @ud) %j /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p s))
      ?~  ur  acc
      =/  uk=(unit [suite=@ud =pass])
        .^  (unit [@ud pass])  %j
          /(scot %p our.bowl)/puby/(scot %da now.bowl)/(scot %p s)/(scot %ud u.ul)
        ==
      ?~  uk  acc
      (~(put by acc) s [u.ur u.ul pass.u.uk])
    =/  turves=(list turf)
      .^((list turf) %j /(scot %p our.bowl)/turf/(scot %da now.bowl))
    =^  cards  state
      =.  this  apex-theseus  =<  abet-theseus
    =/  ker=kernel:theseus-kernel
      (build:theseus-kernel our.bowl now.bowl)
    =/  clay
      (clay-vane:theseus-kernel who.act)
    =.  ruf.clay
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (unpack-raft (~(got by caches) cache.act))
    :: have to get rid of the kids desk otherwise boot fails
    =.  dos.rom.ruf.clay  (~(del by dos.rom.ruf.clay) %kids)
    =/  new=pier  *pier
    =.  new  new(snap (make-arvo:theseus-kernel who.act ker files !>(clay)), paused |)
    =.  piers  (~(put by piers) who.act (pack-pier new))
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ^-  (list unix-event)
      :~  [/d/term/1 %boot & %dawn [[%2 ~] who.act u.planet-rift [u.planet-life priv]~] ~ czar turves 0 ~]
          [/b/behn/0v1n.2m9vh %born ~]
          [/i/http-client/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %live 8.080 `8.445]
          [/a/newt/0v1n.2m9vh %born ~]
          [/c/commit/(scot %p who.act) (prune-boot-park (unpack-park park))]
      ==
      (pe who.act)
    [cards state]
  ::
      %kill-ships
    ::  Killing is an administrative operation, not a moon event.  Never cast
    ::  or plow the target: a corrupt/empty record must still be removable, and
    ::  a valid moon must not run queued work on its way out.
    =/  missing=(list ship)
      %+  skim  hers.act
      |=  who=ship
      !(~(has by piers) who)
    ?^  missing
      ~|([%theseus-kill-missing missing] !!)
    =/  kill-cards=(list card)
      %+  turn  hers.act
      |=  who=ship
      :^  %pass  /theseus-pyre  %agent
      :+  [our.bowl %theseus-pyre]  %poke
      theseus-effect+!>(`theseus-effect`[who [/ %kill ~]])
    =.  piers
      %-  ~(dif by piers)
      %-  ~(gas by *fleet)
      (turn hers.act |=(=ship [ship *saved-pier]))
    ~&  [%theseus-killed hers.act]
    [kill-cards state]
  ::
      %snap-ships
    =.  this  apex-theseus  =<  abet-theseus
    ?:  =(~ hers.act)
      ~|([%theseus-snapshot-empty path.act] !!)
    ?:  (~(has by fleet-snaps) path.act)
      ~|([%theseus-snapshot-exists path.act] !!)
    =/  requested=(set ship)  (~(gas in *(set ship)) hers.act)
    ?.  =((lent hers.act) ~(wyt in requested))
      ~|([%theseus-snapshot-duplicate-ship path.act] !!)
    ::  Quiesce and seal atomically.  Runtime events may arrive after a caller
    ::  pauses a moon (especially across a Gall reload), leaving a non-empty
    ::  queue that a paused moon cannot drain.  Within this single Gall event,
    ::  run each selected moon to an empty queue and pause it again before
    ::  copying the fleet state.  No external event can interleave here.
    =.  this
      =/  pending  hers.act
      |-  ^+  this
      ?~  pending  this
      =/  her  i.pending
      =.  this  abet-pe:unpause:(pe her)
      =.  this  abet-pe:plow:(pe her)
      =.  this  abet-pe:pause:(pe her)
      $(pending t.pending, this this)
    =/  selected=fleet
      %-  malt
      %+  turn  hers.act
      |=  her=ship
      [her (~(got by piers) her)]
    ::  Do not carry saved-pier vases through a polymorphic +skim callback.
    ::  As with pause/unpause on state %4, explicitly walk the list so every
    ::  readiness check runs against this exact parent core and fleet map.
    =/  bad=(list ship)
      =/  pending  hers.act
      =/  failed  *(list ship)
      |-
      ?~  pending  (flop failed)
      =/  her  i.pending
      =/  ready  (snapshot-ready her (~(got by selected) her))
      $(pending t.pending, failed ?:(ready failed [her failed]))
    ?^  bad
      ~|([%theseus-snapshot-not-ready path.act bad] !!)
    =.  fleet-snaps
      %+  ~(put by fleet-snaps)  path.act
      [now.bowl current-runtime selected]
    ~&  theseus+snapshot+path.act
    this
  ::
      %restore-snap
    =/  shot  (~(got by fleet-snaps) path.act)
    ?.  =(runtime.shot current-runtime)
      ~|([%theseus-snapshot-runtime-mismatch path.act runtime.shot current-runtime] !!)
    =/  hers=(list ship)  (turn ~(tap by ships.shot) head)
    =/  bad=(list ship)
      =/  pending  hers
      =/  failed  *(list ship)
      |-
      ?~  pending  (flop failed)
      =/  her  i.pending
      =/  ready  (snapshot-ready her (~(got by ships.shot) her))
      $(pending t.pending, failed ?:(ready failed [her failed]))
    ?^  bad
      ~|([%theseus-snapshot-invalid path.act bad] !!)
    ::  Snapshots are sealed while paused.  Restore their internal state as
    ::  running, then ask pyre to atomically reset its per-moon shims and send
    ::  the restored vanes their normal runtime %born/%live sequence.
    =/  restored=fleet
      %-  malt
      %+  turn  ~(tap by ships.shot)
      |=  [who=ship saved=saved-pier]
      [who saved(paused |)]
    =.  piers  (~(uni by piers) restored)
    =/  restart-cards=(list card)
      %+  turn  hers
      |=  who=ship
      :^  %pass  /theseus-pyre  %agent
      :+  [our.bowl %theseus-pyre]  %poke
      theseus-effect+!>(`theseus-effect`[who [/ %restart ~]])
    ~&  theseus+restore-snap+path.act
    [restart-cards state]
  ::
      %delete-snap
    ~&  deleted+path.act
    `state(fleet-snaps (~(del by fleet-snaps) path.act))
  ::
      %unpause-ships
    =.  this  apex-theseus  =<  abet-theseus
    ::  Thread the parent Theseus core explicitly.  +turn-ships returns a
    ::  nested +pe core through a polymorphic callback; with saved-pier vases
    ::  that can lose the updated parent fleet subject.
    =.  this
      =/  pending  hers.act
      |-  ^+  this
      ?~  pending  this
      =/  who  i.pending
      ~&  theseus+unpaused+who
      =.  this  abet-pe:unpause:(pe who)
      $(pending t.pending, this this)
    ::  Preserve the old +turn-ships behavior: once every target is unpaused,
    ::  drain all runnable queues across the fleet.
    |-
    =/  active=(unit ship)
      =/  pers  ~(tap by piers)
      |-
      ?~  pers  ~
      ?:  &(?=(^ next-events.q.i.pers) !paused.q.i.pers)
        `p.i.pers
      $(pers t.pers)
    ?~  active  this
    =.  this  abet-pe:plow:(pe u.active)
    $
  ::
      %pause-ships
    =.  this  apex-theseus  =<  abet-theseus
    ::  Pausing is only a fleet-state update.  Do not invoke +plow and do not
    ::  pass nested +pe cores through the generic +turn-ships callback.
    =/  pending  hers.act
    |-  ^+  this
    ?~  pending  this
    =/  who  i.pending
    ~&  theseus+paused+who
    =.  this  abet-pe:pause:(pe who)
    $(pending t.pending, this this)
  ::
      %wish
    =/  ps=pier  pier-data:(pe her.act)
    ~&  her.act^%wished^(wish-arvo:theseus-kernel snap.ps p.act)
    `state
  ::
      %slap-gall
    =.  this  abet-pe:(slap-gall:(pe her.act) [dap.act vase.act])
    ~&  theseus+slap-gall+her.act
    `state
  ::
      %ames-inbound
    ?.  (~(has by piers) who.act)
      `state
    ::  A %fine request is normally answered by vere before Arvo sees it.
    ::  Virtual moons have no vere, so ask the moon's own /x/fine/hunk
    ::  responder to scry and sign the requested data, then carry each signed
    ::  fragment back through the existing sidecar.  Never inject a fine
    ::  request as %hear: Ames deliberately rejects that event shape.
    =/  fr  (fine-req-path blob.act)
    ?^  fr
      =/  res  (remote-scry:(pe who.act) [%fine %hunk '1' '64' pax.u.fr])
      ?~  res  `state
      ?~  u.res  `state
      =/  yowls  !<((list @) q.u.u.res)
      ?~  yowls  `state
      =/  lane  ?~(origin.u.fr [%& sndr.u.fr] [%| u.origin.u.fr])
      =.  this  apex-theseus  =<  abet-theseus
      =.  this
        =/  pc  (pe who.act)
        =/  fs=(list @)  yowls
        =/  ix=@ud  1
        |-  ^+  this
        ?~  fs  abet-pe:pc
        =/  bl
          (etch-response who.act sndr.u.fr stik.u.fr rtik.u.fr ix pax.u.fr i.fs)
        =.  pc  (publish-effect:pc [/ %send lane bl])
        $(fs t.fs, ix +(ix))
      (pe who.act)
    ?:  (is-fine-req blob.act)  `state
    =.  this  apex-theseus  =<  abet-theseus
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ~[[/a/newt/0v1n.2m9vh %hear lane.act blob.act]]
    (pe who.act)
  ::
      %mesa-inbound
    ?.  (~(has by piers) who.act)
      `state
    =.  this  apex-theseus  =<  abet-theseus
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ~[[/a/newt/0v1n.2m9vh %heer lane.act blob.act]]
    (pe who.act)
  ::
      %ames-test-inbound
    ?.  (~(has by piers) who.act)
      ~&  [%theseus-ames-test-inbound-missing who.act from=from.act]
      `state
    ~&  [%theseus-ames-test-inbound who=who.act from=from.act blob-size=(met 3 blob.act)]
    `state
  ::
      %cache
    =.  desks.act  [%base desks.act]
    =.  caches
      %+  ~(put by caches)  name.act
      %-  pack-raft
      ?^  who.act
        =|  =raft:clay-types
        =+  ruf=raft:(pe u.who.act)
        %=    raft
            ::  408 Clay no longer exposes .fad/flow in raft; keep default empty fad.
            ran  ran.ruf
            dos.rom
          |-
          ?~  desks.act  dos.rom.raft
          =.  dos.rom.raft
            %+  ~(put by dos.rom.raft)  i.desks.act
            =|  doj=dojo:clay-types
            ~|  "{<i.desks.act>} doesn't exist on {<u.who.act>}"
            =.  dom.doj  dom:(~(got by dos.rom.ruf) i.desks.act)
            doj
          $(desks.act t.desks.act)
        ==      
      ::  take cache from host ship
      ::
      =|  =raft:clay-types
      ::  408 Clay no longer exposes /flow as a public scry; keep default empty fad.
      =.  ran.raft
        .^(rang:clay %cx /(scot %p our.bowl)//(scot %da now.bowl)/rang)
      =.  dos.rom.raft
        |-
        ?~  desks.act  dos.rom.raft
        =+  .^(=cone:clay %cx /(scot %p our.bowl)//(scot %da now.bowl)/domes)
        ~|  "{<i.desks.act>} doesn't exist on {<our.bowl>}"
        =/  =dome:clay  (~(got by cone) our.bowl i.desks.act)
        =.  dos.rom.raft
          %+  ~(put by dos.rom.raft)  i.desks.act
          =|  doj=dojo:clay-types
          =.  dom.doj  dome  doj
        $(desks.act t.desks.act)
      raft
    ~&  theseus+cache+name.act
    `state
  ::
      %rebuild
    =/  desks
      %-  raft-desks
      ~|  "{<name.act>} cache doesn't exist"
      (unpack-raft (~(got by caches) name.act))
    =/  all=(list ship)
      %+  murn  ~(tap in piers)
      |=  [=ship saved=saved-pier]
      ?:  paused.saved  ~
      ::  can't inject desks if they haven't been installed 
      ?.  =(desks (~(int in (snap-raft-desks:theseus-kernel snap:(pe ship))) desks))
        ~
      ~&  theseus+rebuilding+ship
      `ship
    ?~  all  ~&  theseus+rebuild+%no-running-ships  `state
    ::  build it on one ship
    =^  cad  state  (poke-theseus-events [i.all /c/rebuild park.act]~)
    ::  re-make the %cache
    ?>  ?=(%park -.park.act)
    =+  raf=raft:(pe i.all) :: TODO error prone, might need to fetch particular desks
    =.  caches  (~(put by caches) name.act (pack-raft raf))
    ::  inject it into all ships
    =.  piers
      %-  ~(gas by piers)
      %+  turn  t.all
      |=  who=ship
      ^-  [ship saved-pier]
      =/  old  (~(got by piers) who)
      =/  pier=pier  (unpack-pier old)
      =/  cay  !<((tail clay-types) (clay-vane-of:theseus-kernel snap.pier))
      ::  408 Clay no longer exposes .fad/flow in raft; keep default empty fad.
      =.  ran.ruf.cay  ran.raf
      =.  dos.rom.ruf.cay
        =/  desks  ~(tap in desks)
        |-
        ?~  desks  dos.rom.ruf.cay
        =.  dos.rom.ruf.cay
          %+  ~(put by dos.rom.ruf.cay)  i.desks
          =|  doj=dojo:clay-types
          ~|  "{<i.desks>} doesn't exist on {<who>}"
          =/  dom  dom:(~(got by dos.rom.raf) i.desks)
          =.  let.dom  0
          =.  hit.dom  *(map aeon:clay tako:clay)
          :: TODO might have to bunt some other stuff
          =.  dom.doj  dom
          doj
        $(desks t.desks)
      :-  who
      ^-  saved-pier
      (pack-pier pier(snap (put-clay-vane:theseus-kernel snap.pier !>(cay))))
    =^  car  state
      %-  poke-theseus-events
      %+  turn  t.all
      |=  =ship
      [ship /c/rebuild park.act]
    ~&  theseus+rebuild+[name.act des.park.act]
    [(weld cad car) state]
  ==
::
++  drop-paths
  |=  [pax=(list path) dat=(map path (each page lobe:clay))]
  ^-  (map path (each page lobe:clay))
  ?~  pax  dat
  $(pax t.pax, dat (~(del by dat) i.pax))
::
++  prune-boot-park
  |=  pak=task:clay
  ^-  task:clay
  ?.  ?=(%park -.pak)  pak
  =/  drop=(list path)
    :~  /gen/hood/moon/hoon
        /gen/hood/moon-breach/hoon
        /gen/hood/moon-cycle-keys/hoon
        /gen/hood/jael/moon/hoon
        /gen/hood/jael/moon/breach/hoon
        /gen/hood/jael/moon/cycle-keys/hoon
    ==
  =/  yok=yoki:clay  yok.pak
  =.  yok
    ?-  -.yok
      %|  yok
      %&  yok(q.p (drop-paths drop q.p.yok))
    ==
  pak(yok yok)
::
++  raft-desks  |=(=raft:clay-types ~(key by dos.rom.raft))
::
::  Run a callback function against a list of ships, aggregating state
::  and plowing all ships at the end.
::
::    The callback function must start with `=.  this  thus`, or else
::    you don't get the new state.
::
++  turn-plow
  |*  arg=mold
  |=  [hers=(list arg) fun=$-([arg _this] _(pe))]
  |-  ^+  this
  ?^  hers  ::  first process all hers
    =.  this  abet-pe:plow:(fun i.hers this)
    $(hers t.hers, this this)
  |-  ::  then run all events on all ships until all queues are empty
  =;  who=(unit ship)
    ?~  who  this
    =.(this abet-pe:plow:(pe u.who) $)
  =+  pers=~(tap by piers)
  |-  ^-  (unit ship)
  ?~  pers  ~
  ?:  &(?=(^ next-events.q.i.pers) !paused.q.i.pers)
    `p.i.pers
  $(pers t.pers)
::
++  turn-ships   (turn-plow ship)
++  turn-events  (turn-plow theseus-event)
::
--
