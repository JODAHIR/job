// Session-only preview. A fresh authorized profile is required before reading it.
export function sessionDataCache(storage,ttl=300000){
 const key='cdq-authorized-preview-v1';
 return {
  clear(){try{storage.removeItem(key);}catch{}},
  read(uid,profile,now=Date.now()){
   try{const entry=JSON.parse(storage.getItem(key));
    if(!entry||entry.uid!==uid||entry.profile!==JSON.stringify(profile)||now-entry.at>ttl||now<entry.at){storage.removeItem(key);return null;}
    return entry.data;
   }catch{return null;}
  },
  write(uid,profile,data,now=Date.now()){
   try{storage.setItem(key,JSON.stringify({uid,profile:JSON.stringify(profile),data,at:now}));}catch{try{storage.removeItem(key);}catch{}}
  }
 };
}
