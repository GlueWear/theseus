::  Usage: :theseus|cache %my-cache ~[%desk-1 %desk-2 ...]
::
::  To boot a ship with this cache:
::    :theseus|init ~nec, =cache %my-cache
::
::  To update this cache after a commit to the host desk:
::    :theseus|rebuild ~nec
::
:-  %say
|=  [* [name=@tas desks=(list desk) ~] ~]
:-  %theseus-action
[%cache name ~ desks]
