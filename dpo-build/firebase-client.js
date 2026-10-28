import {initializeManagement} from './spark-document-management.js';
import {sessionDataCache} from './load-cache.js';
import {readPool} from './read-pool.js';
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  connectAuthEmulator,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  getDocFromServer,
  getDocsFromServer,
  doc,
  collection,
  query,
  limit,
  orderBy,
  onSnapshot,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { empty, validate } from "./domain.js";
import { sparkAPI } from "./spark-api.js";
import { connectAuthenticationOnly } from "./authentication-only.js";

const entities = ["cacs", "remisiones", "lotes", "documentos", "observaciones"];
export async function connectFirebase() {
  const response = await fetch(
    new URL("../config/firebase.json", import.meta.url),
    { cache: "no-store" },
  );
  if (!response.ok)
    throw Error(
      "Firebase no está configurado. Consulte DEPLOYMENT.md; los espacios locales siguen disponibles.",
    );
  const config = await response.json();
  if (config.connectionMode === "authentication-only" && config.useEmulators === false)
    return connectAuthenticationOnly(config);
  const emulator = config.useEmulators === true;
  const spark = config.connectionMode === "spark";
  if (
    emulator &&
    (!["127.0.0.1", "localhost"].includes(location.hostname) ||
      !config.firebase.projectId.startsWith("demo-"))
  )
    throw Error(
      "Los emuladores solo se permiten en localhost y con un proyecto demo-.",
    );
  if (
    !emulator && !spark &&
    (!config.appCheckSiteKey || config.firebase.projectId.startsWith("demo-"))
  )
    throw Error(
      "Complete la configuración real y App Check antes de conectar.",
    );
  const app = initializeApp(config.firebase, "cdq");
  if (!emulator && config.appCheckSiteKey)
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(config.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  const auth = getAuth(app);
  await setPersistence(auth, browserSessionPersistence);
  const store = initializeFirestore(app, { localCache: memoryLocalCache() }),
    functions = getFunctions(app, config.region || "southamerica-east1");
  if (emulator) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(store, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  await auth.authStateReady();
  let previewStorage;try{previewStorage=sessionStorage;}catch{}
  const previewCache=sessionDataCache(previewStorage);
  const api = {
    auth,
    store,
    emulator,
    profile: null,
    async login(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async google() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    async logout() {
      previewCache.clear();
      api.profile = null;
      await signOut(auth);
    },
    watchAuth(fn) {
      return onAuthStateChanged(auth, fn);
    },
    watchProfile(uid, fn) {
      return onSnapshot(
        doc(store, "users", uid),
        { includeMetadataChanges: false },
        (s) => fn(s.data()),
        () => fn(null),
      );
    },
    async call(name, data) {
      return (await httpsCallable(functions, name)(data)).data;
    },
    async loadAdministration(state){
      const uid=auth.currentUser?.uid;if(!uid)throw Error('Inicie sesión.');
      const profile=(await getDocFromServer(doc(store,'users',uid))).data();
      if(!profile?.active||!auth.currentUser?.emailVerified||JSON.stringify(profile)!==JSON.stringify(api.profile))throw Error('Los permisos cambiaron. Actualice la sesión.');
      const result={users:[],accessRequests:[],catalogAudit:[]};
      const tasks=[];
      if(['technical','director'].includes(profile.role))tasks.push(async()=>{result.users=(await getDocsFromServer(collection(store,'users'))).docs.map(d=>({...d.data(),id:d.id}));});
      if(spark&&profile.role==='technical')tasks.push(async()=>{result.accessRequests=(await getDocsFromServer(collection(store,'accessRequests'))).docs.map(d=>({...d.data(),id:d.id}));});
      if(spark&&['technical','director'].includes(profile.role))tasks.push(async()=>{result.catalogAudit=(await getDocsFromServer(query(collection(store,'catalogAudit'),orderBy('revision','desc'),limit(50)))).docs.map(d=>d.data());});
      await readPool(tasks,t=>t());
      if(auth.currentUser?.uid!==uid)throw Error('La sesión cambió.');
      Object.assign(state,result,{administrationLoaded:true});
      return state;
    },
    async load({onCached,includeAdministration=true}={}) {
      const user = auth.currentUser;
      if (!user) {previewCache.clear();throw Error("Inicie sesión.");}
      const profile = (
        await getDocFromServer(doc(store, "users", user.uid))
      ).data();
      if (!profile?.active || !user.emailVerified){
        previewCache.clear();throw Error(
          "La cuenta debe tener correo verificado y un perfil activo asignado.",
        );
      }
      if(auth.currentUser?.uid!==user.uid)throw Error("La sesión cambió.");
      api.profile = profile;
      if(onCached){const cached=previewCache.read(user.uid,profile);if(cached){try{validate(cached);onCached(cached);}catch{previewCache.clear();}}}
      const state = empty();
      const globalScope = profile.role === "director" || (spark && profile.role === "technical");
      const tasks = [];
      if (includeAdministration && (globalScope || profile.role === "technical")) tasks.push(async () => {
        state.users = (await getDocsFromServer(collection(store, "users"))).docs.map(s => ({...s.data(), id:s.id}));
      });
      if (includeAdministration && spark && profile.role === "technical") tasks.push(async () => {
        state.accessRequests = (await getDocsFromServer(collection(store, "accessRequests"))).docs.map(s => ({...s.data(), id:s.id}));
      });
      if (!spark && profile.role === "technical") {
        await readPool(tasks, task => task());
        return state;
      }
      const readScope=async()=>{
        if(globalScope)state.gerencias=(await getDocsFromServer(collection(store,'gerencias'))).docs.map(s=>s.data());
        else {
          const ids=profile.role==='gerente'?[profile.gerenciaId]:(profile.gerencias??[]);
          const snapshots=await readPool(ids,id=>getDocFromServer(doc(store,'gerencias',id)));
          state.gerencias=snapshots.filter(s=>s.exists()).map(s=>s.data());
        }
      };
      if (spark) {
        tasks.push(async()=>{const snap=await getDocFromServer(doc(store,'observationCatalog/current'));state.observationCatalog=snap.exists()?snap.data():{revision:0,entries:{}};});
        state.lotManagement = []; state.lotVerifications = []; state.lotRequirements = []; state.catalogVersions = []; state.remisionControls = [];
        tasks.push(async () => {
          const snapshot = await getDocFromServer(doc(store, 'documentCatalog/current'));
          state.catalog = snapshot.exists() ? snapshot.data() : null;
        });
        if (includeAdministration && ['technical', 'director'].includes(profile.role)) tasks.push(async () => {
          state.catalogAudit = (await getDocsFromServer(query(collection(store, 'catalogAudit'), orderBy('revision','desc'), limit(50)))).docs.map(s => s.data());
        });
      }
      tasks.push(async () => {
        const cal = await getDocFromServer(doc(store, 'settings', 'calendar'));
        state.calendarVersion = cal.exists() ? cal.data().version : null;
        if (state.calendarVersion) {
          const calendar = await getDocFromServer(doc(store, 'calendars', state.calendarVersion));
          state.calendar = calendar.exists() ? calendar.data() : null;
        }
      });
      // Operational reads can start as soon as scope resolves, without waiting for calendars.
      await Promise.all([readPool(tasks,task=>task()),(async()=>{
        await readScope();
      const collections = spark ? [...entities, 'remisionControls', 'lotRequirements', 'lotVerifications', 'lotManagement'] : entities;
      const reads = state.gerencias.flatMap(g => collections.map(entity => ({gerenciaId:g.id, entity})));
      const snapshots = await readPool(reads, ({gerenciaId, entity}) =>
        getDocsFromServer(query(collection(store, 'gerencias', gerenciaId, entity), limit(3001))));
      snapshots.forEach((snapshot, index) => {
        if (snapshot.size > 3000) throw Error('El ámbito supera 3000 registros por entidad; consulta incompleta bloqueada.');
        const {entity, gerenciaId} = reads[index];
        const metadata = ['remisionControls','lotRequirements'].includes(entity);
        state[entity].push(...snapshot.docs.map(s => metadata ? {...s.data(), id:s.id, gerenciaId} : s.data()));
      });
      })()]);
      // Read each immutable calendar actually referenced by authorized remissions.
      // Never substitute the current version for a missing historical version.
      const historicalVersions = [...new Set(state.remisiones.map(r => r.calendarVersion).filter(v => v && v !== state.calendarVersion))];
      const historicalCalendars = await readPool(historicalVersions, version =>
        getDocFromServer(doc(store, 'calendars', version)));
      state.calendars = [
        ...(state.calendar ? [state.calendar] : []),
        ...historicalCalendars.filter(s => s.exists()).map(s => s.data()),
      ];
      if (spark) {
        const versions = [...new Set(state.lotRequirements.map(r => r.catalogVersion))];
        const snapshots = await readPool(versions, v => getDocFromServer(doc(store, 'documentCatalogVersions', String(v))));
        state.catalogVersions = snapshots.filter(s => s.exists()).map(s => s.data());
      }
      if(spark){
        await initializeManagement(store,auth,{...state,profile});
        state.deletedRecords=[...state.lotes.filter(r=>r.deletion).map(r=>({...r,collection:'lotes'})),...state.documentos.filter(r=>r.deletion).map(r=>({...r,collection:'documentos'}))];
        state.lotes=state.lotes.filter(r=>!r.deletion);
        const activeLots=new Set(state.lotes.map(r=>r.id));
        state.documentos=state.documentos.filter(r=>!r.deletion&&activeLots.has(r.loteId));
        const activeDocs=new Set(state.documentos.map(r=>r.id));
        state.observaciones=state.observaciones.filter(r=>activeDocs.has(r.documentId));
      }
      state.audit.sort((a,b) => a.at.localeCompare(b.at));
      if(auth.currentUser?.uid!==user.uid)throw Error('La sesión cambió.');
      state.administrationLoaded=includeAdministration;
      const result=validate(state);
      previewCache.write(user.uid,profile,result);
      return result;
    },
  };
  if (spark) api.call = sparkAPI(api);
  return api;
}
