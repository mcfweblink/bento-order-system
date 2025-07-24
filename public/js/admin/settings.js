import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebase-config.js';
import { copyToClipboard, showCopyTooltip } from './ui.js';

/**
 * 各種設定タブ（オプション、メール、店舗）を初期化する
 */
export function initSettings() {
    // オプション設定
    loadAndRenderOptions('servingStyles', 'serving-styles-list');
    loadAndRenderOptions('paymentMethods', 'payment-methods-list');
    document.getElementById('add-serving-style-button').addEventListener('click', () => addOption('servingStyles', 'new-serving-style'));
    document.getElementById('add-payment-method-button').addEventListener('click', () => addOption('paymentMethods', 'new-payment-method'));

    // メール設定
    loadEmailSettings();
    document.getElementById('save-email-settings-button').addEventListener('click', saveEmailSettings);
    renderPlaceholders();

    // 店舗設定
    loadStoreSettings();
    document.getElementById('save-store-settings-button').addEventListener('click', saveStoreSettings);
}

async function loadAndRenderOptions(collectionName, listElementId) {
    const listElement = document.getElementById(listElementId);
    onSnapshot(collection(db, collectionName), (snapshot) => {
        listElement.innerHTML = '';
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-2 border-b';
            div.innerHTML = `
                <span>${item.name}</span>
                <button class="delete-option-btn text-red-500 text-xl">&times;</button>
            `;
            div.querySelector('.delete-option-btn').addEventListener('click', () => deleteOption(collectionName, item.id));
            listElement.appendChild(div);
        });
    });
}

async function addOption(collectionName, inputElementId) {
    const inputElement = document.getElementById(inputElementId);
    const name = inputElement.value.trim();
    if (name) {
        await addDoc(collection(db, collectionName), { name });
        inputElement.value = '';
    }
}

async function deleteOption(collectionName, id) {
    await deleteDoc(doc(db, collectionName, id));
}

async function loadEmailSettings() {
    const docRef = doc(db, "settings", "emailTemplates");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('from-email').value = data.fromEmail || '';
        document.getElementById('admin-email').value = data.adminEmail || '';
        document.getElementById('order-confirm-subject').value = data.orderConfirmSubject || '';
        document.getElementById('order-confirm-body').value = data.orderConfirmBody || '';
        document.getElementById('admin-notify-subject').value = data.adminNotifySubject || '';
        document.getElementById('admin-notify-body').value = data.adminNotifyBody || '';
        document.getElementById('process-complete-subject').value = data.processCompleteSubject || '';
        document.getElementById('process-complete-body').value = data.processCompleteBody || '';
    }
}

async function saveEmailSettings() {
    const data = {
        fromEmail: document.getElementById('from-email').value,
        adminEmail: document.getElementById('admin-email').value,
        orderConfirmSubject: document.getElementById('order-confirm-subject').value,
        orderConfirmBody: document.getElementById('order-confirm-body').value,
        adminNotifySubject: document.getElementById('admin-notify-subject').value,
        adminNotifyBody: document.getElementById('admin-notify-body').value,
        processCompleteSubject: document.getElementById('process-complete-subject').value,
        processCompleteBody: document.getElementById('process-complete-body').value,
    };
    await setDoc(doc(db, "settings", "emailTemplates"), data, { merge: true });
    alert('メール設定を保存しました。');
}

async function loadStoreSettings() {
    const docRef = doc(db, "settings", "storeInfo");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('delivery-area-text-input').value = data.deliveryAreaText || '';
    }
}

async function saveStoreSettings() {
    const deliveryAreaText = document.getElementById('delivery-area-text-input').value;
    const docRef = doc(db, "settings", "storeInfo");
    await setDoc(docRef, { deliveryAreaText }, { merge: true });
    alert('店舗設定を保存しました。');
}

function renderPlaceholders() {
    const placeholderList = document.getElementById('placeholders-list');
    const placeholders = [
        { key: '{customerName}', desc: 'お客様のお名前' },
        { key: '{orderNumber}', desc: '注文番号' },
        { key: '{totalPrice}', desc: '合計金額' },
        { key: '{orderDate}', desc: '注文日時' },
        { key: '{deliveryDate}', desc: '配送希望日' },
        { key: '{customerAddress}', desc: 'お客様の住所' },
        { key: '{customerPhone}', desc: 'お客様の電話番号' },
        { key: '{itemsList}', desc: '注文商品の一覧' },
        { key: '{dashboardUrl}', desc: '管理者向け注文詳細URL' },
        { key: '{mealType}', desc: '食事タイミング' },
        { key: '{servingStyles}', desc: '提供スタイル' },
        { key: '{paymentMethod}', desc: '支払い方法' },
        { key: '{remarks}', desc: '備考欄' },
    ];

    placeholderList.innerHTML = '';
    placeholders.forEach(p => {
        const div = document.createElement('div');
        div.innerHTML = `
            <code class="placeholder-copy bg-gray-200 p-1 rounded cursor-pointer hover:bg-gray-300">${p.key}</code>
            <span class="ml-2 text-gray-600">- ${p.desc}</span>
        `;
        div.querySelector('.placeholder-copy').addEventListener('click', (e) => {
            copyToClipboard(p.key);
            showCopyTooltip(e);
        });
        placeholderList.appendChild(div);
    });
}
