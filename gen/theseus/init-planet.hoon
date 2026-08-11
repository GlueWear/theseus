:: Start a real Azimuth planet inside Theseus using a normal .key file atom.
:: Continuity and public-key data are read from the host's Jael/Azimuth state.
::
:: Usage: :theseus|init-planet ~sampel-palnet 0w...
::        :theseus|init-planet ~P 0w..., =cache %my-cache
::
:-  %say
|=  [[now=@da eny=@uvJ bec=beak] [her=ship keyfile=@ ~] cache=@tas]
=/  fed=feed:jael
  ~|  %theseus-init-planet-bad-keyfile
  (need ((soft feed:jael) (cue keyfile)))
:-  %theseus-action
[%init-planet her ?~(cache %default cache) fed]
