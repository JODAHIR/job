let observer;
export function enhanceDashboard(){
 observer?.disconnect();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.querySelectorAll('.intel-kpi').forEach(card=>{
  const key=card.querySelector('[data-intel-indicator]')?.dataset.intelIndicator;
  const value=card.querySelector(':scope > strong');
  const original=value.textContent;
  const n=Number(original.replace(/[^0-9.-]/g,''));
  const color=value.style.color;
  card.dataset.tone=color==='rgb(128, 96, 0)'?'yellow':color==='rgb(33, 130, 74)'?'green':color==='rgb(188, 48, 56)'?'red':color==='rgb(100, 116, 139)'?'gray':['observed','observations','pendingControls'].includes(key)&&n>0?'yellow':key==='regularized'?'green':'blue';
  if(!reduced&&/^\d+$/.test(original.trim()))value.dataset.animateNumber=original.trim();
 });
 document.querySelectorAll('progress').forEach(bar=>{
  bar.style.setProperty('--progress-color',bar.style.accentColor||'#078486');
  if(!reduced)bar.dataset.animateProgress=bar.value;
 });
 if(reduced)return;
 observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{
  if(!isIntersecting)return;observer.unobserve(target);
  const progress=target.hasAttribute('data-animate-progress');
  const final=Number(progress?target.dataset.animateProgress:target.dataset.animateNumber);
  const original=target.textContent;
  if(!progress)target.setAttribute('aria-label',original);
  const start=performance.now();
  function frame(now){if(!target.isConnected)return;const t=Math.min(1,(now-start)/750),value=final*(1-(1-t)**3);
   if(progress)target.value=value;else target.textContent=t===1?original:String(Math.round(value));
   if(t<1)requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
 }),{threshold:.15});
 document.querySelectorAll('[data-animate-number],[data-animate-progress]').forEach(el=>observer.observe(el));
}
