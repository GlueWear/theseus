|%
::
++  parse-url
  |=  url=tape
  ^-  [ship cord]
  ::  format: /theseus/~ship/rest...  ->  [~ship "/rest..."]
  ::  locate the "~" that begins the ship @p (robust to prefix length),
  ::  instead of a hardcoded offset that only fit "/theseus/".
  =.  url  (slag (need (find "~" url)) url)  :: now "~ship/rest..."
  ?~  loc=(find "/" url)  [(slav %p (crip url)) '']
  :-  (slav %p (crip (scag u.loc url)))
  (crip (slag u.loc url))
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