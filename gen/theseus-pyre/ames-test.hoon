::  Emit a synthetic virtual Ames %send effect for the sidecar bridge harness.
::
::  This deliberately avoids `:theseus|poke`, which injects a raw Gall %deal
::  into the virtual pier and can crash if the target app/poke is not valid in
::  that virtual state.  This generator is only for testing the bridge seam:
::  %theseus-pyre outbound fact -> sidecar -> %theseus %ames-inbound.
::
::    :theseus-pyre|ames-test ~nec ~bud 0x1234
::
/-  *theseus
::
:-  %say
|=  [* [from=ship to=ship blob=@ ~] ~]
:-  %theseus-effect
[from /sidecar-test %send [%& to] blob]
