/-  theseus-ui
|_  cmd=command:theseus-ui
++  grab
  |%
  ++  noun  command:theseus-ui
  ++  json
    =,  dejs:format
    %-  of
    :~  [%boot (ot ~[[%who (se %p)] [%cache (se %tas)]])]
        [%dojo (ot ~[[%who (se %p)] [%command so]])]
        [%pause (ot ~[[%who (se %p)]])]
        [%resume (ot ~[[%who (se %p)]])]
        [%kill (ot ~[[%who (se %p)]])]
        [%snapshot (ot ~[[%name (se %tas)] [%ships (ar (se %p))]])]
        [%restore (ot ~[[%path pa]])]
        [%delete (ot ~[[%path pa]])]
    ==
  --
++  grow
  |%
  ++  noun  cmd
  --
++  grad  %noun
--
