const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/stockpro/dashboard-client.js'),'utf8');
const ctx={today:()=>'2026-10-05'};vm.createContext(ctx);vm.runInContext(source.slice(0,source.indexOf('const dashboardColors')),ctx);
test('daily charts group amounts, isolate days and preserve unknown categories',()=>{
 const data={products:[{id:1,category:'Alimentos'},{id:2,category:'Bebidas'}],sales:[{date:'2026-10-03',pay:'Efectivo',total:50,items:[{productId:1,qty:2,price:10},{productId:2,qty:3,price:10}]},{date:'2026-10-03',pay:'Crédito',total:15,items:[{productId:99,qty:1,price:15}]},{date:'2026-10-02',pay:'Efectivo',total:999,items:[]}]};
 const r=JSON.parse(JSON.stringify(ctx.dailySalesBreakdown(data,'2026-10-03')));
 assert.deepEqual(r.payments,[{label:'Efectivo',value:50},{label:'Crédito',value:15}]);assert.deepEqual(r.categories,[{label:'Bebidas',value:30},{label:'Alimentos',value:20},{label:'Sin categoría',value:15}]);
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.dailySalesBreakdown(data,'2026-10-04'))),{payments:[],categories:[]});
});
function liveSetup(){let timer,callback,unsubscribed=false,calls=0;const c={authGeneration:1,auth:{currentUser:{uid:'a'}},roleBlocked:false,conflict:false,navigator:{onLine:true},envelope:{revision:1,pending:false},syncing:false,reading:false,cart:[],document:{querySelector:()=>null},syncState:'connected',setTimeout:fn=>{timer=fn;return 1},clearTimeout:()=>{timer=null},retrySync:async()=>{calls++;c.envelope.revision=2;c.envelope.pending=false},cloudFailure:e=>{throw e},sparkRoot:()=>({collection:()=>({doc:()=>({onSnapshot:(options,fn)=>{callback=fn;return()=>unsubscribed=true}})})})};vm.createContext(c);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../docs/stockpro/live-client.js'),'utf8'),c);c.startLiveUpdates(1);return {c,event:r=>callback({exists:true,data:()=>({revision:r}),metadata:{}}),tick:async()=>{const fn=timer;timer=null;if(fn)await fn()},calls:()=>calls,stopped:()=>unsubscribed};}
test('remote revision refreshes once, catches changes during reading, avoids idle polling',async()=>{const t=liveSetup();t.event(2);t.c.reading=true;await t.tick();assert.equal(t.calls(),0);t.c.reading=false;await t.tick();assert.equal(t.calls(),1);t.event(2);await t.tick();assert.equal(t.calls(),1);t.c.stopLiveUpdates();assert(t.stopped())});
test('live update defers active forms and ignores previous sessions',async()=>{const t=liveSetup();t.c.cart=[{}];t.event(2);await t.tick();assert.equal(t.calls(),0);t.c.cart=[];t.c.authGeneration=2;await t.tick();assert.equal(t.calls(),0)});

test('due date list groups unpaid balances by client and excludes cancelled/other dates',()=>{
 const data={clients:[{id:1,name:'Ana',phone:'123'},{id:2,name:'Beto'}],credits:[{clientId:1,dueDate:'2026-10-05',balance:20},{clientId:1,dueDate:'2026-10-05',balance:30},{clientId:2,dueDate:'2026-10-05',balance:0},{clientId:2,dueDate:'2026-10-04',balance:100}]};
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.clientsDueOn(data,'2026-10-05'))),[{id:1,name:'Ana',phone:'123',count:2,balance:50}]);assert.equal(ctx.clientsDueOn(data,'2026-10-06').length,0);
});

test('recent sales resets on calendar rollover without deleting history',()=>{
 let day='2026-10-05',tick;const table={innerHTML:'',closest:()=>({querySelector:()=>({innerHTML:''})})};
 const data={sales:[{id:1,date:'2026-10-04',client:'Anterior',pay:'Efectivo',total:1},{id:2,date:day,client:'Actual',pay:'Efectivo',total:2}]};
 const c={today:()=>day,db:data,document:{getElementById:()=>table,addEventListener:()=>{}},setInterval:fn=>tick=fn,esc:String,money:String,isSaleConfirmed:()=>true,renderDashboard:()=>{},renderClients:()=>{}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../docs/stockpro/pos-client.js'),'utf8'),c);c.renderSales();assert.match(table.innerHTML,/Actual/);assert.doesNotMatch(table.innerHTML,/Anterior/);day='2026-10-06';tick();assert.match(table.innerHTML,/Sin ventas registradas hoy/);assert.equal(data.sales.length,2);
});
