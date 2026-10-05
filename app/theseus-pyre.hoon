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
  ::  Per-guest UDP transport ports (/utp/<ship>) are spun lazily on that
  ::  guest's first outbound packet (idempotent).  /ames is the optional
  ::  sidecar IPC port; opening it is harmless when no sidecar is present.
  :_  this
  :~  [%pass /ames %arvo %l %spin /ames]
      [%pass /bind %arvo %e %connect `/theseus %theseus-pyre]
  ==
::
++  on-save  on-save:def
++  on-load
  |=  =vase
  ^-  (quip card _this)
  ::  Per-guest ports re-spin lazily on the next packet; on-init does NOT run on
  ::  a code upgrade.  Runtime and sidecar Lick connections do not survive the
  ::  load boundary, so discard their choices and reopen the sidecar port.
  =.  transport-states  ~
  =.  sidecar-connected  %.n
  :_  this
  :-  [%pass /ames %arvo %l %spin /ames]
  :-  [%pass /bind %arvo %e %connect `/theseus %theseus-pyre]
  legacy-sites:hc
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %handle-http-request
    =+  !<([rid=@tas req=inbound-request:^eyre] vase)
    ::  /theseus/~<moon>/<path>: the web gateway maps each <moon>.<domain>
    ::  origin onto this prefix, so the moon's absolute paths never collide
    ::  with the host's Eyre bindings or its URL-keyed cache.
    =/  par=(unit [who=ship url=@t])  (parse-url:theseus-pyre url.request.req)
    ?:  |(?=(~ par) !(has-moon:hc who.u.par))
      [(not-found:hc rid) this]
    =.  url.request.req  url.u.par
    =.  http-ids  (~(put by http-ids) rid who.u.par)
    :_  this
    cards:(pass-request:(eyre:hc who.u.par) rid req)
  ::
      %theseus-effect
    =+  ef=!<([theseus-effect] vase)
    ?-    -.q.uf.ef
    ::  ames
        %saxo
      =^  cards  transport-states
        (route-ames-effect:hc ef)
      [cards this]
        %send
      =^  cards  transport-states
        (route-ames-effect:hc ef)
      [cards this]
        %push
      =^  cards  transport-states
        (route-ames-effect:hc ef)
      [cards this]
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
      =/  done=?
        =/  ev  http-event.q.uf.ef
        ?-(-.ev %cancel &, %start complete.ev, %continue complete.ev)
      =?  http-ids  &(done ?=([@ @ ~] p.uf.ef))
        (~(del by http-ids) i.t.p.uf.ef)
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
      =.  eyre-piers  (~(del by eyre-piers) who.ef)
      =.  transport-states  (~(del by transport-states) who.ef)
      ::  Use the same name as %spin; Gall adds the %theseus-pyre prefix.
      =/  wir=wire  /utp/(scot %p who.ef)
      :_  this
      :~  [%pass wir %arvo %l %shut wir]
      ==
        %restart
      ::  A restored Arvo noun still contains vane state, but all of its Vere
      ::  ducts died with the snapshot.  Clear every outer runtime shim first,
      ::  then let the restored vanes rebuild their runtime-facing ducts.
      =.  iris-piers  (~(del by iris-piers) who.ef)
      =.  behn-piers  (~(del by behn-piers) who.ef)
      =.  eyre-piers  (~(del by eyre-piers) who.ef)
      =.  transport-states  (~(del by transport-states) who.ef)
      =/  restart=(list theseus-event)
        :~  [who.ef /b/behn/0v1n.2m9vh %born ~]
            [who.ef /i/http-client/0v1n.2m9vh %born ~]
            [who.ef /e/http-server/0v1n.2m9vh %born ~]
            [who.ef /e/http-server/0v1n.2m9vh %live 8.080 `8.445]
            [who.ef /a/newt/0v1n.2m9vh %born ~]
        ==
      :_  this
      :~  :*  %pass  /theseus-events  %agent  [our.bowl %theseus]  %poke
              %theseus-events  !>(restart)
          ==
      ==
    ==
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    [%http-response *]    `this
    [%blit ~]             ?>  =(src.bowl our.bowl)  `this
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
      [%bind-site ~]
    ?>  ?=([%eyre %bound *] sign-arvo)
    ~?  !accepted.sign-arvo  [%theseus-pyre-site-refused binding.sign-arvo]
    `this
  ::
      ::  A patched Vere handles /utp/<ship> itself.  Stock Lick reports
      ::  %error because no IPC client owns that socket.  If neither produces
      ::  a signal, a short timer selects native; patched Vere's outbound spit
      ::  is intentionally fire-and-forget.
      [%transport @ @ ~]
    ?>  ?=([%behn %wake *] sign-arvo)
    =/  who=@p  (slav %p i.t.wire)
    =/  deadline=@da  (slav %da i.t.t.wire)
    =/  state=(unit transport-state)  (~(get by transport-states) who)
    ?~  state  `this
    ?.  ?=([%probe *] u.state)  `this
    ?.  =(deadline deadline.u.state)  `this
    =/  selected=transport-state
      ?:(sidecar-connected [%sidecar ~] [%native ~])
    =.  transport-states  (~(put by transport-states) who selected)
    `this
  ::
      ::  Inbound datagram on a guest's UDP transport port (/utp/<ship>).  Vere
      ::  soaks mark %heer (mesa) or %hear (legacy ames) with noun [lane blob];
      ::  the guest ship is the port label in the wire.  Inject it into that moon.
      ::  A native-port connection or inbound traffic confirms native;
      ::  %error selects sidecar.
      [%utp @ ~]
    ?.  ?=([%lick %soak *] sign-arvo)  `this
    =/  who=@p  (slav %p i.t.wire)
    ?:  =(%connect mark.sign-arvo)
      =.  transport-states  (~(put by transport-states) who [%native ~])
      `this
    ?:  =(%disconnect mark.sign-arvo)
      =.  transport-states  (~(del by transport-states) who)
      `this
    ?:  =(%error mark.sign-arvo)
      =.  transport-states  (~(put by transport-states) who [%sidecar ~])
      `this
    ?:  =(%stun mark.sign-arvo)
      =.  transport-states  (~(put by transport-states) who [%native ~])
      =/  inb  ;;([mode=?(%once %stop %fail) galaxy=@p lane=?([%.y p=@pC] [%.n p=@uxaddress])] noun.sign-arvo)
      :_  this
      :~  :*  %pass  /ames/stun  %agent  [our.bowl %theseus]  %poke
              %theseus-action
              !>(`action`[%ames-stun who mode.inb galaxy.inb lane.inb])
      ==  ==
    ?:  =(%heer mark.sign-arvo)
      =.  transport-states  (~(put by transport-states) who [%native ~])
      =/  inb  ;;([lane=mesa-lane blob=@] noun.sign-arvo)
      :_  this
      :~  :*  %pass  /ames/in  %agent  [our.bowl %theseus]  %poke
              %theseus-action  !>(`action`[%mesa-inbound who lane.inb blob.inb])
      ==  ==
    ?.  =(%hear mark.sign-arvo)  `this
    =.  transport-states  (~(put by transport-states) who [%native ~])
    ::  lick gives a bare address atom; wrap it [%| addr], typed lane:ames by the
    ::  `action` cast (can't name lane:ames here -- shadowed by the dead ++ames).
    =/  inb  ;;([addr=@ux blob=@] noun.sign-arvo)
    :_  this
    :~  :*  %pass  /ames/in  %agent  [our.bowl %theseus]  %poke
            %theseus-action  !>(`action`[%ames-inbound who [%| addr.inb] blob.inb])
    ==  ==
  ::
      ::  Optional sidecar noun channel.  When disconnected, the same payloads
      ::  flow through the existing /ames/outbound Eyre subscription instead.
      [%ames ~]
    ?.  ?=([%lick %soak *] sign-arvo)  `this
    ?:  =(%connect mark.sign-arvo)
      =.  sidecar-connected  %.y
      ::  A sidecar may be started after stock Lick was optimistically selected.
      ::  Re-probe on the next packet; actual native ingress still wins below.
      =.  transport-states  ~
      `this
    ?:  =(%disconnect mark.sign-arvo)
      =.  sidecar-connected  %.n
      `this
    ?:  =(%mesa-in mark.sign-arvo)
      =/  inb  ;;([who=@p lane=mesa-lane blob=@] noun.sign-arvo)
      :_  this
      :~  :*  %pass  /ames/in  %agent  [our.bowl %theseus]  %poke
              %theseus-action  !>(`action`[%mesa-inbound who.inb lane.inb blob.inb])
      ==  ==
    ?.  =(%ames-in mark.sign-arvo)  `this
    =/  inb  ;;([who=@p from=@p addr=@ux blob=@] noun.sign-arvo)
    =/  lan  ?:(=(0 addr.inb) [%& from.inb] [%| addr.inb])
    :_  this
    :~  :*  %pass  /ames/in  %agent  [our.bowl %theseus]  %poke
            %theseus-action  !>(`action`[%ames-inbound who.inb lan blob.inb])
    ==  ==
  ==
::
++  on-agent  on-agent:def
::  Eyre leaves when the browser drops a request (e.g. a channel stream).
::  Tell the moon's Eyre, or it keeps the dead connection open.
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  ?.  ?=([%http-response @ ~] path)  (on-leave:def path)
  ?~  who=(~(get by http-ids) i.t.path)  `this
  =.  http-ids  (~(del by http-ids) i.t.path)
  :_  this
  :~  :*  %pass  /theseus-events  %agent  [our.bowl %theseus]  %poke  %theseus-events
          !>(`(list theseus-event)`[u.who /e/(scot %p u.who)/[i.t.path] %cancel-request ~]~)
  ==  ==
++  on-peek   on-peek:def
++  on-fail   on-fail:def
--
::
=|  behn-piers=(map ship behn-pier)
=|  eyre-piers=(map ship eyre-pier)
=|  iris-piers=(map ship iris-pier)
::  open moon HTTP requests by Eyre id, to cancel them when the browser leaves
=|  http-ids=(map @ta ship)
=|  transport-states=(map ship transport-state)
=|  sidecar-connected=?
|_  bowl=bowl:gall
::
++  route-ames-effect
  |=  ef=ames-effect
  ^-  [(list card:agent:gall) _transport-states]
  =/  state=(unit transport-state)  (~(get by transport-states) who.ef)
  ?^  state
    =/  cards=(list card:agent:gall)
      ?-    -.u.state
          %native   (native-transport-cards ef)
          %sidecar  (sidecar-transport-cards ef)
          %probe
        (weld (native-transport-cards ef) (sidecar-transport-cards ef))
      ==
    [cards transport-states]
  =/  deadline=@da  (add now.bowl ~s1)
  =.  transport-states
    (~(put by transport-states) who.ef [%probe deadline])
  =/  cards=(list card:agent:gall)
    (weld (native-transport-cards ef) (sidecar-transport-cards ef))
  =/  timer=card:agent:gall
    [%pass /transport/(scot %p who.ef)/(scot %da deadline) %arvo %b %wait deadline]
  [(snoc cards timer) transport-states]
::
++  native-transport-cards
  |=  ef=ames-effect
  ^-  (list card:agent:gall)
  =/  wir=wire  /utp/(scot %p who.ef)
  :~  [%pass wir %arvo %l %spin wir]
      [%pass wir %arvo %l %spit wir q.uf.ef]
  ==
::
++  sidecar-transport-cards
  |=  ef=ames-effect
  ^-  (list card:agent:gall)
  ::  The sidecar owns its UDP sockets and does not need Vere's STUN setup.
  ?:  =(%saxo -.q.uf.ef)  ~
  ?:  sidecar-connected
    =/  out-mark=@tas
      ?:(=(%send -.q.uf.ef) %ames-out %mesa-out)
    =/  out-noun=noun  [who.ef +.q.uf.ef]
    [%pass /ames %arvo %l %spit /ames out-mark out-noun]~
  =/  out=update
    ?:  =(%send -.q.uf.ef)
      =/  data=ames-send-data  ;;(ames-send-data +.q.uf.ef)
      [%ames-outbound who.ef lane.data blob.data]
    =/  data=mesa-push-data  ;;(mesa-push-data +.q.uf.ef)
    [%mesa-outbound who.ef lanes.data blob.data]
  [%give %fact ~[/ames/outbound] %theseus-update !>(out)]~
::
++  has-moon
  |=  who=ship
  ^-  ?
  =/  res  .^(* %gx /(scot %p our.bowl)/theseus/(scot %da now.bowl)/ships/noun)
  ?=(^ (find ~[who] +:;;([%ships (list ship)] res)))
::
++  not-found
  |=  rid=@ta
  ^-  (list card:agent:gall)
  =/  paths  [/http-response/[rid]]~
  =/  bod=octs  (as-octs:mimes:html 'No such moon on this host.')
  :~  [%give %fact paths %http-response-header !>(`response-header:http`[404 ['content-type'^'text/plain' ~]])]
      [%give %fact paths %http-response-data !>(`(unit octs)``bod)]
      [%give %kick paths ~]
  ==
::
::  Hostname-specific Eyre bindings this agent owns.  Moon origins used to be
::  bound per <moon>.localhost:<port>; the gateway's /theseus/~<moon> prefix
::  replaced them, so any left over are removed on load.
::
++  legacy-sites
  ^-  (list card:agent:gall)
  =/  all
    .^((list [binding:^eyre * action:^eyre]) %e /(scot %p our.bowl)/bindings/(scot %da now.bowl))
  %+  murn  all
  |=  [=binding:^eyre * act=action:^eyre]
  ?.  &(?=([%app %theseus-pyre] act) ?=(^ site.binding))  ~
  `[%pass /bind-site %arvo %e %disconnect binding]
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
  ::  Keep large guest responses below Gall's practical fact size.  In
  ::  particular, Docket may return an entire glob asset in one Eyre event.
  ::
  ++  response-data-cards
    |=  [paths=(list path) data=(unit octs)]
    ^-  (list card:agent:gall)
    ?~  data
      [%give %fact paths %http-response-data !>(data)]~
    =/  total=@ud  p.u.data
    =/  bytes=@  q.u.data
    ?:  =(0 total)
      [%give %fact paths %http-response-data !>(data)]~
    =/  offset=@ud  0
    =/  cards=(list card:agent:gall)  ~
    |-
    ?:  =(offset total)
      (flop cards)
    =/  len=@ud  (min 65.536 (sub total offset))
    =/  chunk=octs  [len (cut 3 [offset len] bytes)]
    =/  card=card:agent:gall
      [%give %fact paths %http-response-data !>(`(unit octs)``chunk)]
    $(offset (add offset len), cards [card cards])
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
    =/  kicks=(list card:agent:gall)  [%give %kick paths ~]~
    ?-    -.ev
    :: TODO to get zero edits to eyre, we need to create our own theseus frontend
    ::   that auto-pokes the correct POST endpoint with the requisite data
    ::   rather than editing the login page within eyre. This should be easy
        %start
      =*  hed  response-header.ev
      =.  headers.hed  (parse-headers:theseus-pyre headers.hed)
      =.  this
        %-  emit-cards
        ;:  weld
          [%give %fact paths [%http-response-header !>(hed)]]~
          (response-data-cards paths data.ev)
          ?:(complete.ev kicks ~)
        ==
      ..abet
    ::
        %continue
      =.  this
        %-  emit-cards
        %+  weld  (response-data-cards paths data.ev)
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
