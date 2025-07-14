import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const logoutButton = document.getElementById('logout-button');
const appContainer = document.getElementById('app-container');
const loadingDiv = document.getElementById('loading');

// --- ログイン状態を監視 ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ログインしている場合
        // ローディング表示を消して、メインコンテンツを表示
        loadingDiv.style.display = 'none';
        appContainer.style.display = 'block';
    } else {
        // ログインしていない場合
        // ログインページにリダイレクト
        window.location.href = './index.html';
    }
});

// --- ログアウト処理 ---
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        // ログアウト成功
        // ログインページにリダイレクト
        window.location.href = './index.html';
    }).catch((error) => {
        console.error("ログアウトエラー:", error);
    });
});
