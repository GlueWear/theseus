|%
+$  command
  $%  [%boot who=ship desks=(list [=desk from=?(%host %publisher)])]
      [%fleet-new name=@tas count=@ud desks=(list [=desk from=?(%host %publisher)])]
      [%fleet-boot name=@tas]
      [%fleet-add-desks name=@tas desks=(list [=desk from=?(%host %publisher)])]
      [%moon-add-desks who=ship desks=(list [=desk from=?(%host %publisher)])]
      ::  update desks a moon already has from ours now, and hold or
      ::  restart their updates from us
      [%fleet-update-desks name=@tas desks=(list desk)]
      [%moon-update-desks who=ship desks=(list desk)]
      [%fleet-hold-desks name=@tas desks=(list desk) hold=?]
      [%moon-hold-desks who=ship desks=(list desk) hold=?]
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
      ::  a ship's display name and picture: ~ keeps, [~ ~] clears.
      ::  Written to the ship's Noltbook profile when it runs Noltbook,
      ::  else the name is kept here as a nickname.  .upload is a new
      ::  picture for a moon, as base64 bytes, instead of an address.
      ::
      [%profile who=ship name=(unit (unit @t)) avatar=(unit (unit @t)) upload=(unit @t)]
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
