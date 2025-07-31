import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";

// ==================================================================
// ★★★ 環境設定エリア (将来の環境追加も、ここに追記するだけ) ★★★
// ==================================================================
const environments = {
  // --- 本番環境 ---
  "bento-order-system-prod.web.app": {
    firebaseConfig: {
      apiKey: "AIzaSyDrBtU9O-NEEWzX-MPYpubG6tAdlvtIz8s",
      authDomain: "bento-order-system-prod.firebaseapp.com",
      projectId: "bento-order-system-prod",
      storageBucket: "bento-order-system-prod.firebasestorage.app",
      messagingSenderId: "254202039972",
      appId: "1:254202039972:web:1c8fd84892dab4de2da031",
      measurementId: "G-TDCVN9M33V"
    },
    recaptchaSiteKey: "6LfAHH8rAAAAAJwB4UWV09Dnnsm1PpTfokBZKIKg"
  },
  // --- テスト環境 ---
  "bento-order-system-staging.web.app": {
    firebaseConfig: {
      apiKey: "AIzaSyBNeOR_QHrsyJ61vjBotVUv4zIN78VgOmI",
      authDomain: "bento-order-system-staging.firebaseapp.com",
      projectId: "bento-order-system-staging",
      storageBucket: "bento-order-system-staging.firebasestorage.app",
      messagingSenderId: "604666010927",
      appId: "1:604666010927:web:f802b1aadb0e736c7115da"
    },
    recaptchaSiteKey: "6Ldc75IrAAAAAEGfzQoNXyVdwsfY2u9OmC1Q4Jbe"
  },
  // --- ローカルテスト環境 ---
  // "127.0.0.1": {
  //   firebaseConfig: {
  //     // ★★★ ここに、テスト用のfirebaseConfigの中身を貼り付け ★★★
  //   },
  //   recaptchaSiteKey: "【テスト環境用のサイトキー】"
  // }
};
// ==================================================================

// 現在のホスト名に基づいて、使用する設定を自動で選択
const hostname = window.location.hostname;
const env = environments[hostname] || environments["bento-order-system-prod.web.app"]; // 不明な場合は本番用を使用

// Firebaseを初期化
const app = initializeApp(env.firebaseConfig);

// App Checkを初期化
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(env.recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true,
});

// 初期化済みの各サービスをエクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-northeast1');
export { Timestamp };