/-  *theseus,
    spider
/+  *strandio,
    dill
::
=*  strand    strand:spider
::
|%
++  send-events
  |=  events=(list theseus-event)
  =/  m  (strand ,~)
  ^-  form:m
  (poke-our %theseus %theseus-events !>(events))
::
::  TODO this no longer works
::
:: ++  take-unix-effect
::   =/  m  (strand ,[ship unix-effect])
::   ^-  form:m
::   ;<  [=path =cage]  bind:m  (take-fact-prefix /effect)
::   ?>  ?=(%theseus-effect p.cage)
::   (pure:m !<([theseus-effect] q.cage))
::
++  init
  |=  who=ship
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m
    %^  poke-our  %theseus  %theseus-action
    !>([%init-ship who %default])
  (pure:m ~)
::
++  init-cache
  |=  [who=ship cache=@tas]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m
    %^  poke-our  %theseus  %theseus-action
    !>([%init-ship who cache])
  (pure:m ~)
::
++  ues-to-pe
  |=  [who=ship what=(list unix-event)]
  ^-  (list theseus-event)
  %+  turn  what
  |=  ue=unix-event
  [who ue]
::
++  ue-to-pes
  |=  [hers=(list ship) what=unix-event]
  ^-  (list theseus-event)
  %+  turn  hers
  |=  who=ship
  [who what]
::
++  dojo
  |=  [who=ship =tape]
  (send-events (dojo-events who tape))
::
++  dojo-events
  |=  [who=ship =tape]
  %+  ues-to-pe  who
  ^-  (list unix-event)
  :~  [/d/term/1 %belt %mod %ctl `@c`%e]
      [/d/term/1 %belt %mod %ctl `@c`%u]
      [/d/term/1 %belt %txt ((list @c) tape)]
      [/d/term/1 %belt %ret ~]
  ==
::
::  TODO this no longer works
::
:: ++  wait-for-output
::   |=  [=ship =tape]
::   =/  m  (strand ,~)
::   ^-  form:m
::   ~&  >  "waiting for output: {tape}"
::   |-  ^-  form:m
::   ;<  [her=^ship uf=unix-effect]  bind:m  take-unix-effect
::   ?:  ?&  =(ship her)
::           ?=(%blit -.q.uf)
::         ::
::           %+  lien  p.q.uf
::           |=  =blit:dill
::           ?.  ?=(%put -.blit)
::             |
::           !=(~ (find tape p.blit))
::       ==
::     (pure:m ~)
::   $
::
++  poke
  |=  $:  from=@p
          to=@p
          app=@tas
          mark=@tas
          payload=*
      ==
  %-  send-events
  %+  ues-to-pe  from
  ^-  (list unix-event)
  :_  ~
  :*  /g
      %deal
      `sack`[from to /theseus]
      app
      `deal:gall`[%raw-poke mark payload]
  ==
::
++  poke-self
  |=  $:  to=@p
          app=@tas
          mark=@tas
          payload=*
      ==
  %-  send-events
  %+  ues-to-pe  to
  ^-  (list unix-event)
  :_  ~
  :*  /g
      %deal
      `sack`[to to /theseus]
      app
      `deal:gall`[%raw-poke mark payload]
  ==
::
++  task
  ::  TODO move to note-arvo?
  |=  [who=@p v=?(%a %b %c %d %e %g %i %j %k %l) =task-arvo]
  %-  send-events
  %+  ues-to-pe  who
  ^-  (list unix-event)
  [/[v] task-arvo]~ 
::
++  park
  |=  [our=ship =desk =case]
  ^-  $>(%park task:clay)
  ::
  =/  desk-path=path  /(scot %p our)/[desk]/(scot case)
  =/  =domo:clay  .^(domo:clay %cv desk-path)
  =*  tako=tako:clay  (~(got by hit.domo) let.domo)
  =*  path-to-lobe
    q:.^(yaki:clay %cs (weld desk-path /yaki/(scot %uv tako)))
  ::
  =*  yoki=yoki:clay
    :+  %&  *(list tako:clay)
    %-  ~(urn by path-to-lobe)
    |=([=path =lobe:clay] %|^lobe)
  ::  409 Clay has no /rang scry; pass empty rang, target rebuilds from source
  =*  rang  *rang:clay
  ::
  [%park desk yoki rang]
::
++  commit
  |=  [hers=(list ship) our=ship =desk =case]
  %-  send-events
  %+  ue-to-pes  hers
  [/c/commit (park our desk case)]
::
++  enjs
  =,  enjs:format
  |%
  ++  update
    |=  =^update
    ^-  json
    ?~  update  ~
    ?-    -.update
        %snaps
      (frond -.update (fleets snap-paths.update))
    ::
        %ships
      (frond -.update (list-ships ships.update))
    ::
        %snap-ships
      (frond -.update (snap-ships [path ships]:update))
    ::
        %ames-outbound
      %-  pairs
      :~  [%ship s+(scot %p who.update)]
          ::  ship-name lane ([%.y ship]) -> lane-ship; raw-address lane
          ::  ([%.n addr]) -> lane-addr.  The sidecar prefers lane-addr (direct
          ::  transmit) and falls back to lane-ship (route via gateway).
          :-  %lane-ship
          ?-  -.lane.update
            %&  s+(scot %p p.lane.update)
            %|  ~
          ==
          :-  %lane-addr
          ?-  -.lane.update
            %&  ~
            %|  s+(scot %ux p.lane.update)
          ==
          [%lane-jam s+(scot %ux (jam lane.update))]
          [%blob s+(scot %ux blob.update)]
          ::  blob is an atom; its hex loses the byte length when high bytes
          ::  are zero.  Emit (met 3) so the sidecar rebuilds exact packet bytes.
          [%blob-len (numb (met 3 blob.update))]
      ==
    ==
  ::
  ++  fleets
    |=  snap-paths=(list ^path)
    ^-  json
    (frond %snap-paths (list-paths snap-paths))
  ::
  ++  snap-ships
    |=  [p=^path ships=(list @p)]
    ^-  json
    %-  pairs
    :+  [%path (path p)]
      [%ships (list-ships ships)]
    ~
  ::
  ++  list-ships
    |=  ships=(list @p)
    ^-  json
    :-  %a
    %+  turn  ships
    |=(who=@p [%s (scot %p who)])
  ::
  ++  list-paths
    |=  paths=(list ^path)
    ^-  json
    :-  %a
    %+  turn  paths
    |=(p=^path (path p))
  ::
  ++  theseus-effect
    |=  [who=@p ufs=unix-effect]
    ^-  json
    ?+    -.q.ufs  ~  :: ignore non-%blit
        %blit
      %-  pairs
      :~  [%ship s+(scot %p who)]
        :-  %blits
        :-  %a
        %+  turn  `(list blit:dill)`p.q.ufs
        |=  b=blit:dill
        (blit:enjs:dill b)
      ==
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  ::  Sidecar-facing subset; see $ames-in in /sur/theseus.
  ++  ames-in
    %-  of
    :~  [%ames-inbound ames-inbound]
        [%ames-test-inbound ames-test-inbound]
    ==
  ::
  ++  action
    %-  of
    :~  [%init-ship (se %p)]
        [%kill-ships (ot ~[[%hers (se %p)]])]
        [%snap-ships (ot ~[[%path pa] [%hers (ar (se %p))]])]
        [%restore-snap (ot ~[[%path pa]])]
        [%delete-snap (ot ~[[%path pa]])]
        [%unpause-ships (ot ~[[%hers (ar (se %p))]])]
        [%pause-ships (ot ~[[%hers (ar (se %p))]])]
        [%wish (ot ~[[%hers (ar (se %p))] [%p so]])]
        [%ames-inbound ames-inbound]
        [%ames-test-inbound ames-test-inbound]
    ==
  ::
  ::  JSON convenience for the sidecar proof harness:
  ::    {"ames-inbound":{"who":"~bud","from":"~nec","blob":"0x..."}}
  ::  This builds an Ames ship lane [%.y from], which is enough for the
  ::  first userspace echo test.  The noun mark still supports arbitrary lanes.
  ::
  ::  blob arrives as a canonical "0x..."-prefixed, dot-grouped hex string
  ::  (as `scot %ux` emits); decode with `slav %ux`.
  ++  bl  |=(jon=json ?>(?=([%s *] jon) (slav %ux p.jon)))
  ::
  ::  addr is the sender's raw transport address (from the sidecar's UDP
  ::  source).  If present, hand the moon a direct-address lane [%.n addr] so
  ::  it learns the peer's REAL address and routes there directly, like a
  ::  NAT'd ship — instead of only a name ([%.y from]) which forces a galaxy
  ::  detour.  addr=0 falls back to the ship lane.
  ++  ames-inbound
    |=  jon=json
    =/  dat=[who=ship from=ship addr=@ blob=@]
      ((ot ~[[%who (se %p)] [%from (se %p)] [%addr bl] [%blob bl]]) jon)
    =/  =lane:ames
      ?:(=(0 addr.dat) [%& from.dat] [%| addr.dat])
    [who.dat lane blob.dat]
  ::
  ++  ames-test-inbound
    |=  jon=json
    =/  dat=[who=ship from=ship blob=@]
      ((ot ~[[%who (se %p)] [%from (se %p)] [%blob bl]]) jon)
    dat
  --
--
