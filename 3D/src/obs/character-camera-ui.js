const labels={front:['正面','Front'],left:['左斜め上','Upper left'],right:['右斜め上','Upper right']};
const names={milo:['マイロ','Milo'],cat:['ルーシー','Lucy'],droid:['ドロイド','Droid']};

export function updateCharacterCameraUI(document,view,words){
  const $=id=>document.getElementById(id),camera=view?.characterCamera,panel=$('character-view-controls');
  const available=Boolean(camera?.available),selected=camera?.selected;
  panel.hidden=!available;
  for(const id of Object.keys(names))$('view-'+id).setAttribute('aria-expanded',String(available&&selected===id));
  if(available){
    const owner=document.querySelector(`[data-camera-character="${selected}"]`);
    if(panel.parentElement!==owner)owner.append(panel);
    panel.setAttribute('aria-label',`${words(...names[selected])} / ${words('視点','Camera')}`);
    const label=words(...labels[camera.angle]),next=words(...labels[{front:'left',left:'right',right:'front'}[camera.angle]]);
    const angle=$('follow-angle');angle.dataset.angle=camera.angle;
    angle.setAttribute('aria-label',`${words('俯瞰角度を切り替える','Change viewing angle')}: ${next}`);
    const eye=$('first-person'),eyeLabel=camera.firstPerson?words('俯瞰に戻る','Return to follow view'):words('本人視点','First-person view');
    eye.setAttribute('aria-pressed',String(camera.firstPerson));eye.setAttribute('aria-label',eyeLabel);
    const suffix=camera.firstPerson?words('本人視点','First person'):label;
    $('camera-label').textContent=`${words(...names[selected])} / ${suffix}`;
  }
  for(const id of ['zoom-in','zoom-out'])$(id).disabled=Boolean(camera?.active);
  updateFirstPersonOverlay(document,camera?.rest,Boolean(camera?.active));
}

export function updateFirstPersonOverlay(document,rest,active){
  const $=id=>document.getElementById(id),closure=active?(rest?.closure??0):0;
  const lids=$('first-person-eyelids');lids.hidden=closure===0;
  if(closure){
    const edge=60*closure,curve=40*closure-30*Math.sin(Math.PI*closure);
    $('first-person-upper-lid').setAttribute('d',`M0 0H100V${edge}Q50 ${curve} 0 ${edge}Z`);
    $('first-person-lower-lid').setAttribute('d',`M0 100H100V${100-edge}Q50 ${100-curve} 0 ${100-edge}Z`);
  }
}
