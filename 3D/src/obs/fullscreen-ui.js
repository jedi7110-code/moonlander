export function updateFullscreenUI(document,words,refreshIcons){
  const button=document.getElementById('obs-fullscreen'),active=Boolean(document.fullscreenElement);
  const icon=active?'minimize-2':'maximize-2';
  const label=active?words('全画面を解除','Exit fullscreen'):words('全画面','Fullscreen');
  button.hidden=!document.fullscreenEnabled;
  button.dataset.tip=label;
  button.setAttribute('aria-label',label);
  button.setAttribute('aria-pressed',String(active));
  if(button.dataset.fullscreenIcon!==icon){
    button.dataset.fullscreenIcon=icon;
    button.innerHTML=`<i data-lucide="${icon}" aria-hidden="true"></i>`;
    refreshIcons();
  }
}
