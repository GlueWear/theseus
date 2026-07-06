:: Start a theseus ship with a real key (boots %dawn, signs network-valid).
:: Usage: :theseus|init-moon ~doznec-sampel-palnet
::        :theseus|init-moon ~M, =cache %my-cache
::
:: For now the key is generated inline (mirroring gen/hood/moon.hoon).  Later
:: this key comes from %dingy so the moon uses its registered resident key.
::
:-  %say
|=  [[now=@da eny=@uvJ bec=beak] [her=ship ~] cache=@tas]
=/  cub  (pit:nu:crub:crypto 512 (shaz (jam her life=1 eny)))
:-  %theseus-action
[%init-moon her ?~(cache %default cache) sec:ex:cub]
