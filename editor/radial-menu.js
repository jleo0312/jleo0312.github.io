/* Circular media picker used only inside the editing preview. */
(function(){
'use strict';
window.PortfolioRadialMenu={mount({root,choose}){
 const events=new AbortController(),on=(node,name,handler)=>node.addEventListener(name,handler,{signal:events.signal});
 const menu=document.createElement('div');menu.className='future-radial-menu';menu.id='future-media-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Add future project media');root.append(menu);
 const choices=[[1,'Single media'],[2,'Double media'],[3,'Triple media']],buttons=[];let anchor=null;
 choices.forEach(([count,label],index)=>{const angle=-Math.PI/2+index*Math.PI*2/choices.length,button=document.createElement('button');button.type='button';button.className='future-radial-option';button.setAttribute('role','menuitem');button.setAttribute('aria-label',label);button.dataset.mediaCount=count;button.style.left=(152+Math.cos(angle)*96)+'px';button.style.top=(152+Math.sin(angle)*96)+'px';const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent='+'+count;const text=document.createElement('span');text.textContent=label;button.append(icon,text);menu.append(button);buttons.push(button);button.onclick=()=>{const sectionId=anchor?.dataset.futureAdd;close(false);if(sectionId)choose(sectionId,count);};});
 const cancel=document.createElement('button');cancel.type='button';cancel.className='future-radial-close';cancel.textContent='×';cancel.setAttribute('aria-label','Close add media menu');menu.append(cancel);cancel.onclick=()=>close();
 function close(focus=true){menu.hidden=true;if(anchor){anchor.setAttribute('aria-expanded','false');anchor.classList.remove('is-open');if(focus&&anchor.isConnected)anchor.focus({preventScroll:true});}anchor=null;}
 function position(){if(!anchor)return;const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-312,rect.left+rect.width/2-152))+'px';menu.style.top=(rect.top>=320?rect.top-312:rect.bottom+312<=innerHeight-8?rect.bottom+8:Math.max(8,Math.min(innerHeight-312,rect.top+rect.height/2-152)))+'px';}
 function open(button){if(anchor===button&&!menu.hidden){close();return;}close(false);anchor=button;anchor.setAttribute('aria-expanded','true');anchor.setAttribute('aria-controls',menu.id);anchor.classList.add('is-open');position();menu.hidden=false;buttons[0].focus({preventScroll:true});}
 on(document,'click',event=>{const button=event.target.closest('[data-future-add]');if(button){event.preventDefault();event.stopPropagation();open(button);}});
 on(document,'pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!event.target.closest('[data-future-add]'))close(false);});
 on(document,'keydown',event=>{if(menu.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}const index=buttons.indexOf(document.activeElement);let next;if(['ArrowDown','ArrowRight'].includes(event.key))next=(index+1)%buttons.length;else if(['ArrowUp','ArrowLeft'].includes(event.key))next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else if(event.key==='Tab'){close(false);return;}if(next!==undefined){event.preventDefault();buttons[next].focus();}});
 on(window,'scroll',()=>{if(!menu.hidden)position();});on(window,'resize',()=>close(false));
 return {close,destroy(){close(false);events.abort();menu.remove();}};
}};
})();
