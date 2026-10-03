::  Gateway settings from the console.  Only %set arrives as JSON; %live and
::  %down are local pokes from the launcher's thread (ted/theseus-gateway).
::
/-  ui=theseus-ui
|_  cmd=gateway-command:ui
++  grab
  |%
  ++  noun  gateway-command:ui
  ++  json
    =,  dejs:format
    %-  of
    :~  :-  %set
        %-  ot
        :~  [%mode (cu |=(t=@t ;;(gateway-mode:ui t)) so)]
            [%port (mu ni)]
            [%template (mu so)]
        ==
    ==
  --
++  grow
  |%
  ++  noun  cmd
  --
++  grad  %noun
--
