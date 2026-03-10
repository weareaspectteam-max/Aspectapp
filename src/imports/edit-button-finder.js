// Edit2 ikonu olan buton var mı?
const editButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
  btn.innerHTML.includes('lucide-edit') || btn.querySelector('svg')
);
console.log('Buttons with SVG:', editButtons.length);

// Veya daha basit:
const allButtons = Array.from(document.querySelectorAll('button'));
allButtons.forEach((btn, i) => {
  if (btn.querySelector('svg')) {
    console.log(`Button ${i}:`, btn.className, btn.querySelector('svg')?.getAttribute('class'));
  }
});
vendor-core-ade2edecaf4781c7.min.js.br:54 Buttons with SVG: 36
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 0: action--enabled--UsdPf action--root--iB6FV toolbar_styles--enabledButton--aJVqf toolbar_view--menuButton--ecxh4 null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 2: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 4: button-reset__buttonReset__zO1D7 x78zum5 x6s0dn4 x87ps6o x1ypdohk x11g6tue xfn42iu xng3xce x1r7ld26 x1717udv xh8yej3 xdpxx8g xv1l7n4 x1op4zxa xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 5: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 6: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 7: button-reset__buttonReset__zO1D7 x1hlhp33 xiwbtd4 xnt52d2
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 9: button-reset__buttonReset__zO1D7 x78zum5 x6s0dn4 x87ps6o x1ypdohk x11g6tue xfn42iu xng3xce x1r7ld26 x1717udv xh8yej3 xdpxx8g xv1l7n4 x1op4zxa xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 10: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 11: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 12: button-reset__buttonReset__zO1D7 x1hlhp33 xiwbtd4 xnt52d2
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 14: button-reset__buttonReset__zO1D7 x78zum5 x6s0dn4 x87ps6o x1ypdohk x11g6tue xfn42iu xng3xce x1r7ld26 x1717udv xh8yej3 xdpxx8g xv1l7n4 x1op4zxa xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 15: button-reset__buttonReset__zO1D7 x1ypdohk x78zum5 x6s0dn4 x87ps6o x11g6tue xng3xce x1r7ld26 x1717udv xh8yej3 xv1l7n4 x1op4zxa xdpxx8g xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 16: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 17: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 18: button-reset__buttonReset__zO1D7 x1hlhp33 xiwbtd4 xnt52d2
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 19: button-reset__buttonReset__zO1D7 x78zum5 x6s0dn4 x87ps6o x1ypdohk x11g6tue xfn42iu xng3xce x1r7ld26 x1717udv xh8yej3 xdpxx8g xv1l7n4 x1op4zxa xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 20: button-reset__buttonReset__zO1D7 x1ypdohk x78zum5 x6s0dn4 x87ps6o x11g6tue xng3xce x1r7ld26 x1717udv xh8yej3 xv1l7n4 x1op4zxa xdpxx8g xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 21: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 22: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 23: button-reset__buttonReset__zO1D7 x1hlhp33 xiwbtd4 xnt52d2
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 24: button-reset__buttonReset__zO1D7 x78zum5 x6s0dn4 x87ps6o x1ypdohk x11g6tue xfn42iu xng3xce x1r7ld26 x1717udv xh8yej3 xdpxx8g xv1l7n4 x1op4zxa xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 25: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 26: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j feedback_view--feedbackButton--rOGZR
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 27: button-reset__buttonReset__zO1D7 x1hlhp33 xiwbtd4 xnt52d2
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 28: button-reset__buttonReset__zO1D7 x78zum5 x6s0dn4 x87ps6o x1ypdohk x11g6tue xfn42iu xng3xce x1r7ld26 x1717udv xh8yej3 xdpxx8g xv1l7n4 x1op4zxa xzgfmne x1bmturs
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 29: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 30: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr dialog-trigger-button__dialogTriggerButton__bjzvt dialog-trigger-button__ghost__OrMww null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 31: button-reset__buttonReset__zO1D7 xt0e3qv x78zum5 x6s0dn4 x195vfkc xjbqb8w xagxu50 x120yq3e x12fzoxp x163pfp xmzs88n x1t0vds8 x1a2a7pz xiwbtd4 x13iak60 xnbqk7k x2lah0s
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 32: x1xwekrv xlrawln x10db7i2 x6s0dn4 x78zum5 x9krgt8 xm9ble1 xvy4d1p xxk0z11 x2lah0s
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 33: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 34: multiplayer_view--avatarWithCollaborationToolsContainer--2AFdO multiplayer_view--fullHeightSidebarAvatarWithToolsOverrides--o6yG5 multiplayer-animation-svg 
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 35: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j icon-button__largeSize__jKNM1 null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 36: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr dialog-trigger-button__dialogTriggerButton__bjzvt dialog-trigger-button__ghost__OrMww dialog-trigger-button__lg__yHNjf null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 37: button-reset__buttonReset__zO1D7 icon_button_32--iconButton--E0ZHG null
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 40: button-reset__buttonReset__zO1D7 help_widget--clickableSvg--q86Am help_widget--helpWidget--1t2eV help_widget--helpWidgetShared--Qb3pt text--_negText--7Cnf0 help_widget--helpWidgetIcon--ZxhAq
vendor-core-ade2edecaf4781c7.min.js.br:54 Button 41: button-reset__buttonReset__zO1D7 base-icon-button__baseIconButton__TXKzr icon-button__iconButton__CTj-- icon-button__ghost__1ok6j null