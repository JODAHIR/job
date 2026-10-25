// Small SVG charts: no remote scripts, no data sent to third parties.
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#007f83','#245da1','#d78b22','#9b4b83','#547685'];
export function bars(items,{label,value,action='cac'}={}) {
 const max=Math.max(1,...items.map(r=>Number(r[value])||0));
 return `<div class="intel-bars">${items.slice(0,15).map((r,i)=>`<button class="intel-bar" data-intel-${action}="${escapeHTML(r.id)}"><span>${escapeHTML(r[label])}</span><span class="intel-bar-track"><span style="width:${Math.max(0,r[value]/max*100)}%;background:${colors[i%colors.length]}"></span></span><strong>${escapeHTML(r[value])}</strong></button>`).join('')}</div>${items.length?'':'<p class="empty">Sin registros para esta selección.</p>'}`;
}
export function ring(items,title,palette=colors) {
 const total=items.reduce((sum,r)=>sum+r.value,0);let offset=0;
 if(!total)return '<p class="empty">Sin datos evaluables.</p>';
 return `<div class="intel-ring"><svg viewBox="0 0 160 160" role="img" aria-label="${escapeHTML(title)}">${items.map((r,i)=>{
  const length=r.value/total*100,part=`<circle cx="80" cy="80" r="60" fill="none" stroke="${palette[i%palette.length]}" stroke-width="22" pathLength="100" stroke-dasharray="${length} ${100-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"><title>${escapeHTML(r.label)}: ${r.value}</title></circle>`;offset+=length;return part;
 }).join('')}<text x="80" y="85" text-anchor="middle">${total}</text></svg><ul>${items.map((r,i)=>`<li><span class="intel-dot" style="background:${palette[i%palette.length]}"></span>${escapeHTML(r.label)}: <strong>${r.value}</strong> (${(r.value/total*100).toFixed(1)} %)</li>`).join('')}</ul></div>`;
}
export function lines(items,key,title) {
 const max=Math.max(1,...items.map(r=>r[key])),x=i=>30+i*88,y=r=>130-r[key]/max*100;
 return `<svg class="intel-line" viewBox="0 0 510 180" role="img" aria-label="${escapeHTML(title)}"><path d="M30 25V130H485" fill="none" stroke="#b9ccd5"/><polyline points="${items.map((r,i)=>`${x(i)},${y(r)}`).join(' ')}" fill="none" stroke="#007f83" stroke-width="3"/>${items.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r)}" r="5" fill="#245da1"><title>${escapeHTML(r.label)}: ${r[key]}${r.registered?'':' · Sin remisiones registradas'}</title></circle><text x="${x(i)}" y="${y(r)-10}" text-anchor="middle">${r[key]}</text><text x="${x(i)}" y="153" text-anchor="middle">${escapeHTML(r.label.slice(5))}</text>`).join('')}</svg>`;
}
