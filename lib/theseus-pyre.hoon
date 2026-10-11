|%
::
++  parse-url
  ::  /theseus/~<ship>[/rest]  ->  [~<ship> '/rest'], or ~ if malformed
  |=  url=@t
  ^-  (unit [ship @t])
  =/  txt=tape  (trip url)
  ?.  =("/theseus/~" (scag 10 txt))  ~
  =.  txt  (slag 9 txt)
  =/  end=@ud  (fall (find "/" txt) (lent txt))
  =/  who=(unit ship)  (slaw %p (crip (scag end txt)))
  ?~  who  ~
  =/  rest=tape  (slag end txt)
  `[u.who ?~(rest '/' (crip rest))]
::
++  has-cookie
  |=  hed=header-list:http
  |-  ^-  (unit @t)
  ?~  hed  ~
  ?:  =('set-cookie' key.i.hed)
    `value.i.hed
  $(hed t.hed)
::
++  parse-headers
  |=  =header-list:http
  ^-  header-list:http
  %+  murn  header-list
  |=  [key=@t value=@t]
  ::  Caddy + the per-moon subdomain now own URL mapping, so pass the moon's
  ::  response headers through untouched -- especially set-cookie (the browser
  ::  holds the session, scoped to the subdomain origin) and location (clean
  ::  root redirects resolve to the moon via the subdomain).  Only drop
  ::  content-length, which conflicts with the chunked re-encode downstream.
  ?+  key  `[key value]
    %content-length  ~
  ==
::  Cookies between a browser and a moon
::
::    A moon's pages reach it through this host's Eyre.  At the host's own
::    address (/theseus/~<moon>/...) the browser sends every cookie it holds
::    there, the host's login among them, and a moon could read it and act
::    as the host.  So only the moon's own Eyre login crosses, both ways.
::    Moon apps use no other cookie.
::
::  +moon-login: the name of a moon's Eyre login cookie, with its =
::
++  moon-login
  |=  who=ship
  ^-  @t
  (rap 3 ~['urbauth-' (scot %p who) '='])
::
++  is-header
  |=  [want=@t key=@t]
  ^-  ?
  =(want (crip (cass (trip key))))
::  +keep-moon-cookie: a request's headers, with only the moon's own login
::  left of its cookies
::
++  keep-moon-cookie
  |=  [who=ship hed=header-list:http]
  ^-  header-list:http
  =/  want=@t  (moon-login who)
  =|  rest=header-list:http
  =|  own=(unit @t)
  |-  ^-  header-list:http
  ?~  hed
    =?  rest  ?=(^ own)  [['cookie' u.own] rest]
    (flop rest)
  ?.  (is-header 'cookie' key.i.hed)
    $(hed t.hed, rest [i.hed rest])
  =?  own  ?=(~ own)  (own-cookie want (cookie-pieces value.i.hed))
  $(hed t.hed)
::  +own-cookie: the first of .pieces that starts with .want
::
++  own-cookie
  |=  [want=@t pieces=(list @t)]
  ^-  (unit @t)
  ?~  pieces  ~
  ?:  =(want (end [3 (met 3 want)] i.pieces))
    `i.pieces
  $(pieces t.pieces)
::  +keep-moon-set-cookie: a moon's answer, setting no cookie but its own
::  login, so it can't set or replace the host's cookies at its address
::
++  keep-moon-set-cookie
  |=  [who=ship hed=header-list:http]
  ^-  header-list:http
  =/  want=@t  (moon-login who)
  %+  murn  hed
  |=  [key=@t value=@t]
  ?:  ?&  (is-header 'set-cookie' key)
          !=(want (end [3 (met 3 want)] value))
      ==
    ~
  `[key value]
::  +cookie-pieces: a Cookie header's name=value pairs
::
++  cookie-pieces
  |=  value=@t
  ^-  (list @t)
  =/  txt=tape  (trip value)
  =|  cur=tape
  =|  out=(list @t)
  |-  ^-  (list @t)
  ?~  txt
    (flop ?~(cur out [(crip (flop cur)) out]))
  ?:  =(';' i.txt)
    $(txt t.txt, cur ~, out ?~(cur out [(crip (flop cur)) out]))
  ?:  &(=(' ' i.txt) ?=(~ cur))
    $(txt t.txt)
  $(txt t.txt, cur [i.txt cur])
--
