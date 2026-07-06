::  Sidecar -> Theseus Ames packet injection.  Deliberately a tiny type so the
::  JSON->noun cast never touches $action's task-arvo arm (which crashes on
::  runtime coercion).  on-poke widens $ames-in to $action.
::
/-  theseus
/+  theseus-lib=theseus
|_  =ames-in:theseus
++  grab
  |%
  ++  noun  ames-in:theseus
  ++  json  ames-in:dejs:theseus-lib
  --
++  grow
  |%
  ++  noun  ames-in
  --
++  grad  %noun
--
