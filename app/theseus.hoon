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
    dbug, verb
::
/=  arvo-core  /sys/arvo :: TODO this compiles it against zuse, WRONG
/=  ames-core  /sys/vane/ames
/=  behn-core  /sys/vane/behn
/=  clay-core  /sys/vane/clay
/=  dill-core  /sys/vane/dill
/=  eyre-core  /sys/vane/eyre :: login by posting to /theseus/~nec/~/login
/=  gall-core  /sys/vane/gall
/=  iris-core  /sys/vane/iris
/=  jael-core  /sys/vane/jael
/=  khan-core  /sys/vane/khan
/=  lull-core  /sys/lull
::
=>  |%
    ++  arvo-adult  ..^load:+>.arvo-core
    ++  clay-types  (clay-core *ship)
    ++  gall-type   (tail (gall-core *ship))
    +$  pier
      $:  snap=_arvo-adult
          event-log=(list unix-timed-event)
          next-events=(qeu unix-event)
          paused=?
          scry-time=@da
      ==
    +$  fleet  (map ship pier)          
    +$  state-0
      $:  %0
          piers=fleet
          fleet-snaps=(map path fleet)
          :: quickboot caching
          ::
          files=(axal (cask))
          park=task:clay :: TODO should be $>(%park task:clay)
          caches=(map @tas =raft:clay-types)
      ==
    +$  versioned-state  $%(state-0)
    ::
    +$  card  $+(card card:agent:gall)
    --
::
=|  state-0
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
    =.  park  (park:theseus our.bowl %base %da now.bowl)
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
    ::  state management
    =+  (mule |.(!<(versioned-state old-vase)))
    ?-  -.-
      %&  `this(state +.-)
      %|  on-init
    ==
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      ?+  mark  ~|([%theseus-bad-mark mark] !!)
        %theseus-events  (poke-theseus-events:hc !<((list theseus-event) vase))
        %theseus-action  (poke-action:hc !<(action vase))
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
      [%snap-ships t.t.path (turn ~(tap by u.sips) head)]
    ::  cache scries
    ::
        [%x %caches ~]   ``noun+!>((turn ~(tap by caches) head))
        [%x %cache @ ~]
      =-  ``noun+!>(-)
      ~(tap in (raft-desks (~(got by caches) i.t.t.path)))
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
  =+  (~(gut by piers) who *pier)
  =*  pier-data  -
  |%
  ::
  ::  Done; install data
  ::
  ++  abet-pe
    ^+  this
    =.  piers  (~(put by piers) who pier-data)
    this
  ::
  ++  slap-gall
    |=  [dap=term =vase]
    ^+  ..abet-pe
    =.  van.mod.sol.snap
      =+  !<(gal=gall-type vase:(~(got by van.mod.sol.snap) %gall))
      =/  yok  (~(got by yokes.state.gal) dap)
      ?>  ?=(%live -.yok)
      ?>  ?=(%& -.agent.yok) :: not going to handle dead agents
      =.  agent.yok
        %&^(tail (on-load:p.agent.yok vase))
      =.  yokes.state.gal  (~(put by yokes.state.gal) dap yok)
      (~(put by van.mod.sol.snap) %gall [!>(gal) *worm])
    ..abet-pe
  ::
  ::  return raft (containing the build cache of desks) from a theseus ship
  ::
  ++  raft  :: TODO get rid of this, not needed +ugly
    ^-  raft:clay-types
    =-  ruf.cay
    !<(cay=(tail clay-types) vase:(~(got by van.mod.sol.snap) %clay))
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
    =/  poke-result=(each vase tang)
      (mule |.((slym [-:!>(poke:arvo-adult) poke:snap] [now.bowl ue])))
    ?:  ?=(%| -.poke-result)  ((slog >%theseus-crash< >who< p.poke-result) $)
    ::  NOTE: this is extremely dangerous
    =.  snap  !<(_arvo-adult [-:!>(*_arvo-adult) +.q.p.poke-result])
    =.  scry-time  now.bowl
    =.  ..abet-pe  (publish-event now.bowl ue)
    =.  ..abet-pe
      ~|  ova=-.p.poke-result
      (handle-effects ;;((list ovum) -.q.p.poke-result))
    $
  ::
  ::  Handle all the effects produced by a single event.
  ::
  ++  handle-effects
    |=  effects=(list ovum)
    ^+  ..abet-pe
    ?~  effects  ..abet-pe
    =.  ..abet-pe
      ?^  sof=((soft unix-effect) i.effects)  (publish-effect u.sof)
      ?:  &(=(p.card.i.effects %unto) ?=(^ q.card.i.effects))
        ((slog (flop ;;(tang +.q.card.i.effects))) ~&(who=who ..abet-pe))
      ~&(theseus+unknown-effect+who^i.effects ..abet-pe)
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
    =.  event-log  [ute event-log]
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
    ::  execute scry
    ?~  mon=(de-omen path)  ~
    ?~  res=(~(peek le:part:snap [[pit vil] sol]:snap) [~ / u.mon])  ~
    ?~  u.res  res
    ``[p.u.u.res !<(vase [-:!>(*vase) q.u.u.res])]
  ::
  ++  remote-scry
    |=  =spur
    ^-  (unit (unit cage))
    =/  res
      %-  ~(peek le:part:snap [[pit vil] sol]:snap)
      [~ / [%ax [who %$ da+scry-time:pier-data] spur]]
    ?~    res  res
    ?~  u.res  res
    ``[p.u.u.res !<(vase [-:!>(*vase) q.u.u.res])]
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
  %+  turn-events  events
  |=  [pev=theseus-event thus=_this]
  =.  this  thus
  (push-events:(pe who.pev) [ue.pev]~)
::
++  poke-action
  |=  act=action
  ^-  (quip card _state)
  ?-    -.act
  ::
      %init-ship
    =.  this  apex-theseus  =<  abet-theseus
    =.  this  abet-pe:unpause:(publish-effect:(pe who.act) [/ %kill ~])
    =/  clay  (clay-core who.act)
    =.  ruf.clay
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (~(got by caches) cache.act)
    :: have to get rid of the kids desk otherwise boot fails
    =.  dos.rom.ruf.clay  (~(del by dos.rom.ruf.clay) %kids)
    =/  new  (~(got by piers) who.act)
    =.  sol.snap.new
      ^-  soul
      :*  [who.act *@da *@uvJ]                         ::  mien
          &                                            ::  fad
          :_  |                                        ::  zen
          :-  [~.nonce /theseus]
          :~  zuse+zuse
              lull+lull
              arvo+arvo
              hoon+hoon-version
              nock+4
          ==
          :^  files  !>(..lull)  !>(..zuse)            ::  mod
          %-  ~(gas by *(map term vane))               ::  van.mod
          :~  [%ames [!>((ames-core who.act)) *worm]]
              [%behn [!>((behn-core who.act)) *worm]]
              [%clay [!>(clay) *worm]]
              [%dill [!>((dill-core who.act)) *worm]]
              [%eyre [!>((eyre-core who.act)) *worm]]
              [%gall [!>((gall-core who.act)) *worm]]
              [%iris [!>((iris-core who.act)) *worm]]
              [%jael [!>((jael-core who.act)) *worm]]
              [%khan [!>((khan-core who.act)) *worm]]
      ==  ==
    =.  piers  (~(put by piers) who.act new)
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
          [/c/commit/(scot %p who.act) (prune-boot-park park)]
      ==
    (pe who.act)
  ::
      %init-moon
    =.  this  apex-theseus  =<  abet-theseus
    =.  this  abet-pe:unpause:(publish-effect:(pe who.act) [/ %kill ~])
    =/  clay  (clay-core who.act)
    =.  ruf.clay
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (~(got by caches) cache.act)
    :: have to get rid of the kids desk otherwise boot fails
    =.  dos.rom.ruf.clay  (~(del by dos.rom.ruf.clay) %kids)
    =/  new  (~(got by piers) who.act)
    =.  sol.snap.new
      ^-  soul
      :*  [who.act *@da *@uvJ]                         ::  mien
          &                                            ::  fad
          :_  |                                        ::  zen
          :-  [~.nonce /theseus]
          :~  zuse+zuse
              lull+lull
              arvo+arvo
              hoon+hoon-version
              nock+4
          ==
          :^  files  !>(..lull)  !>(..zuse)            ::  mod
          %-  ~(gas by *(map term vane))               ::  van.mod
          :~  [%ames [!>((ames-core who.act)) *worm]]
              [%behn [!>((behn-core who.act)) *worm]]
              [%clay [!>(clay) *worm]]
              [%dill [!>((dill-core who.act)) *worm]]
              [%eyre [!>((eyre-core who.act)) *worm]]
              [%gall [!>((gall-core who.act)) *worm]]
              [%iris [!>((iris-core who.act)) *worm]]
              [%jael [!>((jael-core who.act)) *worm]]
              [%khan [!>((khan-core who.act)) *worm]]
      ==  ==
    =.  piers  (~(put by piers) who.act new)
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ^-  (list unix-event)
      ::  boot %dawn with the real key (ring).  Minimal dawn-event: empty
      ::  spon/czar/turf boots the identity without azimuth context; enough
      ::  to sign packets.  feed %2 = [[%2 ~] who rift=0 [life=1 ring]~].
      :~  [/d/term/1 %boot & %dawn [[%2 ~] who.act 0 [1 key.act]~] ~ ~ ~ 0 ~]
          [/b/behn/0v1n.2m9vh %born ~]
          [/i/http-client/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %born ~]
          [/e/http-server/0v1n.2m9vh %live 8.080 `8.445]
          [/a/newt/0v1n.2m9vh %born ~]
          [/c/commit/(scot %p who.act) (prune-boot-park park)]
      ==
    (pe who.act)
  ::
      %kill-ships
    =.  this
      %+  turn-ships  hers.act
      |=  [who=ship thus=_this]
      ~&  theseus+killed+who
      =.  this  thus
      (publish-effect:(pe who) [/ %kill ~])
    =.  piers
      %-  ~(dif by piers)
      %-  ~(gas by *fleet)
      (turn hers.act |=(=ship [ship *pier]))
    `state
  ::
      %snap-ships
    =.  fleet-snaps
      %+  ~(put by fleet-snaps)  path.act
      %-  malt
      %+  murn  hers.act
      |=  her=ship
      ^-  (unit (pair ship pier))
      ?~  per=(~(get by piers) her)  ~
      `[her u.per]
    ~&  theseus+snapshot+path.act
    `state
  ::
      %restore-snap
    =/  to-kill  :: only kill ships in the snapshot
      %-  ~(int in ~(key by piers))
      ~(key by (~(got by fleet-snaps) path.act))
    =.  this
      %+  turn-ships  ~(tap in to-kill)
      |=  [who=ship thus=_this]
      =.  this  thus
      (publish-effect:(pe who) [/ %kill ~])
    =.  piers  (~(got by fleet-snaps) path.act)
    ~&  theseus+restore-snap+path.act
    abet-theseus
  ::
      %delete-snap
    ~&  deleted+path.act
    `state(fleet-snaps (~(del by fleet-snaps) path.act))
  ::
      %unpause-ships
    =.  this  apex-theseus  =<  abet-theseus
    ^+  this
    %+  turn-ships  hers.act
    |=  [who=ship thus=_this]
    =.  this  thus
    ~&  theseus+unpaused+who
    unpause:(pe who)
  ::
      %pause-ships
    =.  this  apex-theseus  =<  abet-theseus
    ^+  this
    %+  turn-ships  hers.act
    |=  [who=ship thus=_this]
    =.  this  thus
    ~&  theseus+paused+who
    pause:(pe who)
  ::
      %wish
    ~&  her.act^%wished^(wish:snap:pier-data:(pe her.act) p.act)
    `state
  ::
      %slap-gall
    =.  this  abet-pe:(slap-gall:(pe her.act) [dap.act vase.act])
    ~&  theseus+slap-gall+her.act
    `state
  ::
      %ames-inbound
    ?.  (~(has by piers) who.act)
      ~&  [%theseus-ames-inbound-missing who.act]
      `state
    ~&  [%theseus-ames-inbound who=who.act lane=lane.act blob-size=(met 3 blob.act)]
    =.  this  apex-theseus  =<  abet-theseus
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ~[[/a/newt/0v1n.2m9vh %hear lane.act blob.act]]
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
      ?^  who.act
        =|  =raft:clay-types
        =+  ruf=raft:(pe u.who.act)
        %=    raft
            fad  fad.ruf
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
      =.  fad.raft
        .^(flow:clay %cx /(scot %p our.bowl)//(scot %da now.bowl)/flow)
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
      (~(got by caches) name.act)
    =/  all=(list ship)
      %+  murn  ~(tap in piers)
      |=  [=ship =pier]
      ?:  paused.pier  ~
      ::  can't inject desks if they haven't been installed 
      ?.  =(desks (~(int in (raft-desks raft:(pe ship))) desks))
        ~
      ~&  theseus+rebuilding+ship
      `ship
    ?~  all  ~&  theseus+rebuild+%no-running-ships  `state
    ::  build it on one ship
    =^  cad  state  (poke-theseus-events [i.all /c/rebuild park.act]~)
    ::  re-make the %cache
    ?>  ?=(%park -.park.act)
    =+  raf=raft:(pe i.all) :: TODO error prone, might need to fetch particular desks
    =.  caches  (~(put by caches) name.act raf)
    ::  inject it into all ships
    =.  piers
      %-  ~(gas by piers)
      %+  turn  t.all
      |=  who=ship
      ^-  [ship pier]
      =+  pier=(~(got by piers) who)
      :-  who
      %=    pier
          van.mod.sol.snap
        =+  !<  cay=(tail clay-types)
            vase:(~(got by van.mod.sol.snap.pier) %clay)
        =.  fad.ruf.cay  fad.raf
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
        (~(put by van.mod.sol.snap.pier) %clay [!>(cay) *worm])
      == 
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
  |=  [pax=(list path) dat=(map path (each page lobe:clay-types))]
  ^-  (map path (each page lobe:clay-types))
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
  =/  yok=yoki:clay-types  yok.pak
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
