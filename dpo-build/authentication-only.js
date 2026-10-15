import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Etapa de conexión: no instancia Firestore ni concede permisos por correo.
export async function connectAuthenticationOnly(config) {
  const auth = getAuth(initializeApp(config.firebase, "cdq"));
  await setPersistence(auth, browserSessionPersistence);
  await auth.authStateReady();
  return {
    auth, authOnly: true, profile: null,
    watchAuth: listener => onAuthStateChanged(auth, listener),
    google: () => signInWithPopup(auth, new GoogleAuthProvider()),
    logout: () => signOut(auth),
    call: async () => { throw Error("El guardado en Spark aún no está habilitado."); },
  };
}
