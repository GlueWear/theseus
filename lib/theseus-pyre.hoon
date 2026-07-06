|%
::
++  parse-url
  |=  url=tape
  ^-  [ship cord]
  ::  format must be /theseus/~sampel-palnet/...
  =.  url  (slag 6 url)  :: cutting off "/theseus/"
  ?~  loc=(find "/" url)  [(slav %p (crip url)) '']
  :-  (slav %p (crip (scag u.loc url))) :: ~nec
  (crip (slag u.loc url)) :: has /theseus/~nec cut off
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
  ?+  key  `[key value]
    %content-length  ~
    %set-cookie      ~
    %location  `[key (crip (weld "/theseus/~nec" (trip value)))]
  == 
--