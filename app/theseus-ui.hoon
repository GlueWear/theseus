::  Authenticated, same-origin management UI, and the web gateway settings
::  that tell the console where each moon's own origin lives.
::  Guest HTTP remains on /theseus (pyre).
::
/-  ui=theseus-ui
/+  default-agent, server
|%
+$  state-0  [%0 =gateway:ui]
+$  card  card:agent:gall
::  +valid-template: an origin like 'https://{moon}.example.com', with
::  {moon} in the hostname (moon apps use absolute paths, so it cannot be a
::  path prefix) and nothing after the host but an optional '/'.
::
++  valid-template
  |=  t=@t
  ^-  ?
  =/  s=tape  (trip t)
  =/  pre=@ud  ?:(=("https://" (scag 8 s)) 8 ?:(=("http://" (scag 7 s)) 7 0))
  ?:  =(0 pre)  |
  =/  rest=tape  (slag pre s)
  =/  host=tape  (scag (fall (find "/" rest) (lent rest)) rest)
  ?&  (lte (lent s) 255)
      =(1 (lent (fand "\{moon}" s)))
      ?=(^ (find "\{moon}" host))
      (lte (sub (lent rest) (lent host)) 1)
      !(lien s |=(c=@t |((lth c 33) (gte c 127))))
  ==
::
::  +gateway-json: settings, the launcher's last report, this host's actual
::  Eyre port, the moon address the console should open, and a status.
::
++  gateway-json
  |=  [=bowl:gall =gateway:ui]
  ^-  json
  =/  eyre=@ud
    -:.^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl))
  =/  live  live.gateway
  =/  url=(unit @t)
    ?-  mode.gateway
      %hosting   template.gateway
      %declared  (bind port.gateway local-url)
      %auto      (bind live |=(l=gateway-live:ui (local-url port.l)))
    ==
  ::  ok: a launcher reported in, forwarding to the port Eyre is on now (and,
  ::  if declared, listening where declared).  stale: Eyre moved since.
  =/  status=@t
    ?:  ?=(%hosting mode.gateway)  'external'
    ?~  live  'down'
    ?.  =(upstream.u.live eyre)  'stale'
    ?:  &(?=(%declared mode.gateway) !=(port.gateway `port.u.live))  'mismatch'
    'ok'
  %-  pairs:enjs:format
  :~  mode+s+mode.gateway
      port+?~(port.gateway ~ (numb:enjs:format u.port.gateway))
      template+?~(template.gateway ~ s+u.template.gateway)
    ::
      :-  %live
      ?~  live  ~
      %-  pairs:enjs:format
      :~  port+(numb:enjs:format port.u.live)
          upstream+(numb:enjs:format upstream.u.live)
          at+s+(scot %da at.u.live)
      ==
    ::
      eyre+(numb:enjs:format eyre)
      url+?~(url ~ s+u.url)
      status+s+status
  ==
::
++  local-url
  |=  port=@ud
  ^-  @t
  (crip "http://\{moon}.localhost:{(a-co:co port)}")
--
::
=|  state-0
=*  state  -
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
++  on-init
  :_  this
  ~[[%pass /bind %arvo %e %connect `/apps/theseus %theseus-ui]]
++  on-save  !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  ::  The first version kept no state (on-save was !>(~)).
  =/  new=state-0
    ?:  ?=([%0 *] q.old)  !<(state-0 old)
    *state-0
  :_  this(state new)
  ~[[%pass /bind %arvo %e %connect `/apps/theseus %theseus-ui]]
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %theseus-gateway
    ::  JSON (the console) can only produce %set; %live and %down come from
    ::  the launcher's local thread.  Either way, only the owner.
    ?>  =(src.bowl our.bowl)
    =/  cmd  !<(gateway-command:ui vase)
    ?-    -.cmd
        %live
      ?>  &((gth port.cmd 0) (lte port.cmd 65.535) (gth upstream.cmd 0))
      `this(live.gateway `[port.cmd upstream.cmd now.bowl])
    ::
        %down  `this(live.gateway ~)
    ::
        %set
      ?>  ?~(port.cmd & &((gth u.port.cmd 0) (lte u.port.cmd 65.535)))
      ?>  ?~(template.cmd & (valid-template u.template.cmd))
      ?>  ?-  mode.cmd
            %auto      &
            %declared  ?=(^ port.cmd)
            %hosting   ?=(^ template.cmd)
          ==
      `this(gateway gateway(mode mode.cmd, port port.cmd, template template.cmd))
    ==
  ::
      %handle-http-request
    =/  req  !<([id=@ta req=inbound-request:eyre] vase)
    =/  response=simple-payload:http
      ::  Eyre pokes as the requester's identity, so only the owner's session
      ::  arrives with src = our.  Anyone else (a logged-out guest, or a ship
      ::  poking directly with a forged request) gets the login redirect.
      ?.  &(authenticated.req.req =(src.bowl our.bowl))
        (login-redirect:gen:server request.req.req)
      ?.  =('GET' method.request.req.req)
        [[405 ~] ~]
      ::  Landscape tile and favicon (desk.docket-0, web/icon.png)
      ?:  =('/apps/theseus/icon.png' url.request.req.req)
        =/  png=@
          .^(@ %cx /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl)/web/icon/png)
        :_  `[(met 3 png) png]
        [200 ['content-type'^'image/png' 'cache-control'^'max-age=3600' ~]]
      ::  A single-file Node executable with @urbit/nockjs bundled into it.
      ::  Keep it authenticated like the console: it is operational tooling,
      ::  not a public asset, and its URL is deliberately stable.
      ?:  =('/apps/theseus/sidecar.mjs' url.request.req.req)
        =/  sidecar=@t
          .^(@t %cx /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl)/web/theseus-sidecar/mjs)
        :_  `(as-octs:mimes:html sidecar)
        :-  200
        :~  ['content-type' 'text/javascript; charset=utf-8']
            ['content-disposition' 'attachment; filename="theseus-sidecar.mjs"']
            ['cache-control' 'no-store']
        ==
      =/  page=@t
        .^(@t %cx /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl)/web/theseus/html)
      ::  The URL never changes across desk updates; do not let browsers keep
      ::  a stale console (html-response sets a one-week max-age).
      :_  `(as-octs:mimes:html page)
      [200 ['content-type'^'text/html' 'cache-control'^'no-store' ~]]
    [(give-simple-payload:app:server id.req response) this]
  ==
++  on-watch
  |=  =path
  ::  Eyre watches as the requester's identity too, guests included.
  ?+  path  (on-watch:def path)
    [%http-response @ ~]  `this
  ==
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  (on-peek:def path)
    ::  what the launcher must do: mode and declared port
    [%x %gateway %config ~]  ``noun+!>([mode.gateway port.gateway])
    [%x %gateway ~]          ``json+!>((gateway-json bowl gateway))
  ==
++  on-arvo
  |=  [=wire =sign-arvo]
  ?:  ?=([%bind ~] wire)  `this
  (on-arvo:def wire sign-arvo)
++  on-leave  on-leave:def
++  on-agent  on-agent:def
++  on-fail   on-fail:def
--
