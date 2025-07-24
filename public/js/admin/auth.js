import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from '../firebase-config.js';

/**
 * ユーザーの認証状態を監視し、ログインしていなければリダイレクトする。
 * @param {function} onSignedIn - ログイン成功時に実行されるコールバック関数
 */
export function watchAuthState(onSignedIn) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            onSignedIn();
        } else {
            window.location.href = './index.html';
        }
    });
}

/**
 * ログアウト処理
 */
export function handleLogout() {
    signOut(auth).catch(error => console.error('ログアウトエラー', error));
}
