::  Seed a running Theseus moon with the host's current Azimuth state.
::
::    :theseus|seed-azimuth ~dozful-mignes-magtel
::
/-  *dice
:-  %say
|=  [[now=@da eny=@uvJ bec=beak] [who=ship ~] ~]
=*  our  p.bec
=/  pre=path
  /(scot %p our)/azimuth/(scot %da now)
=/  nas=^state:naive
  .^(^state:naive %gx (weld pre /nas/noun))
=/  own=owners
  .^(owners %gx (weld pre /own/noun))
=/  spo=sponsors
  .^(sponsors %gx (weld pre /spo/noun))
=/  logs=(list event-log:rpc:ethereum)
  .^((list event-log:rpc:ethereum) %gx (weld pre /logs/noun))
=/  id=id:block:jael
  %+  roll  logs
  |=  [log=event-log:rpc:ethereum cur=id:block:jael]
  ?~  mined.log  cur
  ?.  (gth block-number.u.mined.log number.cur)
    cur
  [block-hash block-number]:u.mined.log
?.  (gth number.id 0)
  ~|(%theseus-azimuth-no-host-block !!)
=/  snap=snap-state
  [%0 id nas own spo]
~&  [%theseus-azimuth-seed who block=number.id]
:-  %theseus-events
:_  ~
:-  who
:*  /g
    %deal
    `sack`[who who /theseus/seed-azimuth]
    %azimuth
    `deal:gall`[%poke %azimuth-poke !>([%load snap])]
==
