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
  onSnapshot,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { empty, validate } from "../docs/dpo/cdq-v3/src/domain.js";
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
    async load() {
      const user = auth.currentUser;
      if (!user) throw Error("Inicie sesión.");
      const profile = (
        await getDocFromServer(doc(store, "users", user.uid))
      ).data();
      if (!profile?.active || !user.emailVerified)
        throw Error(
          "La cuenta debe tener correo verificado y un perfil activo asignado.",
        );
      api.profile = profile;
      const state = empty();
      if (profile.role === "technical") {
        state.users = (
          await getDocsFromServer(collection(store, "users"))
        ).docs.map((s) => ({ ...s.data(), id: s.id }));
        if (spark) state.accessRequests = (await getDocsFromServer(collection(store, "accessRequests"))).docs.map(d => d.data());
        if (!spark) return state;
      }
      if (profile.role === "director" || (spark && profile.role === "technical"))
        state.gerencias = (
          await getDocsFromServer(collection(store, "gerencias"))
        ).docs.map((s) => s.data());
      else {
        const ids =
          profile.role === "gerente"
            ? [profile.gerenciaId]
            : (profile.gerencias ?? []);
        for (const id of ids) {
          const s = await getDocFromServer(doc(store, "gerencias", id));
          if (s.exists()) state.gerencias.push(s.data());
        }
      }
      // Bounded parallel reads; audit is fetched separately using cursors.
      for (const g of state.gerencias) {
        const snapshots = await Promise.all(
          entities.map((c) =>
            getDocsFromServer(
              query(collection(store, "gerencias", g.id, c), limit(3001)),
            ),
          ),
        );
        snapshots.forEach((snap, i) => {
          if (snap.size > 3000)
            throw Error(
              "El ámbito supera 3000 registros por entidad; requiere paginación operativa adicional.",
            );
          state[entities[i]].push(...snap.docs.map((s) => s.data()));
        });
      }
      if (profile.role === "director" || (spark && profile.role === "technical")) {
        state.users = (
          await getDocsFromServer(collection(store, "users"))
        ).docs.map((s) => ({ ...s.data(), id: s.id }));
      }
      state.audit.sort((a, b) => a.at.localeCompare(b.at));
      const cal = await getDocFromServer(doc(store, "settings", "calendar"));
      state.calendarVersion = cal.exists() ? cal.data().version : null;
      return validate(state);
    },
  };
  if (spark) api.call = sparkAPI(api);
  return api;
}
