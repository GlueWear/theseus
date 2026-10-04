|%
+$  command
  $%  [%boot who=ship desks=(list [=desk from=?(%host %publisher)])]
      [%dojo who=ship command=@t]
      [%pause who=ship]
      [%resume who=ship]
      [%kill who=ship]
      [%snapshot name=@tas ships=(list ship)]
      [%restore =path]
      [%delete =path]
  ==
::  Web gateway: the reverse proxy that gives each moon its own origin,
::  <moon>.<domain>, mapped onto /theseus/~<moon> on this host's Eyre.
::
::    %auto: the launcher picks a free local port and reports it.
::    %declared: the launcher must listen on .port, or refuse to start.
::    %hosting: an operator-managed proxy serves .template, e.g.
::      'https://{moon}.example.com'.
::
+$  gateway-mode  $~(%auto ?(%auto %declared %hosting))
+$  gateway
  $:  mode=gateway-mode
      port=(unit @ud)
      template=(unit @t)
      live=(unit gateway-live)
  ==
::  what the running launcher last reported: its listen port and the host
::  Eyre port it forwards to, after checking that port answers as our ship
::
+$  gateway-live  [port=@ud upstream=@ud at=@da]
+$  gateway-command
  $%  [%set mode=gateway-mode port=(unit @ud) template=(unit @t)]
      [%live port=@ud upstream=@ud]
      [%down ~]
  ==
--
