::  Local control for ops/theseus-gateway, run over the pier's conn.sock
::  with Khan %fyrd (bear %theseus, input mark %noun):
::
::    [%config ~]                   ->  [mode (unit port)]: what to run
::    [%live port=@ud upstream=@ud] ->  %ok: record the running gateway
::    [%down ~]                     ->  %ok: the gateway stopped
::
/-  spider, ui=theseus-ui
/+  strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  Khan lifts %noun input into a unit; mold it, since !< cannot nest *.
=/  req  ;;((unit $%([%config ~] gateway-command:ui)) q.arg)
?~  req  (strand-fail:strand %no-input ~)
?:  ?=(%config -.u.req)
  ;<  cfg=[gateway-mode:ui (unit @ud)]  bind:m
    (scry:strandio ,[gateway-mode:ui (unit @ud)] /gx/theseus-ui/gateway/config/noun)
  (pure:m !>(cfg))
;<  ~  bind:m  (poke-our:strandio %theseus-ui %theseus-gateway !>(u.req))
(pure:m !>(%ok))
