::  Rebuild a desk in a theseus cache and insert into all running ships
::  Usage: :theseus|cache %my-cache ~[%desk-1 %desk-2 ...]
::
::  To boot a ship with this cache:
::    :theseus|init ~nec, =cache %my-cache
::
::  To update this cache after a commit to the host desk:
::    :theseus|rebuild %cax %desk-1
::
/+  theseus=theseus
:-  %say
|=  [[* * =beak] [name=@tas =desk ~] ~]
:-  %theseus-action
[%rebuild name (park:theseus p.beak desk r.beak)]