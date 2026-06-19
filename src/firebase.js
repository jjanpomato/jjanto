// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB7MqeujgpCIyo7VAazgs94boXZcifkY-c",
  authDomain: "jjantoplan.firebaseapp.com",
  databaseURL: "https://jjantoplan-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jjantoplan",
  storageBucket: "jjantoplan.firebasestorage.app",
  messagingSenderId: "935494754174",
  appId: "1:935494754174:web:9a7b565313c137a070dd2f",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 코드(code)를 키 삼아 데이터를 올리고 받아오는 헬퍼 함수
// 동기화 코드에 특수문자가 섞여 들어와도 Realtime DB 키로 쓸 수 있도록 안전하게 치환
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
