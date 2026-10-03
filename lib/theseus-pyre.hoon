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
--