import {normalizeSearch} from './procedure-view.js';

function distance(a,b){
  let row=Array.from({length:b.length+1},(_,index)=>index);
  for(let i=1;i<=a.length;i++){let next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next}
  return row[b.length];
}

export function relatedProcedures(items,tokens,question=''){
  const normalizedQuestion=normalizeSearch(question).trim();
  return items.map(item=>{
    const text=normalizeSearch([item.title,item.questions,item.support,item.category,...(item.keywords||[])].join(' '));
    const indexedWords=[...new Set(text.match(/[a-z0-9]+/g)||[])];
    let score=normalizedQuestion&&text.includes(normalizedQuestion)?20:0;
    for(const token of tokens){
      if(indexedWords.includes(token))score+=10;
      else if(indexedWords.some(word=>word.length>2&&(word.startsWith(token)||token.startsWith(word))))score+=6;
      else if(token.length>4&&indexedWords.some(word=>Math.abs(word.length-token.length)<=1&&distance(word,token)<=1))score+=3;
    }
    return {...item,similarity:score};
  }).filter(item=>item.similarity>0).sort((a,b)=>b.similarity-a.similarity||a.title.localeCompare(b.title,'es')).slice(0,6);
}
