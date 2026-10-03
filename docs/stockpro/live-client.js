/* One revision listener replaces polling. Never discard an unsent operation. */
let stopRevision=null,liveTimer=null,liveRevision=-1;
function stopLiveUpdates(){if(stopRevision)stopRevision();stopRevision=null;clearTimeout(liveTimer);liveTimer=null;liveRevision=-1;}
function scheduleLiveUpdate(generation,delay=100){
 if(liveTimer)return;
 liveTimer=setTimeout(async()=>{
  liveTimer=null;if(generation!==authGeneration||!auth?.currentUser||roleBlocked||conflict||!navigator.onLine)return;
  if(liveRevision<=envelope.revision&&!envelope.pending)return;
  if(syncing||reading||cart.length||document.querySelector('.modal.show')){scheduleLiveUpdate(generation,400);return;}
  await retrySync();
  if(generation===authGeneration&&liveRevision>envelope.revision&&syncState!=='error'&&syncState!=='conflict')scheduleLiveUpdate(generation,1000);
 },delay);
}
function startLiveUpdates(generation){
 stopRevision=sparkRoot().collection('meta').doc('state').onSnapshot({includeMetadataChanges:true},snap=>{
  if(generation!==authGeneration||snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;
  liveRevision=snap.exists?snap.data().revision:0;scheduleLiveUpdate(generation);
 },e=>{if(generation===authGeneration)cloudFailure(e)});
}
