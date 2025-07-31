import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// 変更点: 完成品の「auth」ツールを、新しい設定ファイルから直接受け取る
import { auth } from "./firebase-init.js";

// 変更点: ここで初期化を行う必要がなくなったため、関連コードを削除

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
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = './dashboard.html';
    }
});