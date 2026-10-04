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
/-  *theseus, ui=theseus-ui, dock=docket
/+  theseus=theseus,
    default-agent,
    pill=pill,
    dbug, verb, dingy, theseus-kernel
::
::  All Arvo/Clay kernel internals now come through lib/theseus-kernel, which
::  itself has no compile-time /sys import -- kernel material is scried from the
::  host %base at runtime.  So nothing in this desk vendors /sys.
::
=>  |%
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
    ::  desks chosen in the console at boot: each is seeded into the moon's
    ::  Clay from a boot cache, then installed from its source: us, or the
    ::  ship our copy syncs from
    ::
    +$  desk-stage  ?(%seeded %installing %running %failed)
    +$  desk-progress
      $:  =desk
          stage=desk-stage
          reason=(unit @t)
      ==
    +$  install-plan
      $:  desks=(set desk)
          sources=(map desk [=ship =desk])
          progress=(map desk desk-progress)
          started=@da
          updated=@da
      ==
    +$  install-plan-6
      $:  desks=(set desk)
          progress=(map desk desk-progress)
          started=@da
          updated=@da
      ==
    ::  boot cache for one exact desk set, valid while our desk hashes match
    ::
    +$  boot-cache
      $:  hashes=(map desk @uv)
          cache=vase
          built-at=@da
      ==
    +$  state-6
      $:  %6
          piers=fleet
          fleet-snaps=(map path fleet-snapshot)
          files=(axal (cask))
          park=vase
          caches=(map @tas vase)
          boot-caches=(map (set desk) boot-cache)
          install-plans=(map ship install-plan-6)
          install-timer=(unit @da)
      ==
    +$  state-7
      $:  %7
          piers=fleet
          fleet-snaps=(map path fleet-snapshot)
          files=(axal (cask))
          park=vase
          caches=(map @tas vase)
          boot-caches=(map (set desk) boot-cache)
          install-plans=(map ship install-plan)
          install-timer=(unit @da)
      ==
    ::  .booted: when each moon was booted here, for the console's order
    ::
    +$  state-8
      $:  %8
          piers=fleet
          fleet-snaps=(map path fleet-snapshot)
          files=(axal (cask))
          park=vase
          caches=(map @tas vase)
          boot-caches=(map (set desk) boot-cache)
          install-plans=(map ship install-plan)
          install-timer=(unit @da)
          booted=(map ship @da)
      ==
    ::  %9: as %8; fixes .booted for moons seeded from a boot cache, whose
    ::  first %base commit is the host's, not theirs
    ::
    +$  state-9
      $:  %9
          piers=fleet
          fleet-snaps=(map path fleet-snapshot)
          files=(axal (cask))
          park=vase
          caches=(map @tas vase)
          boot-caches=(map (set desk) boot-cache)
          install-plans=(map ship install-plan)
          install-timer=(unit @da)
          booted=(map ship @da)
      ==
    ::  Snapshot restore is a network continuity transaction, not a plain
    ::  state replacement.  Keep its progress in Gall state so a reload cannot
    ::  reopen transport before the host and guest agree on the new era.
    ::
    +$  recovery-stage  ?(%registering %restarting %failed)
    +$  recovery-job
      $:  peers=(set ship)
          rift=@ud
          life=@ud
          pub=pass
          key=@
          started=@da
          updated=@da
          attempts=@ud
          stage=recovery-stage
          reason=(unit @t)
      ==
    +$  state-10
      $:  %10
          piers=fleet
          fleet-snaps=(map path fleet-snapshot)
          files=(axal (cask))
          park=vase
          caches=(map @tas vase)
          boot-caches=(map (set desk) boot-cache)
          install-plans=(map ship install-plan)
          install-timer=(unit @da)
          booted=(map ship @da)
          recoveries=(map ship recovery-job)
          recovery-timer=(unit @da)
      ==
    +$  versioned-state  $%(state-5 state-6 state-7 state-8 state-9 state-10)
    ++  pack-park
      |=  pak=task:clay
      ^-  vase
      !>(pak)
    ++  unpack-park
      |=  pak=vase
      ^-  task:clay
      !<(task:clay pak)
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
=|  state-10
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
    |^
    ?+    -.q.old-vase  ~|([%theseus-unknown-state -.q.old-vase] !!)
        %10
      =/  old  !<(state-10 old-vase)
      ~&  [%theseus-state-load %10]
      (load-state old)
    ::
        %9
      =/  old  !<(state-9 old-vase)
      ~&  [%theseus-state-migrate %9 %10]
      (load-state (state-9-to-10 old))
    ::
        %8
      =/  old  !<(state-8 old-vase)
      ~&  [%theseus-state-migrate %8 %10]
      (load-state (state-9-to-10 (state-8-to-9 old)))
    ::
        %7
      =/  old  !<(state-7 old-vase)
      ~&  [%theseus-state-migrate %7 %10]
      (load-state (state-9-to-10 (state-7-to-9 old)))
    ::
        %6
      =/  old  !<(state-6 old-vase)
      ~&  [%theseus-state-migrate %6 %10]
      ::  every plan so far installed from us
      ::
      =/  plans=(map ship install-plan)
        %-  ~(run by install-plans.old)
        |=  p=install-plan-6
        ^-  install-plan
        :*  desks.p
            %-  ~(gas by *(map desk [=ship =desk]))
            %+  turn  ~(tap in desks.p)
            |=(d=desk [d our.bowl ?:(=(d %base) %kids d)])
            progress.p
            started.p
            updated.p
        ==
      %-  load-state
      %-  state-9-to-10
      %-  state-7-to-9
      :*  %7  piers.old  fleet-snaps.old  files.old  park.old  caches.old
          boot-caches.old  plans  install-timer.old
      ==
    ::
        %5
      =/  old  !<(state-5 old-vase)
      ~&  [%theseus-state-migrate %5 %10]
      %-  load-state
      %-  state-9-to-10
      (state-7-to-9 [%7 piers.old fleet-snaps.old files.old park.old caches.old ~ ~ ~])
    ==
    ::  Gall reloads do not replay outstanding Behn waits.  Clear the saved
    ::  timer and re-arm it from persisted jobs before accepting traffic.
    ::
    ++  load-state
      |=  new=state-10
      ^-  (quip card _this)
      =.  this  this(state new(recovery-timer ~))
      =^  cards  state  arm-recovery-timer:hc
      [cards this]
    ::  moons from before %8 get the time of their boot commit
    ::
    ++  state-7-to-9
      |=  old=state-7
      ^-  state-9
      =/  dflt  (~(get by caches.old) %default)
      :*  %9  piers.old  fleet-snaps.old  files.old  park.old  caches.old
          boot-caches.old  install-plans.old  install-timer.old
          %-  ~(urn by piers.old)
          |=([who=ship saved=saved-pier] (moon-born:hc who saved install-plans.old dflt))
      ==
    ::  %8 gave seeded moons their host's first %base commit time; redo those
    ::
    ++  state-8-to-9
      |=  old=state-8
      ^-  state-9
      =/  dflt  (~(get by caches.old) %default)
      =/  fixed=(map ship @da)
        %-  ~(urn by piers.old)
        |=  [who=ship saved=saved-pier]
        =/  had  (~(get by booted.old) who)
        ?:  ?&  ?=(^ had)
                !=(had (base-commit-date:hc who saved 1))
            ==
          u.had
        (moon-born:hc who saved install-plans.old dflt)
      [%9 +.old(booted fixed)]
    ::  %10 adds only persisted restore coordination; old states begin idle.
    ::
    ++  state-9-to-10
      |=  old=state-9
      ^-  state-10
      :*  %10
          piers.old
          fleet-snaps.old
          files.old
          park.old
          caches.old
          boot-caches.old
          install-plans.old
          install-timer.old
          booted.old
          *(map ship recovery-job)
          *(unit @da)
      ==
    --
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      ?+  mark  ~|([%theseus-bad-mark mark] !!)
        %theseus-ui
          ?>  =(src.bowl our.bowl)
          =/  cmd  !<(command:ui vase)
          ?-  -.cmd
            %boot
              ?>  (child-of:dingy our.bowl who.cmd)
              ?>  ?&((gth (lent desks.cmd) 0) (lte (lent desks.cmd) 64))
              =/  kp  (gen-keypair:dingy (key-seed:dingy who.cmd 0 eny.bowl))
              (poke-action:hc [%init-moon-desks who.cmd desks.cmd pub.kp priv.kp])
            %dojo
              ?>  (lte (met 3 command.cmd) 16.384)
              ?>  !(recovery-blocked:hc who.cmd)
              (poke-theseus-events:hc (dojo-events:theseus who.cmd (trip command.cmd)))
            %term
              ?>  (~(has by piers) who.cmd)
              ?>  !(recovery-blocked:hc who.cmd)
              %-  poke-theseus-events:hc
              %+  turn
                ^-  (list unix-event)
                ?-    -.act.cmd
                    %hail  [/d/term/1 %hail ~]~
                    %size
                  ?>  &((gth p.p.act.cmd 0) (lte p.p.act.cmd 1.000))
                  ?>  &((gth q.p.act.cmd 0) (lte q.p.act.cmd 1.000))
                  [/d/term/1 %blew p.act.cmd]~
                ::
                    %belts
                  ?>  (lte (lent p.act.cmd) 256)
                  %+  turn  p.act.cmd
                  |=  b=belt:dill
                  ?>  ?|(!?=([%txt *] b) (lte (lent p.b) 4.096))
                  [/d/term/1 %belt b]
                ==
              |=(ue=unix-event [who.cmd ue])
            %pause   (poke-action:hc [%pause-ships ~[who.cmd]])
            %resume  (poke-action:hc [%unpause-ships ~[who.cmd]])
            %kill    (poke-action:hc [%kill-ships ~[who.cmd]])
            %snapshot
              ?>  ?&((gth (lent ships.cmd) 0) (lte (lent ships.cmd) 64))
              ::  a snapshot pauses its moons; with .resume, those that were
              ::  running carry on once it is sealed
              ::
              =/  running=(list ship)
                %+  skip  ships.cmd
                |=  her=ship
                ?~  pier=(~(get by piers) her)  &
                paused.u.pier
              =^  snap-cards  state
                (poke-action:hc [%snap-ships /[name.cmd] ships.cmd])
              ?:  |(!resume.cmd =(~ running))  [snap-cards state]
              =^  resume-cards  state
                (poke-action:hc [%unpause-ships running])
              [(weld snap-cards resume-cards) state]
            %restore  (poke-action:hc [%restore-snap path.cmd])
            %delete   (poke-action:hc [%delete-snap path.cmd])
          ==
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
        [%x %ui ~]
      ``json+!>(ui-state:hc)
        [%x %desks ~]
      ``json+!>(ui-host-desks:hc)
    ::  host-only (Eyre /~/scry requires the owner): login code and whether
    ::  %landscape is installed, read from inside the moon at open time
    ::
        [%x %web @ ~]
      ``json+!>((ui-web:hc (slav %p i.t.t.path)))
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
      ~(tap in (cache-desks:theseus-kernel our.bowl now.bowl (~(got by caches) i.t.t.path)))
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
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    ?+    wire  (on-arvo:def wire sign-arvo)
        [%install-plans @ ~]
      ?>  ?=([%behn %wake *] sign-arvo)
      =^  cards  state  (wake-install-plans:hc (slav %da i.t.wire))
      [cards this]
    ::
        [%recoveries @ ~]
      ?>  ?=([%behn %wake *] sign-arvo)
      =^  cards  state  (wake-recoveries:hc (slav %da i.t.wire))
      [cards this]
    ==
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
++  ui-state
  ^-  json
  =,  enjs:format
  %-  pairs
  :~  [%host s+(scot %p our.bowl)]
      [%version (numb 2)]
      [%moons a+(turn ~(tap by piers) ui-moon)]
      [%caches a+(turn ~(tap by caches) |=([name=@tas cache=vase] s+name))]
      [%snapshots a+(turn ~(tap by fleet-snaps) ui-snapshot)]
  ==
::
++  ui-moon
  |=  [who=ship saved=saved-pier]
  ^-  json
  =/  h  (health-of who saved)
  =/  recovery  (~(get by recoveries) who)
  =,  enjs:format
  %-  pairs
  :~  [%ship s+(scot %p who)]
      [%status s+status.h]
      [%paused b+paused.h]
      [%queued (numb queued.h)]
      [%identity b+identity-ok.h]
      [%vanes a+(turn ~(tap in vanes.h) |=(v=@tas s+v))]
      [%desks a+(ui-plan who)]
      :-  %recovery
      ?~  recovery  ~
      %-  pairs
      :~  [%stage s+stage.u.recovery]
          [%attempts (numb attempts.u.recovery)]
          [%reason ?~(reason.u.recovery ~ s+u.reason.u.recovery)]
      ==
      :-  %booted
      ?~(b=(~(get by booted) who) ~ (numb (unm:chrono:userlib u.b)))
  ==
::  +moon-born: when a moon booted before boot times were kept was booted
::
::    Its install plan's start, if it has one.  Otherwise its boot commit:
::    the first %base commit after the history seeded from the boot cache
::    (.dflt), which is the host's.  Now if neither can be read.
::
++  moon-born
  |=  [who=ship saved=saved-pier plans=(map ship install-plan) dflt=(unit vase)]
  ^-  @da
  =/  plan  (~(get by plans) who)
  ?^  plan  started.u.plan
  =/  seeded=@ud
    ?~  dflt  0
    (fall (cache-base-let:theseus-kernel snap.saved u.dflt) 0)
  (fall (base-commit-date who saved +(seeded)) now.bowl)
::
++  base-commit-date
  |=  [who=ship saved=saved-pier aeon=@ud]
  ^-  (unit @da)
  =/  res
    %-  mole  |.
    (peek-arvo:theseus-kernel snap.saved [[~ ~] / %cw [who %base ud+aeon] /])
  ?.  ?=([~ ~ ~ *] res)  ~
  =/  got  (mole |.(;;(cass:clay q.q.u.u.u.res)))
  ?~(got ~ `da.u.got)
::
++  ui-plan
  |=  who=ship
  ^-  (list json)
  =/  plan  (~(get by install-plans) who)
  ?~  plan  ~
  %+  turn  ~(tap by progress.u.plan)
  |=  [=desk pro=desk-progress]
  =/  src  (~(get by sources.u.plan) desk)
  =,  enjs:format
  %-  pairs
  :~  [%desk s+desk]
      [%stage s+stage.pro]
      [%reason ?~(reason.pro ~ s+u.reason.pro)]
      :-  %source
      ?~  src  ~
      (pairs ~[[%ship s+(scot %p ship.u.src)] [%desk s+desk.u.src]])
  ==
::
++  host-desk-set
  ^-  (set desk)
  .^((set desk) %cd /(scot %p our.bowl)//(scot %da now.bowl))
::
++  host-pikes
  ^-  kiln-pikes
  ;;  kiln-pikes
  .^(* %gx /(scot %p our.bowl)/hood/(scot %da now.bowl)/kiln/pikes/kiln-pikes)
::
::  a desk with a docket is a Landscape app and needs %landscape; the
::  docket itself is only read for its title, so a bad one costs the title
::
++  host-has-docket
  |=  des=desk
  ^-  ?
  .^(? %cu /(scot %p our.bowl)/[des]/(scot %da now.bowl)/desk/docket-0)
::
++  host-docket
  |=  des=desk
  ^-  (unit docket:dock)
  ?.  (host-has-docket des)  ~
  %-  mole  |.
  .^(docket:dock %cx /(scot %p our.bowl)/[des]/(scot %da now.bowl)/desk/docket-0)
::
++  ui-host-desks
  ^-  json
  =/  pks  host-pikes
  =/  rows=(list json)
    %+  turn
      %+  sort
        %+  skim  ~(tap in host-desk-set)
        |=(d=desk &(!=(d %kids) !=(d %theseus)))
      |=  [a=desk b=desk]
      ?:  =(a %base)  &
      ?:  =(b %base)  |
      (aor a b)
    |=  des=desk
    =/  pik  (~(get by pks) des)
    =/  doc  (host-docket des)
    =/  dep=(list desk)
      ?:  |(=(des %landscape) !(host-has-docket des))  ~
      ~[%landscape]
    =,  enjs:format
    %-  pairs
    :~  [%desk s+des]
        [%title ?~(doc ~ s+title.u.doc)]
        [%running b+?:(?=(^ pik) =(%live zest.u.pik) |)]
        [%hash ?~(pik ~ s+(scot %uv hash.u.pik))]
        [%source ?~(pik ~ ?~(sync.u.pik ~ (pairs ~[[%ship s+(scot %p ship.u.sync.u.pik)] [%desk s+desk.u.sync.u.pik]])))]
        [%dependencies a+(turn dep |=(d=desk s+d))]
    ==
  =,  enjs:format
  (pairs ~[[%version (numb 1)] [%desks a+rows]])
::
++  ui-web
  |=  who=ship
  ^-  json
  =/  saved  (~(got by piers) who)
  ::  Jael only answers %code locally ([~ ~]) at the kernel's current time.
  =/  peek
    |=  [vis=term bem=beam]
    ^-  (unit *)
    =/  res  (mole |.((peek-arvo:theseus-kernel snap.saved [[~ ~] / vis bem])))
    ?.  ?=([~ ~ ~ *] res)  ~
    `q.q.u.u.u.res
  =/  code=(unit @)
    (bind (peek %j [who %code da+scry-time.saved] /(scot %p who)) |=(n=* ;;(@ n)))
  =/  desks=(set desk)
    (fall (bind (peek %cd [who %$ da+scry-time.saved] /) |=(n=* ;;((set desk) n))) ~)
  =,  enjs:format
  %-  pairs
  :~  [%ship s+(scot %p who)]
      [%code ?~(code ~ s+(rsh 3 (scot %p u.code)))]
      [%landscape b+(~(has in desks) %landscape)]
  ==
::
++  ui-snapshot
  |=  [p=path shot=fleet-snapshot]
  ^-  json
  =,  enjs:format
  %-  pairs
  :~  [%path (path:enjs:format p)]
      [%created s+(scot %da created-at.shot)]
      [%compatible b+=(runtime.shot current-runtime)]
      [%ships a+(turn ~(tap by ships.shot) |=([who=@p saved=saved-pier] s+(scot %p who)))]
  ==
::
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
      ::  answers to pokes we injected (e.g. |install): report only nacks
      ::
      ?:  =(p.card.i.effects %unto)
        =/  ack  (mole |.(;;([%poke-ack (unit tang)] q.card.i.effects)))
        ?.  ?=([~ %poke-ack ^] ack)  ..abet-pe
        %.  ..abet-pe
        (slog leaf+"theseus: {<who>} rejected a poke" (flop u.+.u.ack))
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
    ?&  (~(has by piers) who.pev)
        !(recovery-blocked who.pev)
    ==
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
::  +resolve-host-desks: the desks for a new moon, and where each updates from
::
::    %base always comes, tracking our %kids.  A desk with a docket is a
::    Landscape app and brings %landscape (from us, unless chosen).  A
::    %publisher source is the ship our own copy syncs from; a desk we sync
::    from no one can only come from us.
::
++  resolve-host-desks
  |=  requested=(list [=desk from=desk-from])
  ^-  (map desk [=ship =desk])
  =/  available  host-desk-set
  =/  asked=(map desk desk-from)
    (~(put by (malt requested)) %base %host)
  =/  invalid=(list desk)
    %+  skim  ~(tap in ~(key by asked))
    |=  d=desk
    |(=(d %kids) =(d %theseus) !(~(has in available) d))
  ?^  invalid
    ~|([%theseus-boot-invalid-desks invalid] !!)
  =?  asked
      ?&  !(~(has by asked) %landscape)
          (lien ~(tap in ~(key by asked)) host-has-docket)
      ==
    ?.  (~(has in available) %landscape)
      ~|([%theseus-boot-missing-dependency %landscape] !!)
    (~(put by asked) %landscape %host)
  =/  pks  host-pikes
  %-  ~(urn by asked)
  |=  [d=desk from=desk-from]
  ^-  [=ship =desk]
  ?:  =(d %base)  [our.bowl %kids]
  ?:  ?=(%host from)  [our.bowl d]
  =/  up=(unit [=ship =desk])  (biff (~(get by pks) d) |=(k=kiln-pike sync.k))
  ?~  up  ~|([%theseus-boot-no-publisher d] !!)
  ?:  =(our.bowl ship.u.up)  ~|([%theseus-boot-no-publisher d] !!)
  u.up
::  +desk-publishers: ships our copies of .desks sync from, other than us
::
++  desk-publishers
  |=  desks=(set desk)
  ^-  (set ship)
  =/  pks  host-pikes
  %-  silt
  %+  murn  ~(tap in desks)
  |=  d=desk
  ^-  (unit ship)
  ?:  =(d %base)  ~
  =/  up  (biff (~(get by pks) d) |=(k=kiln-pike sync.k))
  ?~  up  ~
  ?:  =(our.bowl ship.u.up)  ~
  `ship.u.up
::
++  host-desk-hashes
  |=  desks=(set desk)
  ^-  (map desk @uv)
  =/  pks  host-pikes
  %-  ~(gas by *(map desk @uv))
  %+  turn  ~(tap in desks)
  |=  d=desk
  =/  pik
    ~|  [%theseus-boot-missing-pike d]
    (~(got by pks) d)
  [d hash.pik]
::
::  +plan-for: progress for a new install plan, every desk but %base at .stage
::
++  plan-for
  |=  [sources=(map desk [=ship =desk]) stage=desk-stage]
  ^-  install-plan
  =/  desks  ~(key by sources)
  :*  desks
      sources
      %-  ~(gas by *(map desk desk-progress))
      %+  turn  ~(tap in desks)
      |=(d=desk [d d ?:(=(d %base) %running stage) ~])
      now.bowl
      now.bowl
  ==
::  +kiln-install-event: |install .des from .src, inside the moon
::
::    Same as typing |install in the moon's dojo, without the parsing.  The
::    seeded desk already has .src's history, so this sets its source.
::
++  kiln-install-event
  |=  [who=ship des=desk src=[=ship =desk]]
  ^-  theseus-event
  :-  who
  :*  /g
      %deal
      `sack`[who who /theseus/install/[des]]
      %hood
      `deal:gall`[%raw-poke %kiln-install [des ship.src desk.src]]
  ==
::  +treaty-ally-event: ally .her in the moon's %treaty
::
::    Landscape allies a publisher before installing its apps, and Docket
::    installs only apps whose treaty it has.  Kiln's |install skips this, so
::    without it the moon can't install anything else from .her (e.g. an
::    app's in-app "install Noltbook" button).
::
++  treaty-ally-event
  |=  [who=ship her=ship]
  ^-  theseus-event
  :-  who
  :*  /g
      %deal
      `sack`[who who /theseus/ally]
      %treaty
      `deal:gall`[%raw-poke %ally-update-0 [%add her]]
  ==
::
++  moon-pikes
  |=  who=ship
  ^-  (unit kiln-pikes)
  =/  saved  (~(get by piers) who)
  ?~  saved  ~
  =/  res
    %-  mole  |.
    %+  peek-arvo:theseus-kernel  snap.u.saved
    [[~ ~] / %gx [who %hood da+scry-time.u.saved] /kiln/pikes/kiln-pikes]
  ?.  ?=([~ ~ ~ *] res)  ~
  (mole |.(;;(kiln-pikes q.q.u.u.u.res)))
::
++  plan-pending
  |=  plan=install-plan
  ^-  ?
  %+  lien  ~(val by progress.plan)
  |=(pro=desk-progress ?=(?(%seeded %installing) stage.pro))
::  +next-progress: one chosen desk's stage, from the moon's Kiln
::
::    Kiln may not have handled the install yet, and keeps a seeded desk
::    %dead until its first merge from us, so neither is a failure until the
::    plan is .late.  A desk that tracks some other source has failed.
::
++  next-progress
  |=  [d=desk src=[=ship =desk] pik=(unit kiln-pike) late=?]
  ^-  desk-progress
  ?:  =(d %base)  [d %running ~]
  =/  wait=desk-progress
    ?.  late  [d %installing ~]
    [d %failed `'Timed out waiting for Kiln to install the desk.']
  ?~  pik  wait
  ?~  sync.u.pik  wait
  ?.  =(src u.sync.u.pik)
    [d %failed `'The desk tracks another source.']
  ?:(?=(%live zest.u.pik) [d %running ~] wait)
::
++  install-timeout  ~m20
++  install-poll  ~s2
::
++  refresh-install-plans
  ^-  (map ship install-plan)
  %-  ~(urn by install-plans)
  |=  [who=ship plan=install-plan]
  ?.  (plan-pending plan)  plan
  =/  pks  (moon-pikes who)
  =/  late=?  (gth now.bowl (add started.plan install-timeout))
  ?:  &(?=(~ pks) !late)  plan
  =/  got=kiln-pikes  (fall pks ~)
  %=    plan
      updated  now.bowl
      progress
    %-  ~(urn by progress.plan)
    |=  [d=desk pro=desk-progress]
    ?.  ?=(?(%seeded %installing) stage.pro)  pro
    (next-progress d (~(gut by sources.plan) d [our.bowl d]) (~(get by got) d) late)
  ==
::  +arm-install-timer: poll Kiln while any install is pending
::
++  arm-install-timer
  ^-  (quip card _state)
  ?^  install-timer  `state
  ?.  (lien ~(val by install-plans) plan-pending)  `state
  =/  when  (add now.bowl install-poll)
  :_  state(install-timer `when)
  [%pass /install-plans/(scot %da when) %arvo %b %wait when]~
::
++  wake-install-plans
  |=  when=@da
  ^-  (quip card _state)
  ?.  =(`when install-timer)  `state
  =.  install-timer  ~
  =.  install-plans  refresh-install-plans
  arm-install-timer
::  +arm-recovery-timer: advance persisted restore transactions.
::
++  recovery-poll  ~s1
++  recovery-timeout  ~s30
++  recovery-max-attempts  30
::
++  recovery-pending
  |=  job=recovery-job
  ^-  ?
  ?=(?(%registering %restarting) stage.job)
::
++  arm-recovery-timer
  ^-  (quip card _state)
  ?^  recovery-timer  `state
  ?.  (lien ~(val by recoveries) recovery-pending)  `state
  =/  when  (add now.bowl recovery-poll)
  :_  state(recovery-timer `when)
  [%pass /recoveries/(scot %da when) %arvo %b %wait when]~
::
++  fail-recovery
  |=  [who=ship job=recovery-job reason=@t]
  ^-  (quip card _state)
  =/  saved  (~(get by piers) who)
  =?  piers  ?=(^ saved)
    (~(put by piers) who u.saved(paused &))
  =.  recoveries
    (~(put by recoveries) who job(stage %failed, updated now.bowl, reason `reason))
  ~&  [%theseus-recovery-failed who reason]
  :_  state
  :_  ~
  :^  %pass  /theseus-pyre  %agent
  :+  [our.bowl %theseus-pyre]  %poke
  theseus-effect+!>(`theseus-effect`[who [/ %kill ~]])
::
++  poll-recovery
  |=  [who=ship job=recovery-job]
  ^-  (quip card _state)
  ?-    stage.job
      %registering
    =/  confirmed=(unit ?)
      (mole |.((recovery-confirmed who job)))
    ?:  ?&(?=(^ confirmed) u.confirmed)
      =/  result=(each (quip card _state) tang)
        (mule |.((finish-recovery who job)))
      ?:  ?=(%| -.result)
        ~&  [%theseus-recovery-reset-crash who p.result]
        (fail-recovery who job 'The restored moon failed its local continuity reset.')
      p.result
    ?:  ?|  (gte attempts.job recovery-max-attempts)
            (gth now.bowl (add started.job recovery-timeout))
        ==
      (fail-recovery who job 'Host Jael did not confirm the new continuity era.')
    =/  next  job(attempts +(attempts.job), updated now.bowl)
    =.  recoveries  (~(put by recoveries) who next)
    [(recovery-register-cards who next) state]
  ::
      %restarting
    =/  saved  (~(get by piers) who)
    ?~  saved
      (fail-recovery who job 'The restored moon disappeared during restart.')
    =/  hel  (health-of who u.saved)
    ?:  ?&  =(%healthy status.hel)
            !paused.hel
            =(0 queued.hel)
        ==
      ~&  [%theseus-recovery-complete who rift=rift.job life=life.job]
      `state(recoveries (~(del by recoveries) who))
    ?:  ?|  (gte attempts.job recovery-max-attempts)
            (gth now.bowl (add updated.job recovery-timeout))
        ==
      (fail-recovery who job 'The restored moon did not become healthy after its runtime restart.')
    =.  recoveries
      (~(put by recoveries) who job(attempts +(attempts.job)))
    `state
  ::
      %failed  `state
  ==
::
++  wake-recoveries
  |=  when=@da
  ^-  (quip card _state)
  ?.  =(`when recovery-timer)  `state
  =.  recovery-timer  ~
  =/  jobs  ~(tap by recoveries)
  =/  out  *(list card)
  |-
  ?~  jobs
    =^  timer-cards  state  arm-recovery-timer
    [(weld out timer-cards) state]
  =/  current  (~(get by recoveries) p.i.jobs)
  ?~  current  $(jobs t.jobs)
  =^  more  state  (poll-recovery p.i.jobs u.current)
  $(jobs t.jobs, out (weld out more))
::  +prune-boot-caches: keep the newest few still matching our desks
::
::    Each boot cache holds a copy of our Clay data, so drop any whose desk
::    hashes no longer match ours (it would never be reused) and cap the rest.
::
++  max-boot-caches  8
++  prune-boot-caches
  |=  bcs=(map (set desk) boot-cache)
  ^-  (map (set desk) boot-cache)
  =/  pks  host-pikes
  =/  live=(list [(set desk) boot-cache])
    %+  skim  ~(tap by bcs)
    |=  [desks=(set desk) bc=boot-cache]
    %+  levy  ~(tap by hashes.bc)
    |=  [d=desk h=@uv]
    =(`h (bind (~(get by pks) d) |=(k=kiln-pike hash.k)))
  %-  ~(gas by *(map (set desk) boot-cache))
  %+  scag  max-boot-caches
  %+  sort  live
  |=  [a=[(set desk) boot-cache] b=[(set desk) boot-cache]]
  (gth built-at.+.a built-at.+.b)
::
::  +boot-moon: boot .who from .cache, then install .installs from us
::
::    Only %base is in the moon's Clay at boot.  Kiln's +on-init revives
::    every desk present then, during the boot cascade and before Eyre's
::    %init, which resets Eyre's bindings: a Landscape app started that way
::    loses its /apps binding.  So the cache's other desks are added once
::    the moon has booted, with their history (the files are already in
::    .ran from the cache), and revived; then each of .installs other than
::    %base is |installed from us so it tracks our copy.
::
++  boot-moon
  |=  $:  act=[who=ship cache=vase pub=pass key=@]
          installs=(map desk [=ship =desk])
          allies=(set ship)
      ==
  ^-  (quip card _state)
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
  ::  Provision the moon with our current view of its whole sponsor chain
  ::  (us -> star -> galaxy); see +boot-chain.
  =/  chain=(list ship)
    .^((list ship) %j /(scot %p our.bowl)/saxo/(scot %da now.bowl)/(scot %p our.bowl))
  =/  boot  (boot-chain chain)
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
  =/  ker=kernel:theseus-kernel
    (build:theseus-kernel our.bowl now.bowl)
  =/  later=(set desk)
    %-  ~(dif in (raft-desks:theseus-kernel clay.ker cache.act))
    (sy ~[%base %kids])
  =^  cards  state
    =.  this  apex-theseus  =<  abet-theseus
  =/  clay-vase
    (seed-clay-keep:theseus-kernel clay.ker who.act cache.act (sy ~[%base]))
  ::  Build the complete typed pier off-map.  Never expose an empty placeholder:
  ::  if construction fails, no fleet record exists; if it succeeds, the first
  ::  visible record already contains all nine vanes.
  =/  new=pier  *pier
  =.  new  new(snap (make-arvo:theseus-kernel who.act ker files clay-vase), paused |)
  =.  piers  (~(put by piers) who.act (pack-pier new))
  =.  this
    =<  abet-pe:plow
    %-  push-events:(pe who.act)
    ^-  (list unix-event)
    ::  boot %dawn with the real key (ring), the sponsor chain (spon, czar)
    ::  and turf, scried from our Jael.
    ::  feed %2 = [[%2 ~] who rift [life ring]~].
    :~  [/d/term/1 %boot & %dawn [[%2 ~] who.act moon-rift [moon-life key.act]~] spon.boot czar.boot turves 0 ~]
        [/b/behn/0v1n.2m9vh %born ~]
        [/i/http-client/0v1n.2m9vh %born ~]
        [/e/http-server/0v1n.2m9vh %born ~]
        [/e/http-server/0v1n.2m9vh %live 8.080 `8.445]
        [/a/newt/0v1n.2m9vh %born ~]
        [/c/commit/(scot %p who.act) (prune-boot-park (unpack-park park))]
    ==
    (pe who.act)
  =/  boot-cards  (weld reg-cards cards)
  =.  booted  (~(put by booted) who.act now.bowl)
  =?  install-plans  !=(~ installs)
    (~(put by install-plans) who.act (plan-for installs %installing))
  ?:  =(~ later)  [boot-cards state]
  =.  piers
    =/  pier=pier  (unpack-pier (~(got by piers) who.act))
    %+  ~(put by piers)  who.act
    (pack-pier pier(snap (inject-desks:theseus-kernel snap.pier cache.act later)))
  ::  revive the added desks, |install each from its source, then ally
  ::  publishers once %treaty (in %landscape) is running
  ::
  =/  events=(list theseus-event)
    ;:  weld
      %+  turn  ~(tap in later)
      |=(d=desk `theseus-event`[who.act /c/zest/[d] %zest d %live])
    ::
      %+  turn  (skip ~(tap by installs) |=([d=desk *] =(d %base)))
      |=([d=desk src=[=ship =desk]] (kiln-install-event who.act d src))
    ::
      ?.  (~(has in later) %landscape)  ~
      (turn ~(tap in allies) |=(her=ship (treaty-ally-event who.act her)))
    ==
  =^  event-cards  state  (poke-theseus-events events)
  =^  timer-cards  state  arm-install-timer
  [:(weld boot-cards event-cards timer-cards) state]
::
++  is-our-moon
  |=  who=ship
  ^-  ?
  ?&  ?=(%earl (clan:title who))
      =(our.bowl (^sein:title who))
  ==
::  Snapshot recovery is a staged breach.  Host Jael registration happens
::  while the restored moon is paused and its Pyre transport is shut.  Only
::  after the registered life, rift and key can be read back do we reset the
::  moon's own continuity state and restart its outer runtime.
::
++  recovery-register-cards
  |=  [who=ship job=recovery-job]
  ^-  (list card)
  :~  :*  %pass  /theseus/recovery/rift/(scot %p who)  %arvo  %j
          %moon  who  [*id:block:jael %rift rift.job %.n]
      ==
      :*  %pass  /theseus/recovery/keys/(scot %p who)  %arvo  %j
          %moon  who  [*id:block:jael %keys [life.job 1 pub.job] %.n]
      ==
  ==
::
++  recovery-confirmed
  |=  [who=ship job=recovery-job]
  ^-  ?
  =/  got-life=(unit @ud)
    .^((unit @ud) %j /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p who))
  =/  got-rift=(unit @ud)
    .^((unit @ud) %j /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p who))
  ?:  |(?=(~ got-life) ?=(~ got-rift))  |
  =/  got-key=(unit [suite=@ud =pass])
    .^  (unit [@ud pass])  %j
      /(scot %p our.bowl)/puby/(scot %da now.bowl)/(scot %p who)/(scot %ud life.job)
    ==
  ?~  got-key  |
  ?&  =(life.job u.got-life)
      =(rift.job u.got-rift)
      =(1 suite.u.got-key)
      =(pub.job pass.u.got-key)
  ==
::
++  recovery-blocked
  |=  who=ship
  ^-  ?
  =/  job  (~(get by recoveries) who)
  ?~  job  |
  !?=(%restarting stage.u.job)
::
::  +ruin-peers: tell one of a moon's Jael trackers that .peers breached
::
::    Jael's %ruin, aimed at .tracker alone (see +set-jael-trackers).  An
::    arm, not a gate pinned in the caller: a pinned gate keeps the state it
::    was made with, so a second call would start from before the first and
::    throw its work away.
::
++  ruin-peers
  |=  [who=ship peers=(set ship) tracker=(unit duct)]
  ^-  (quip card _state)
  ?~  tracker  `state
  =/  run=pier  (unpack-pier (~(got by piers) who))
  =.  piers
    %+  ~(put by piers)  who
    %-  pack-pier
    run(snap (set-jael-trackers:theseus-kernel snap.run (sy u.tracker ~) ~))
  (poke-theseus-events [who /j/theseus/recovery %ruin peers]~)
::
::  +finish-recovery: apply the confirmed era inside the offline moon.
::
++  finish-recovery
  |=  [who=ship job=recovery-job]
  ^-  (quip card _state)
  =/  pier=pier  (unpack-pier (~(got by piers) who))
  =/  trackers  (jael-trackers:theseus-kernel snap.pier)
  =/  find-tracker
    |=  pre=path
    ^-  (unit duct)
    =/  ducts  ~(tap in ~(key by yen.trackers))
    |-
    ?~  ducts  ~
    ?:  &(?=(^ i.ducts) =(pre i.i.ducts))  `i.ducts
    $(ducts t.ducts)
  ~&  [%theseus-recovery-reset who rift=rift.job life=life.job peers=~(wyt in peers.job)]
  ::  Remove the lock only within this Gall event so the internal reset
  ::  events can run.  No external event can interleave before it is restored.
  ::
  =.  recoveries  (~(del by recoveries) who)
  =.  piers
    %+  ~(put by piers)  who
    %-  pack-pier
    %_    pier
        paused       |
        next-events  *(qeu unix-event)
        snap         (set-own-point:theseus-kernel snap.pier who rift.job life.job pub.job)
    ==
  =^  own-cards  state
    %-  poke-theseus-events
    :~  [who /j/theseus/recovery %rekey life.job key.job]
        [who /a/theseus/recovery %stir 'rift']
    ==
  ::  every peer breached, in Ames and then in Gall.  The Ames reset must
  ::  have wiped every flow with them before Gall reopens any: a flow left
  ::  over would carry on at old message numbers, which peers that processed
  ::  the breach never acknowledge, and stall.
  ::
  =^  ames-cards  state
    (ruin-peers who peers.job (find-tracker /ames/public-keys))
  =/  left=@ud
    (stale-flows:theseus-kernel snap:(unpack-pier (~(got by piers) who)) peers.job)
  ?.  =(0 left)
    ~|([%theseus-recovery-ames-not-reset who flows=left] !!)
  =^  gall-cards  state
    (ruin-peers who peers.job (find-tracker /gall/sys/era))
  ::  restore the trackers, less what Gall untracked on breach
  ::
  =/  gall  (find-tracker /gall/sys/era)
  =/  yen=(jug duct ship)
    ?~  gall  yen.trackers
    %-  ~(rep in peers.job)
    |=  [her=ship y=_yen.trackers]
    (~(del ju y) u.gall her)
  =/  fin=^pier  (unpack-pier (~(got by piers) who))
  =.  piers
    %+  ~(put by piers)  who
    (pack-pier fin(snap (set-jael-trackers:theseus-kernel snap.fin nel.trackers yen)))
  =/  next  job(stage %restarting, updated now.bowl, attempts 0, reason ~)
  =.  recoveries  (~(put by recoveries) who next)
  =/  restart=(list card)
    :_  ~
    :^  %pass  /theseus-pyre  %agent
    :+  [our.bowl %theseus-pyre]  %poke
    theseus-effect+!>(`theseus-effect`[who [/ %restart ~]])
  [:(weld restart own-cards ames-cards gall-cards) state]
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
    =/  clay-vase
      %^  seed-clay:theseus-kernel  clay.ker  who.act
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (~(got by caches) cache.act)
    =/  new=pier  *pier
    =.  snap.new  (make-arvo:theseus-kernel who.act ker files clay-vase)
    =.  piers  (~(put by piers) who.act (pack-pier new))
    =.  booted  (~(put by booted) who.act now.bowl)
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
    =/  cache-vase
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (~(got by caches) cache.act)
    (boot-moon [who.act cache-vase pub.act key.act] ~ ~)
  ::
      %init-moon-desks
    ?:  (~(has by piers) who.act)
      ~|([%theseus-init-existing who.act] !!)
    =/  sources  (resolve-host-desks desks.act)
    =/  selected=(set desk)  ~(key by sources)
    =/  hashes  (host-desk-hashes selected)
    =/  prior  (~(get by boot-caches) selected)
    =/  reuse=?  ?&(?=(^ prior) =(hashes hashes.u.prior))
    =/  cache-vase=vase
      ?:  reuse  cache:(need prior)
      (cache-from-host:theseus-kernel our.bowl now.bowl ~(tap in selected))
    =?  boot-caches  !reuse
      %-  prune-boot-caches
      (~(put by boot-caches) selected [hashes cache-vase now.bowl])
    %^  boot-moon  [who.act cache-vase pub.act key.act]
      sources
    (desk-publishers selected)
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
    =/  boot  (boot-chain ?~(chain ~ t.chain))
    =/  turves=(list turf)
      .^((list turf) %j /(scot %p our.bowl)/turf/(scot %da now.bowl))
    =^  cards  state
      =.  this  apex-theseus  =<  abet-theseus
    =/  ker=kernel:theseus-kernel
      (build:theseus-kernel our.bowl now.bowl)
    =/  clay-vase
      %^  seed-clay:theseus-kernel  clay.ker  who.act
      ~|  "{<cache.act>} cache doesn't exist, try %default cache"
      (~(got by caches) cache.act)
    =/  new=pier  *pier
    =.  new  new(snap (make-arvo:theseus-kernel who.act ker files clay-vase), paused |)
    =.  piers  (~(put by piers) who.act (pack-pier new))
    =.  booted  (~(put by booted) who.act now.bowl)
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ^-  (list unix-event)
      :~  [/d/term/1 %boot & %dawn [[%2 ~] who.act u.planet-rift [u.planet-life priv]~] spon.boot czar.boot turves 0 ~]
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
    =.  install-plans
      %-  ~(dif by install-plans)
      %-  ~(gas by *(map ship install-plan))
      (turn hers.act |=(=ship [ship *install-plan]))
    =.  booted
      %-  ~(dif by booted)
      (~(gas by *(map ship @da)) (turn hers.act |=(=ship [ship *@da])))
    =.  recoveries
      %-  ~(dif by recoveries)
      (~(gas by *(map ship recovery-job)) (turn hers.act |=(=ship [ship *recovery-job])))
    ~&  [%theseus-killed hers.act]
    [kill-cards state]
  ::
      %snap-ships
    =/  recovering  (skim hers.act |=(who=ship (~(has by recoveries) who)))
    ?^  recovering
      ~|([%theseus-recovery-still-active recovering] !!)
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
    =/  not-ours  (skip hers is-our-moon)
    ?^  not-ours
      ~|([%theseus-restore-not-owned-moons path.act not-ours] !!)
    =/  busy=(list ship)
      %+  skim  hers
      |=  who=ship
      =/  job  (~(get by recoveries) who)
      ?~  job  |
      !?=(%failed stage.u.job)
    ?^  busy
      ~|([%theseus-restore-already-recovering path.act busy] !!)
    ::  Capture the union of the live and snapshotted peer sets before the
    ::  live pier is replaced.  A post-snapshot peer must also be told about
    ::  the breach or it can retain stale Ames and Gall continuity.
    ::
    =/  jobs=(map ship recovery-job)
      %-  malt
      %+  turn  ~(tap by ships.shot)
      |=  [who=ship saved=saved-pier]
      =/  old-life=(unit @ud)
        .^((unit @ud) %j /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p who))
      =/  old-rift=(unit @ud)
        .^((unit @ud) %j /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p who))
      ?~  old-life  ~|([%theseus-restore-missing-life who] !!)
      ?~  old-rift  ~|([%theseus-restore-missing-rift who] !!)
      =/  life  +(u.old-life)
      =/  rift  +(u.old-rift)
      =/  kp  (gen-keypair:dingy (key-seed:dingy who life eny.bowl))
      =/  snap-run  (unpack-pier saved)
      =/  snap-set  (snap-peers:theseus-kernel snap.snap-run who scry-time.snap-run)
      =/  live-set=(set ship)
        =/  live  (~(get by piers) who)
        ?~  live  ~
        =/  run  (unpack-pier u.live)
        =/  got  (mole |.((snap-peers:theseus-kernel snap.run who scry-time.run)))
        (fall got ~)
      =/  peers  (~(uni in snap-set) live-set)
      [who peers rift life pub.kp priv.kp now.bowl now.bowl 0 %registering ~]
    ::  The restored noun stays paused with an empty input queue until Jael
    ::  confirms registration.  Pyre is shut before any restart is possible.
    ::
    =/  restored=fleet
      %-  malt
      %+  turn  ~(tap by ships.shot)
      |=  [who=ship saved=saved-pier]
      =/  reset=saved-pier
        %_    saved
            paused       &
            next-events  *(qeu unix-event)
        ==
      [who reset]
    =.  piers  (~(uni by piers) restored)
    =.  recoveries  (~(uni by recoveries) jobs)
    =.  booted
      =/  dflt  (~(get by caches) %default)
      %-  ~(uni by booted)
      %-  ~(urn by (~(dif by restored) booted))
      |=([who=ship saved=saved-pier] (moon-born who saved install-plans dflt))
    =/  kill-cards=(list card)
      %+  turn  hers
      |=  who=ship
      :^  %pass  /theseus-pyre  %agent
      :+  [our.bowl %theseus-pyre]  %poke
      theseus-effect+!>(`theseus-effect`[who [/ %kill ~]])
    =/  register-cards=(list card)
      %-  zing
      %+  turn  ~(tap by jobs)
      |=  [who=ship job=recovery-job]
      (recovery-register-cards who job)
    =^  timer-cards  state  arm-recovery-timer
    ~&  theseus+restore-snap+path.act
    [:(weld kill-cards register-cards timer-cards) state]
  ::
      %delete-snap
    ~&  deleted+path.act
    `state(fleet-snaps (~(del by fleet-snaps) path.act))
  ::
      %unpause-ships
    =/  blocked  (skim hers.act |=(who=ship (~(has by recoveries) who)))
    ?^  blocked
      ~|([%theseus-recovery-still-active blocked] !!)
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
    =/  blocked  (skim hers.act |=(who=ship (~(has by recoveries) who)))
    ?^  blocked
      ~|([%theseus-recovery-still-active blocked] !!)
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
    ?:  (~(has by recoveries) her.act)
      ~|([%theseus-recovery-still-active her.act] !!)
    =.  this  abet-pe:(slap-gall:(pe her.act) [dap.act vase.act])
    ~&  theseus+slap-gall+her.act
    `state
  ::
      %ames-inbound
    ?.  (~(has by piers) who.act)
      `state
    ?:  (recovery-blocked who.act)  `state
    ::  A %fine request is normally answered by vere before Arvo sees it.
    ::  Virtual moons have no vere, so ask the moon's own /x/fine/hunk
    ::  responder to scry and sign the requested data, then carry each signed
    ::  fragment back through the guest's UDP transport.  Never inject a fine
    ::  request as %hear: Ames deliberately rejects that event shape.
    =/  fr  (fine-req-path blob.act)
    ?^  fr
      =/  res  (remote-scry:(pe who.act) [%fine %hunk '1' '64' pax.u.fr])
      ?~  res  `state
      ?~  u.res  `state
      =/  yowls  !<((list @) q.u.u.res)
      ?~  yowls  `state
      ::  Without a forwarded origin, answer on the packet's actual source
      ::  lane.  The sender may be a star or planet, never a galaxy lane.
      =/  lane  ?~(origin.u.fr lane.act [%| u.origin.u.fr])
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
    ?:  (recovery-blocked who.act)  `state
    =.  this  apex-theseus  =<  abet-theseus
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ~[[/a/newt/0v1n.2m9vh %heer lane.act blob.act]]
    (pe who.act)
  ::
      %ames-stun
    ?.  (~(has by piers) who.act)
      `state
    ?:  (recovery-blocked who.act)  `state
    =/  stun=stun:ames
      ?-  mode.act
        %once  [%once galaxy.act lane.act]
        %stop  [%stop galaxy.act lane.act]
        %fail  [%fail galaxy.act lane.act]
      ==
    =.  this  apex-theseus  =<  abet-theseus
    =.  this
      =<  abet-pe:plow
      %-  push-events:(pe who.act)
      ~[[/ames %stun stun]]
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
        ::  source the cache from a running virtual ship's raft
        (cache-from-moon:theseus-kernel snap:(pe u.who.act) desks.act)
      ::  take cache from host ship
      (cache-from-host:theseus-kernel our.bowl now.bowl desks.act)
    ~&  theseus+cache+name.act
    `state
  ::
      %rebuild
    ?.  =(~ recoveries)
      ~|([%theseus-rebuild-recovery-active ~(tap in ~(key by recoveries))] !!)
    =/  desks
      ~|  "{<name.act>} cache doesn't exist"
      (cache-desks:theseus-kernel our.bowl now.bowl (~(got by caches) name.act))
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
    ::  re-make the %cache from the ship we rebuilt on, and reuse that packed raft
    ::  as the injection source for the other ships.
    ?>  ?=(%park -.park.act)
    =/  src-cache  (pack-snap-raft:theseus-kernel snap:(pe i.all))
    =.  caches  (~(put by caches) name.act src-cache)
    ::  inject it into all other ships
    =.  piers
      %-  ~(gas by piers)
      %+  turn  t.all
      |=  who=ship
      ^-  [ship saved-pier]
      =/  old  (~(got by piers) who)
      =/  pier=pier  (unpack-pier old)
      :-  who
      ^-  saved-pier
      (pack-pier pier(snap (inject-raft:theseus-kernel who snap.pier src-cache desks)))
    =^  car  state
      %-  poke-theseus-events
      %+  turn  t.all
      |=  =ship
      [ship /c/rebuild park.act]
    ~&  theseus+rebuild+[name.act des.park.act]
    [(weld cad car) state]
  ==
::
::  +boot-chain: %dawn sponsor data for a guest, from our Jael
::
::    .chain is the guest's sponsorship chain, starting from its immediate
::    sponsor.  .czar carries current keys for every ship we know, so the
::    guest can verify them at once (a stale rift or life breaks remote
::    scry and third-party key lookup); unknown ships are skipped.
::
::    .czar has no sponsors, so a guest booted from it alone derives each
::    sponsor from the @p.  A star that escaped from its original galaxy
::    then looks like it is still under the old one, and the guest pings,
::    STUNs and relays through that galaxy, which drops the traffic, until
::    its own Azimuth snapshot catches up.  .spon carries the sponsors our
::    Jael has, ordered top down as Jael expects: the last entry becomes the
::    guest's own sponsor, so .spon stops at the first ship whose keys we
::    lack rather than skipping it.
::
++  boot-chain
  |=  chain=(list ship)
  ^-  $:  spon=(list [ship point:azimuth-types])
          czar=(map ship [rift=@ud life=@ud =pass])
      ==
  =/  keys
    |=  s=ship
    ^-  (unit [rift=@ud life=@ud =pass])
    =/  ul=(unit @ud)
      .^((unit @ud) %j /(scot %p our.bowl)/lyfe/(scot %da now.bowl)/(scot %p s))
    ?~  ul  ~
    =/  ur=(unit @ud)
      .^((unit @ud) %j /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p s))
    ?~  ur  ~
    =/  uk=(unit [suite=@ud =pass])
      .^  (unit [@ud pass])  %j
        /(scot %p our.bowl)/puby/(scot %da now.bowl)/(scot %p s)/(scot %ud u.ul)
      ==
    ?~  uk  ~
    `[u.ur u.ul pass.u.uk]
  =|  spon=(list [ship point:azimuth-types])
  =|  czar=(map ship [rift=@ud life=@ud =pass])
  =/  whole=?  &
  |-
  ?~  chain  [spon czar]
  =/  key  (keys i.chain)
  ?~  key  $(chain t.chain, whole |)
  =.  czar  (~(put by czar) i.chain u.key)
  ?.  whole  $(chain t.chain)
  =/  dad=ship
    .^(ship %j /(scot %p our.bowl)/sein/(scot %da now.bowl)/(scot %p i.chain))
  =|  pot=point:azimuth-types
  =.  net.pot  `[life.u.key pass.u.key rift.u.key [!=(dad i.chain) dad] ~]
  $(chain t.chain, spon [[i.chain pot] spon])
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
