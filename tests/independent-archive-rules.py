exec(open('tests/custody-rules.py').read())
base={'id':'2026_10_22','gerenciaId':'norte','name':'GDSZ-Norte-2026-10-22','number':'22','year':2026,'month':10,'origin':'independent','description':'Archivo histórico','shelf':'E01','row':'F2','section':'D','scanned':False}
def archive(uid,extra={},expected=200,delete=False):
 d={**base,'actor':uid,'owner':uid,**extra};path=root+'/gerencias/norte/independentArchives/'+d['id']
 w={'update':{'name':path,'fields':fields(d)},'updateTransforms':[{'fieldPath':'at','setToServerValue':'REQUEST_TIME'}]}
 if delete:w={'delete':path}
 code,result=request('/v1/projects/'+project+'/databases/(default)/documents:commit',{'writes':[w]},token(uid));assert code==expected,(uid,extra,code,result)
for uid in ['no','fuera']:archive(uid,expected=403)
for x in [{'actor':'director'},{'owner':'inventado'},{'name':'otro'},{'year':1999},{'month':13},{'shelf':'E11'},{'row':'F6'},{'section':'X'},{'description':'x'*1001},{'unexpected':1},{'scanned':'Sí'}]:archive('admin',x,403)
archive('admin');archive('admin',expected=403);archive('admin',expected=403,delete=True)
for uid,n in [('director','23'),('responsable','24')]:archive(uid,{'id':'2026_10_'+n,'number':n,'name':'GDSZ-Norte-2026-10-'+n})
print('18 pruebas de archivos independientes superadas; creación, duplicados, permisos, identidad, ubicación e inmutabilidad.')
