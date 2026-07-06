::
::::  /hoon/mjs/mar
  ::
/?    310
::
=,  format
=,  mimes:html
|_  txt=wain
::
++  grab
  |%
  ++  mime  |=((pair mite octs) (to-wain q.q))
  ++  noun  wain
  --
++  grow
  |%
  ++  mime  [/text/plain (as-octs (of-wain txt))]
  --
++  grad  %mime
--
