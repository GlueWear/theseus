::  Send a raw Gall poke from one Theseus ship to another.
::
::    :theseus|poke ~wes ~pel %hood %helm-hi !>(...)
::
/+  theseus=theseus
:-  %say
|=  [* [from=ship to=ship app=@tas mark=@tas payload=* ~] ~]
:-  %theseus-events
:_  ~
:-  from
:*  /g
    %deal
    `sack`[from to /theseus]
    app
    `deal:gall`[%raw-poke mark payload]
==
