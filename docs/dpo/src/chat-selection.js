import {normalizeSearch} from './procedure-view.js';

export function selectPendingProcedure(question, options=[]){
  const answer=normalizeSearch(question).trim();
  if(!answer||!options.length)return null;
  const number=answer.match(/^(?:opcion\s*)?(\d+)$/);
  if(number){const index=Number(number[1])-1;return options[index]||null}
  const terms=answer.split(/\s+/).filter(term=>term.length>2);
  if(!terms.length)return null;
  const matches=options.filter(option=>{
    const title=normalizeSearch(option.title);
    return title.includes(answer)||terms.every(term=>title.includes(term));
  });
  return matches.length===1?matches[0]:null;
}

export function optionsMessage(options){
  return 'Encontré procedimientos relacionados en la biblioteca. Respondé con el número o el título de la opción que necesitás:\n\n'
    +options.map((option,index)=>`${index+1}. ${option.title}`).join('\n');
}
