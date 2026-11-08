import urllib.request, urllib.error, json, base64, time
from pathlib import Path
host='http://127.0.0.1:8188'; project='demo-cah-archivo'; root=f'projects/{project}/databases/(default)/documents'
def request(path,data,token='owner',method='POST'):
 req=urllib.request.Request(host+path,json.dumps(data).encode() if data is not None else None,{'Content-Type':'application/json','Authorization':'Bearer '+token},method=method)
 try:
  with urllib.request.urlopen(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
def value(v):
 if isinstance(v,bool):return {'booleanValue':v}
 if isinstance(v,int):return {'integerValue':str(v)}
 if isinstance(v,str):return {'stringValue':v}
 if isinstance(v,list):return {'arrayValue':{'values':[value(x) for x in v]}}
 if isinstance(v,dict):return {'mapValue':{'fields':fields(v)}}
 return {'nullValue':None}
def fields(d):return {k:value(v) for k,v in d.items()}
def seed(path,d):
 code,result=request('/v1/'+root+'/'+path,{'fields':fields(d)},method='PATCH');assert code==200,(code,result)
def token(uid):
 enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
 return enc({'alg':'none','typ':'JWT'})+'.'+enc({'sub':uid,'user_id':uid,'email':uid+'@example.test','email_verified':True,'iat':int(time.time()),'exp':int(time.time())+3600,'aud':project,'iss':'https://securetoken.google.com/'+project,'firebase':{'sign_in_provider':'password'}})+'.'
request(f'/emulator/v1/projects/{project}/databases/(default)/documents',None,method='DELETE')
rules=Path('dpo-build/firestore.spark.rules').read_text(); code,result=request(f'/emulator/v1/projects/{project}:securityRules',{'rules':{'files':[{'name':'firestore.rules','content':rules}]}},method='PUT');assert code==200,(code,result)
seed('gerencias/norte',{'name':'Gerencia Norte','responsables':[{'correo':'responsable@example.test'},{'correo':'otro@example.test'}]})
for uid,role in [('admin','technical'),('director','director'),('responsable','asistente'),('no','asistente'),('fuera','gerente')]:seed('users/'+uid,{'active':True,'role':role,'description':uid,'gerencias':['norte'],'gerenciaId':'sur'})
seed('gerencias/norte/remisiones/r1',{'receivedOn':'2026-10-26','year':2026,'month':10,'revision':1})
base={'kind':'archive','name':'GDSZ-Norte-2026-10-15','number':'15','month':10,'year':2026,'remisionRevision':1}
counter=0
def write(uid,extra={},expected=200,id=None,delete=False):
 global counter
 counter+=1;id=id or 'event'+str(counter)
 d={**base,'id':id,'actor':uid,'owner':uid,**extra}
 w={'update':{'name':root+'/gerencias/norte/remisiones/r1/custodyEvents/'+id,'fields':fields(d)},'updateTransforms':[{'fieldPath':'at','setToServerValue':'REQUEST_TIME'}]}
 if delete:w={'delete':root+'/gerencias/norte/remisiones/r1/custodyEvents/'+id}
 code,result=request('/v1/projects/'+project+'/databases/(default)/documents:commit',{'writes':[w]},token(uid));assert code==expected,(counter,code,result)
for uid in ['admin','director','responsable']:write(uid)
write('no',expected=403);write('fuera',expected=403)
for extra in [{'month':11},{'year':2025},{'number':'0'},{'name':'inventado'},{'actor':'director'},{'extra':'x'},{'remisionRevision':0}]:write('admin',extra,403)
write('admin',id='fixed');write('admin',id='fixed',expected=403);write('admin',id='fixed',delete=True,expected=403)
base={'kind':'scan','confirmed':True,'remisionRevision':1};write('responsable');write('admin',{'confirmed':False},403)
seed('gerencias/norte/remisiones/r1',{'receivedOn':'2026-10-26','year':2026,'month':10,'revision':1,'annulment':{'reason':'prueba'}});write('admin',expected=403)
print(f'{counter} pruebas de permisos e integridad superadas; datos exclusivamente locales.')
