|%
+$  command
  $%  [%boot who=ship desks=(list [=desk from=?(%host %publisher)])]
      [%fleet-new name=@tas count=@ud desks=(list [=desk from=?(%host %publisher)])]
      [%fleet-add-desks name=@tas desks=(list [=desk from=?(%host %publisher)])]
      [%moon-add-desks who=ship desks=(list [=desk from=?(%host %publisher)])]
      [%fleet-pause name=@tas]
      [%fleet-resume name=@tas]
      [%fleet-kill name=@tas]
      [%dojo who=ship command=@t]
      [%term who=ship act=term-act]
      [%pause who=ship]
      [%resume who=ship]
      [%kill who=ship]
      [%snapshot name=@tas ships=(list ship) resume=?]
      [%restore =path]
      [%delete =path]
  ==
::  A moon's terminal from the console, as a terminal client drives Dill:
::  keystrokes, the window size, and a redraw of the prompt line.
::
+$  term-act
  $%  [%belts p=(list belt:dill)]
      [%size p=blew:dill]
      [%hail ~]
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
