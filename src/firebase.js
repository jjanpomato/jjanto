// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 코드(code)를 키 삼아 데이터를 올리고 받아오는 헬퍼 함수
function safeKey(code) {
  return String(code).trim().replace(/[.#$\[\]/]/g, "_");
}

export async function pushPlannerData(code, payload) {
  const key = safeKey(code);
  if (!key) throw new Error("코드가 비어있어요");
  await set(ref(db, `jjanto/${key}`), payload);
}

export async function pullPlannerData(code) {
  const key = safeKey(code);
  if (!key) throw new Error("코드가 비어있어요");
  const snap = await get(ref(db, `jjanto/${key}`));
  return snap.exists() ? snap.val() : null;
}
