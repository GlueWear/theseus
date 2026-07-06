::  dingy: resident-moon key/identity helpers, folded into theseus.
::
::  Pulled from the standalone %dingy lib (which stays as-is elsewhere).  Only
::  the pure crypto/identity arms are kept here -- no sur dependency -- so
::  theseus can generate, register, and sign for its own resident moons without
::  a second agent.
::
|%
::  +mint: the @p of host's moon at the given index.
++  mint
  |=  [host=@p index=@ud]
  ^-  @p
  (add host (lsh 5 index))
::
::  +parent: a moon's parent ship (low 32 bits).
++  parent
  |=  who=@p
  ^-  @p
  `@p`(end 5 who)
::
::  +child-of: is `who` a moon of `host`?
++  child-of
  |=  [host=@p who=@p]
  ^-  ?
  ?&  =(%earl (clan:title who))
      =(host (parent who))
  ==
::
::  +key-seed: entropy-mixed seed for a resident keypair.
++  key-seed
  |=  [who=@p index=@ud eny=@]
  ^-  @
  (shaz (jam [who index eny]))
::
::  +gen-keypair: crub (suite B / ed25519) keypair from a seed.
::    Mirrors |moon: (pit:nu:crub:crypto 512 seed).
++  gen-keypair
  |=  seed=@
  ^-  [pub=pass priv=ring]
  =/  cub  (pit:nu:crub:crypto 512 seed)
  [pub:ex:cub sec:ex:cub]
::
::  +pub-from-ring: recover the public key from a private ring.
++  pub-from-ring
  |=  priv=ring
  ^-  pass
  pub:ex:(nol:nu:crub:crypto priv)
::
::  +canon: canonical signable noun, jammed to a message atom.
++  canon
  |=  [host=@p who=@p life=@ud context=@tas nonce=@uv payload=*]
  ^-  @
  (jam [%dingy-signed 1 host who life context nonce payload])
::
::  +sign-msg: detached crub signature over msg with a resident private key.
++  sign-msg
  |=  [priv=ring msg=@]
  ^-  @ux
  (sigh:as:(nol:nu:crub:crypto priv) msg)
::
::  +verify-msg: verify a detached crub signature against a public key.
++  verify-msg
  |=  [pub=pass sig=@ux msg=@]
  ^-  ?
  (safe:as:(com:nu:crub:crypto pub) sig msg)
--
