// このファイルにFirebaseプロジェクトの接続情報を記述します。
// この情報は公開されても問題ない情報です。

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";


export const firebaseConfig = {
    apiKey: "AIzaSyDrBtU9O-NEEWzX-MPYpubG6tAdlvtIz8s",
    authDomain: "bento-order-system-prod.firebaseapp.com",
    projectId: "bento-order-system-prod",
    storageBucket: "bento-order-system-prod.firebasestorage.app",
    messagingSenderId: "254202039972",
    appId: "1:254202039972:web:1c8fd84892dab4de2da031",
    measurementId: "G-TDCVN9M33V"
  };

export const recaptchaSiteKey = "6LfAHH8rAAAAAJwB4UWV09Dnnsm1PpTfokBZKIKg"; // ここにコピーしたサイトキーを貼り付ける

// Firebaseの初期化
export const app = initializeApp(firebaseConfig);

// App Checkの初期化
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true
});

// 各サービスのインスタンスをエクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-northeast1');