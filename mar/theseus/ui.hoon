/-  theseus-ui
=>  |%
    ::  a moon's terminal: keystrokes, window size, or a prompt redraw
    ::
    ++  term-act
      =,  dejs:format
      %-  of
      :~  [%belts (ar belt)]
          [%size (ot ~[[%cols ni] [%rows ni]])]
          [%hail ul]
      ==
    ::  one keystroke, or a run of typed text; ctl/met carry a lowercase
    ::  letter (Tab is ctl i, as in a terminal)
    ::
    ++  belt
      |=  j=json
      ^-  belt:dill
      =/  b
        %.  j
        =,  dejs:format
        %-  of
        :~  [%txt so]
            [%ret ul]
            [%bac ul]
            [%del ul]
            [%aro (su (perk %d %l %r %u ~))]
            [%ctl (su low)]
            [%met (su low)]
        ==
      ?-  -.b
        %txt  [%txt (tuba (trip +.b))]
        %ret  [%ret ~]
        %bac  [%bac ~]
        %del  [%del ~]
        %aro  [%aro +.b]
        %ctl  [%mod %ctl `@c``@`+.b]
        %met  [%mod %met `@c``@`+.b]
      ==
    --
|_  cmd=command:theseus-ui
++  grab
  |%
  ++  noun  command:theseus-ui
  ++  json
    =,  dejs:format
    %-  of
    :~  :-  %boot
        %-  ot
        :~  [%who (se %p)]
            [%desks (ar (ot ~[[%desk (se %tas)] [%from (su (perk %host %publisher ~))]]))]
        ==
        :-  %fleet-new
        %-  ot
        :~  [%name (se %tas)]
            [%count ni]
            [%desks (ar (ot ~[[%desk (se %tas)] [%from (su (perk %host %publisher ~))]]))]
        ==
        [%fleet-pause (ot ~[[%name (se %tas)]])]
        [%fleet-resume (ot ~[[%name (se %tas)]])]
        [%fleet-kill (ot ~[[%name (se %tas)]])]
        [%dojo (ot ~[[%who (se %p)] [%command so]])]
        [%term (ot ~[[%who (se %p)] [%act term-act]])]
        [%pause (ot ~[[%who (se %p)]])]
        [%resume (ot ~[[%who (se %p)]])]
        [%kill (ot ~[[%who (se %p)]])]
        [%snapshot (ot ~[[%name (se %tas)] [%ships (ar (se %p))] [%resume bo]])]
        [%restore (ot ~[[%path pa]])]
        [%delete (ot ~[[%path pa]])]
    ==
  --
++  grow
  |%
  ++  noun  cmd
  --
++  grad  %noun
--
