::  This agent simulates vere. This includes packet routing (ames),
::  unix timers (behn), terminal drivers (dill), and http requests/
::  responses (iris/eyre).
::
/-  *theseus
/+  dbug, default-agent, theseus-pyre
::
%-  agent:dbug
^-  agent:gall
=<
|_  bowl=bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
    hc    ~(. +> bowl)
    card  $+(card card:agent:gall)
++  on-init
  ^-  (quip card _this)
  :_  this
  :~  [%pass /bind %arvo %e %connect `/theseus %theseus-pyre]
      ::  lick migration: open the /ames IPC port. vere materializes the socket
      ::  at <pier>/.urb/dev/theseus-pyre/ames (Gall prefixes the agent name).
      [%pass /ames %arvo %l %spin /ames]
  ==
::
++  on-save  on-save:def
++  on-load
  |=  =vase
  ^-  (quip card _this)
  ::  on-init does NOT run on a code upgrade, so (re)do its setup here too --
  ::  otherwise these are lost across upgrades: %spit fails ("gen not found"),
  ::  and the /theseus eyre bridge 404s (browser access to moons breaks).
  :_  this
  :~  [%pass /ames %arvo %l %spin /ames]
      [%pass /bind %arvo %e %connect `/theseus %theseus-pyre]
  ==
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %handle-http-request
    =+  !<([rid=@tas req=inbound-request:^eyre] vase)
    =^  who=ship  url.request.req
      (parse-url:theseus-pyre (trip url.request.req))
    :_  this
    cards:(pass-request:(eyre:hc who) rid req)
  ::
      %theseus-effect
    =+  ef=!<([theseus-effect] vase)
    ?-    -.q.uf.ef
    ::  ames
        %send
      =/  out=update  [%ames-outbound who.ef p.q.uf.ef q.q.uf.ef]
      ::  Every virtual ship we boot is a keyed moon meant for the REAL
      ::  network, so never route internally: no virtual-to-virtual %hear
      ::  inject, and no answering remote scries from the local namespace.
      ::  Just emit the fact; the sidecar carries the packet out and the
      ::  real response returns via a %ames-inbound poke.
      :_  this
      :~  [%give %fact ~[/ames/outbound] %theseus-update !>(out)]
          ::  P1 dual-emit: also spit the raw packet over lick, for parity with
          ::  the eyre fact.  noun = [who lane blob].
          [%pass /ames %arvo %l %spit /ames %ames-out [who.ef p.q.uf.ef q.q.uf.ef]]
      ==
    ::  behn
        %doze
      =^  cards  behn-piers
        abet:(doze:(behn:hc who.ef) uf.ef)
      [cards this]
    ::  clay
        %ergo  `this
    ::  dill
        %blit
      =+  out=(blit:dill:hc ef)
      ~?  !=(~ out)  out
      [%give %fact [/blit]~ theseus-effect+!>(ef)]~^this
    ::  eyre
        %thus  `this
        %response
      =^  cards  eyre-piers
        abet:(handle-response:(eyre who.ef) uf.ef)
      [cards this]
    ::  iris
        %request
      =^  cards  iris-piers
        abet:(request:(iris:hc who.ef) uf.ef)
      [cards this]
    ::  gall
        %poke-ack  `this
    ::  theseus specific
        %kill
      =.  iris-piers  (~(del by iris-piers) who.ef)
      =.  behn-piers  (~(del by behn-piers) who.ef)
      `this
    ==
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    [%http-response *]    `this
    [%blit ~]             `this
    [%ames %outbound ~]   `this
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+    wire  (on-arvo:def wire sign-arvo)
      [%b @ ~]
    ?>  ?=([%behn %wake *] sign-arvo)
    =/  who  (,@p (slav %p i.t.wire))
    =^  cards  behn-piers
      abet:(take-wake:(behn:hc who) error.sign-arvo)
    [cards this]
  ::
      [%i @ @ ~]
    ?>  ?=([%iris %http-response %finished *] sign-arvo)
    =/  who=@p    (slav %p i.t.wire)
    =/  num=@ud   (slav %ud i.t.t.wire)
    =*  red       response-header.client-response.sign-arvo
    =/  fuf
      ?~(ful=full-file.client-response.sign-arvo ~ `data.u.ful)
    =^  cards  iris-piers
      abet:(take-sigh-httr:(iris:hc who) num red fuf)
    [cards this]
  ::
      ::  bind ack. on-load re-issues %connect every upgrade; eyre returns
      ::  %.n when /theseus is already bound to us -- that's fine, don't crash.
      [%bind ~]  ?>(?=([%eyre %bound *] sign-arvo) `this)
  ::
      ::  lick /ames port. %spin ack + %connect/%disconnect soaks are ignored;
      ::  an %ames-in %soak is an inbound packet from the sidecar -> inject it
      ::  into the moon (poke %theseus with the same %ames-inbound action the
      ::  eyre path used, but as a real noun -- no JSON, no dejs).
      [%ames ~]
    ?.  ?=([%lick %soak *] sign-arvo)  `this
    ?:  =(%mesa-in mark.sign-arvo)
      =/  inb  ;;([who=@p lane=mesa-lane blob=@] noun.sign-arvo)
      :_  this
      :~  :*  %pass  /ames/in  %agent  [our.bowl %theseus]  %poke
              %theseus-action  !>(`action`[%mesa-inbound who.inb lane.inb blob.inb])
      ==  ==
    ?.  =(%ames-in mark.sign-arvo)     `this
    =/  inb  ;;([who=@p from=@p addr=@ux blob=@] noun.sign-arvo)
    ::  build the lane inline ([%& ship] / [%| addr]); the `action` cast below
    ::  types it as lane:ames.  (Can't write lane:ames here -- theseus-pyre has
    ::  its own dead ++ames core that shadows lull's, so lane:ames doesn't find.)
    =/  lan  ?:(=(0 addr.inb) [%& from.inb] [%| addr.inb])
    :_  this
    :~  :*  %pass  /ames/in  %agent  [our.bowl %theseus]  %poke
            %theseus-action  !>(`action`[%ames-inbound who.inb lan blob.inb])
    ==  ==
  ==
::
++  on-agent  on-agent:def
++  on-leave  on-leave:def
++  on-peek   on-peek:def
++  on-fail   on-fail:def
--
::
=|  behn-piers=(map ship behn-pier)
=|  eyre-piers=(map ship eyre-pier)
=|  iris-piers=(map ship iris-pier)
|_  bowl=bowl:gall
++  ames
  |%
  ++  send
    =,  ^ames
    |=  [sndr=@p way=wire %send lan=lane pac=@]
    ^-  (list card:agent:gall)
    =/  rcvr=ship
      ?-  -.lan
        %&  p.lan
        %|  `ship``@`p.lan
      ==
    =/  =shot  (sift-shot pac)
    ?.  &(!sam.shot req.shot) :: TODO I beleive this is right
      ::  normal packet
      ::
      :_  ~
      :*  %pass  /theseus-events  %agent  [our.bowl %theseus]  %poke
          %theseus-events  !>([rcvr /a/newt/0v1n.2m9vh %hear %|^`address``@`sndr pac]~)
      ==
    ::  remote scry packet
    ::
    =/  =peep  +:(sift-wail `@ux`content.shot)
    :: unpack path.peep
    =+  bal=(de-path:balk path.peep)
    =+  .^  pacs=(list yowl)  %gx
            ;:  weld
              /(scot %p our.bowl)/theseus/(scot %da now.bowl)/r            ::  /=theseus=/r
              /(scot %p her.bal)/(scot %ud rif.bal)/(scot %ud lyf.bal)  ::  /~wes/0/1/
              /[van.bal]/[car.bal]/(scot cas.bal)                       ::  /c/x/1
              spr.bal                                                   ::  /kids/ted/keen/hoon
              /noun :: TODO swap out for noun or something else
        ==  ==
    =.  pacs
      ::  add request to each response packet payload
      ::
      =+  pat=(spat path.peep)
      =+  wid=(met 3 pat)
      %-  flop  =<  blobs
      %+  roll  pacs
      |=  [=yowl num=_1 blobs=(list @ux)]
      :-  +(num)
      :_  blobs
      (can 3 4^num 2^wid wid^`@`pat (met 3 yowl)^yowl ~)
    :_  ~
    :*  %pass  /theseus-events  %agent  [our.bowl %theseus]  %poke
        %theseus-events
        !>
        %+  turn  pacs
        |=  =yowl
        :+  sndr  /a/theseus/fine-response
        :+  %hear  %|^`address``@`sndr
        %-  etch-shot
        :*  [sndr=rcvr rcvr=sndr]
            req=|  sam=|
            sndr-tick=`@ubC`1
            rcvr-tick=`@ubC`1
            origin=~
            content=`@ux`yowl
    ==  ==
  --
::
++  behn
  |=  who=ship
  =+  (~(gut by behn-piers) who *behn-pier)
  =*  pier-data  -
  =|  cards=(list card:agent:gall)
  |%
  ++  this  .
  ::
  ++  abet
    ^-  (quip card:agent:gall _behn-piers)
    =.  behn-piers  (~(put by behn-piers) who pier-data)
    [(flop cards) behn-piers]
  ::
  ++  emit-cards
    |=  cs=(list card:agent:gall)
    %_(this cards (weld cs cards))
  ::
  ++  emit-theseus-events
    |=  aes=(list theseus-event)
    %-  emit-cards
    [%pass /theseus-events %agent [our.bowl %theseus] %poke %theseus-events !>(aes)]~
  ::
  ++  doze
    |=  [way=wire %doze tim=(unit @da)]
    ^+  ..abet
    ?~  tim
      ?~  next-timer
        ..abet
      cancel-timer
    ?~  next-timer
      (set-timer u.tim)
    (set-timer:cancel-timer u.tim)
  ::
  ++  set-timer
    |=  tim=@da
    =.  next-timer  `tim
    =.  this  (emit-cards [%pass /b/(scot %p who) %arvo %b %wait tim]~)
    ..abet
  ::
  ++  cancel-timer
    =.  this
      (emit-cards [%pass /b/(scot %p who) %arvo %b %rest (need next-timer)]~)
    =.  next-timer  ~
    ..abet
  ::
  ++  take-wake
    |=  error=(unit tang)
    =.  next-timer  ~
    =.  this
      %-  emit-theseus-events
      ?^  error
        ::  Should pass through errors to theseus, but doesn't
        ((slog leaf+"theseus-behn: timer failed" u.error) ~)
      [who /b/behn/0v1n.2m9vh [%wake ~]]~
    ..abet
  --
::
++  dill
  |%
  ++  blit
    |=  [who=@p way=wire %blit blits=(list blit:^dill)]
    ^-  tape
    %+  roll  blits
    |=  [b=blit:^dill line=tape]
    ?-  -.b
      %bel  line
      %clr  ""
      %hop  ""
      %klr  (tape (zing (turn p.b tail)))
      %mor  (blit who way %blit p.b)
      %nel  ""
      %put  ~&  (weld "{<who>}: " (tufa p.b))  ""
      %sag  ~&  [%save-jamfile-to p.b]  line
      %sav  ~&  [%save-file-to p.b]     line
      %url  ~&  [%activate-url p.b]     line
      %wyp  ""
    ==
  --
::
++  eyre
  |=  who=ship
  =+  (~(gut by eyre-piers) who *eyre-pier)
  =*  pier-data  -
  =|  cards=(list card:agent:gall)
  |%
  ++  this  .
  ::
  ++  abet
    ^-  (quip card:agent:gall _eyre-piers)
    =.  eyre-piers  (~(put by eyre-piers) who pier-data)
    [cards eyre-piers] :: TODO might need to flop if I start chaining calls
  ++  emit-cards
    |=  cs=(list card:agent:gall)
    %_(this cards (weld cs cards))
  ::
  ++  emit-theseus-events
    |=  aes=(list theseus-event)
    %-  emit-cards
    [%pass /theseus-events %agent [our.bowl %theseus] %poke %theseus-events !>(aes)]~
  ::
  ++  pass-request
    |=  [rid=@t req=inbound-request:^eyre]
    ::  NO server-side cookie injection: the browser/broker is the sole session
    ::  holder. A single shared `cookie` field broke multi-moon (moon B's request
    ::  got moon A's last-captured cookie -> "bad session auth"), and a snapshot
    ::  restore left a stale one. Response set-cookie still passes through to the
    ::  browser (lib parse-headers), so login works statelessly.
    %-  emit-theseus-events
    ::  inject into the actual moon (who), not a hardcoded ~nec that isn't
    ::  booted -- otherwise the request vanishes and the client hangs.
    [who /e/(scot %p who)/[rid] %request [secure address request]:req]~
  ::
  ++  handle-response
    |=  [way=wire %response ev=http-event:http]
    ^+  ..abet
    ?>  ?=([@ @ ~] way)
    =/  paths  [/http-response/[i.t.way]]~
    =/  kicks  [%give %kick paths ~]~
    ?-    -.ev
    :: TODO to get zero edits to eyre, we need to create our own theseus frontend
    ::   that auto-pokes the correct POST endpoint with the requisite data
    ::   rather than editing the login page within eyre. This should be easy
        %start
      =*  hed  response-header.ev
      =.  headers.hed  (parse-headers:theseus-pyre headers.hed)
      =.  this
        %-  emit-cards
        :+  [%give %fact paths [%http-response-header !>(hed)]]
          [%give %fact paths %http-response-data !>(data.ev)]
        ?:(complete.ev kicks ~)
      ..abet
    ::
        %continue
      =.  this
        %-  emit-cards
        :-  [%give %fact paths %http-response-data !>(data.ev)]
        ?:(complete.ev kicks ~)
      ..abet
    ::
        %cancel  =.(this (emit-cards kicks) ..abet)
    ==
  --
::
++  iris
  ::  :theseus|dojo ~nec "|pass [%i %request [%'GET' 'https://urbit.org' ~ ~] *outbound-config:iris]"
  ::  :theseus|dojo ~nec "|pass [%i %cancel-request ~]"
  ::  
  |=  who=ship
  =+  (~(gut by iris-piers) who *iris-pier)
  =*  pier-data  -
  =|  cards=(list card:agent:gall)
  |%
  ++  this  .
  ::
  ++  abet
    ^-  (quip card:agent:gall _iris-piers)
    =.  iris-piers  (~(put by iris-piers) who pier-data)
    [(flop cards) iris-piers]
  ::
  ++  emit-cards
    |=  cs=(list card:agent:gall)
    %_(this cards (weld cs cards))
  ::
  ++  emit-theseus-events
    |=  aes=(list theseus-event)
    %-  emit-cards
    [%pass /theseus-events %agent [our.bowl %theseus] %poke %theseus-events !>(aes)]~
  ::
  ++  request
    |=  [way=wire %request id=@ud req=request:http]
    ^+  ..abet
    =.  http-requests  (~(put in http-requests) id)
    =.  this
      %-  emit-cards  :_  ~
      :^  %pass  /i/(scot %p who)/(scot %ud id)  %arvo
      [%i %request req *outbound-config:^iris]
    ..abet
  ::
  ::  Pass HTTP response back to virtual ship
  ::
  ++  take-sigh-httr
    |=  [num=@ud =response-header:http data=(unit octs)]
    ^+  ..abet
    ?.  (~(has in http-requests) num)
      ~&  [who=who %ignoring-httr num=num]
      ..abet
    =.  http-requests  (~(del in http-requests) num)
    =.  this
      %-  emit-theseus-events
      :_  ~
      :^  who  /i/http/0v1n.2m9vh  %receive
      [num %start response-header data &]
    ..abet
  --
--
