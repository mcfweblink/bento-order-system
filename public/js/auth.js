import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginButton = document.getElementById('login-button');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

// --- ログイン処理 ---
loginButton.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // ログイン成功
            window.location.href = './dashboard.html';
        })
        .catch((error) => {
            // ログイン失敗
            errorMessage.textContent = 'メールアドレスまたはパスワードが間違っています。';
            console.error("ログインエラー:", error);
        });
});

// --- すでにログイン済みかチェック ---
// ログインページを開いた時点で、もしすでにログイン済みだったらダッシュボードに飛ばす
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = './dashboard.html';
    }
});