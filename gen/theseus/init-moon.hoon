:: Start a theseus resident moon: generate a real key, register it with our
:: Jael, and boot %dawn so the moon signs with a network-valid identity.
:: Usage: :theseus|init-moon ~doznec-sampel-palnet
::        :theseus|init-moon ~M, =cache %my-cache
::
/+  dingy
:-  %say
|=  [[now=@da eny=@uvJ bec=beak] [her=ship ~] cache=@tas]
=/  kp  (gen-keypair:dingy (key-seed:dingy her 0 eny))
:-  %theseus-action
[%init-moon her ?~(cache %default cache) pub.kp priv.kp]
