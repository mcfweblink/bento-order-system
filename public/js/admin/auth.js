import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from '../firebase-init.js';

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

export function handleLogout() {
    signOut(auth).catch(error => console.error('ログアウトエラー', error));
}