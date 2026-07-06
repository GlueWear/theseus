:: Start a theseus ship
:: Usage: :theseus|init ~nec
::        :theseus|init ~nec, =cache %my-cache
::
:-  %say
|=  [* [her=ship ~] cache=@tas]
:-  %theseus-action
[%init-ship her ?~(cache %default cache)]
