import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
import { firebaseConfig, recaptchaSiteKey } from "./firebase-config.js";

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(recaptchaSiteKey),
  isTokenAutoRefreshEnabled: true
});
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- 認証状態の監視 ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        initDashboard();
    } else {
        window.location.href = './index.html';
    }
});

// --- ダッシュボードの初期化 ---
function initDashboard() {
    // タブ切り替えのロジック
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(item => item.classList.remove('border-blue-500', 'text-blue-600', 'border-transparent'));
            contents.forEach(content => content.classList.add('hidden'));
            tab.classList.add('border-blue-500', 'text-blue-600');
            const target = document.querySelector(tab.getAttribute('href'));
            target.classList.remove('hidden');
        });
    });
    document.querySelector('.tab-link').click();

    // 各機能のイベントリスナーを設定
    document.getElementById('logout-button').addEventListener('click', onLogout);

    // 商品管理
    loadProductsAdmin();
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
    document.getElementById('cancel-edit-button').addEventListener('click', resetProductForm);
    document.getElementById('product-image').addEventListener('change', previewImage);

    // 受注管理
    loadOrders();
    document.getElementById('csv-export-button').addEventListener('click', exportOrdersToCSV);
    document.getElementById('close-modal-button').addEventListener('click', () => document.getElementById('order-details-modal').classList.add('hidden'));

    // 各種設定
    loadAndRenderOptions('servingStyles', 'serving-styles-list');
    loadAndRenderOptions('paymentMethods', 'payment-methods-list');
    document.getElementById('add-serving-style-button').addEventListener('click', () => addOption('servingStyles', 'new-serving-style'));
    document.getElementById('add-payment-method-button').addEventListener('click', () => addOption('paymentMethods', 'new-payment-method'));
    loadEmailSettings();
    document.getElementById('save-email-settings-button').addEventListener('click', saveEmailSettings);
}

// --- ログアウト処理 ---
function onLogout() {
    signOut(auth).catch(error => console.error('ログアウトエラー', error));
}

// --- 商品管理機能 ---
const productsListAdmin = document.getElementById('products-list-admin');
const productForm = document.getElementById('product-form');
const imagePreview = document.getElementById('image-preview');
const productImageInput = document.getElementById('product-image');
const productImageUrlHidden = document.getElementById('product-image-url-hidden');

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

async function loadProductsAdmin() {
    const q = query(collection(db, "products"), orderBy("name"));
    onSnapshot(q, (snapshot) => {
        productsListAdmin.innerHTML = '';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center p-2 border rounded';
            div.innerHTML = `
                <span>${product.name} (${product.price}円) - ${product.isVisible ? '表示中' : '非表示'}</span>
                <div class="flex gap-2">
                    <button class="duplicate-product-btn bg-blue-500 text-white px-3 py-1 rounded text-sm">複製</button>
                    <button class="edit-product-btn bg-yellow-500 text-white px-3 py-1 rounded text-sm">編集</button>
                    <button class="delete-product-btn bg-red-500 text-white px-3 py-1 rounded text-sm">削除</button>
                </div>
            `;
            div.querySelector('.duplicate-product-btn').addEventListener('click', () => duplicateProduct(product));
            div.querySelector('.edit-product-btn').addEventListener('click', () => editProduct(product));
            div.querySelector('.delete-product-btn').addEventListener('click', () => deleteProduct(product));
            productsListAdmin.appendChild(div);
        });
    });
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const description = document.getElementById('product-description').value;
    const price = Number(document.getElementById('product-price').value);
    const isVisible = document.getElementById('product-is-visible').checked;
    const imageFile = productImageInput.files[0];

    let imageUrl = productImageUrlHidden.value;
    if (imageFile) {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
    }

    const data = { name, description, price, isVisible, imageUrl };

    if (id) {
        await updateDoc(doc(db, "products", id), data);
    } else {
        await addDoc(collection(db, "products"), data);
    }
    resetProductForm();
}

function editProduct(product) {
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-description').value = product.description;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-is-visible').checked = product.isVisible;
    productImageUrlHidden.value = product.imageUrl || '';
    if (product.imageUrl) {
        imagePreview.src = product.imageUrl;
        imagePreview.classList.remove('hidden');
    } else {
        imagePreview.classList.add('hidden');
    }
    document.getElementById('cancel-edit-button').classList.remove('hidden');
    window.scrollTo(0, 0);
}

function resetProductForm() {
    productForm.reset();
    document.getElementById('product-id').value = '';
    productImageUrlHidden.value = '';
    imagePreview.classList.add('hidden');
    imagePreview.src = '';
    document.getElementById('cancel-edit-button').classList.add('hidden');
}

async function duplicateProduct(product) {
    const newProductData = { ...product };
    delete newProductData.id;
    newProductData.name = `${product.name} (コピー)`;
    newProductData.isVisible = false;

    try {
        await addDoc(collection(db, "products"), newProductData);
        alert('商品を複製しました。');
    } catch (error) {
        console.error("商品の複製に失敗: ", error);
        alert('商品の複製に失敗しました。');
    }
}

async function deleteProduct(product) {
    await deleteDoc(doc(db, "products", product.id));
    if (product.imageUrl && product.imageUrl.includes('firebasestorage')) {
        const imageRef = ref(storage, product.imageUrl);
        await deleteObject(imageRef).catch(error => console.error("画像の削除に失敗:", error));
    }
}

// --- 受注管理機能 ---
const ordersTableBody = document.getElementById('orders-table-body');
let allOrders = [];

function loadOrders() {
    const q = query(collection(db, "orders"), orderBy("orderDate", "desc"));
    onSnapshot(q, (snapshot) => {
        ordersTableBody.innerHTML = '';
        allOrders = [];
        snapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            allOrders.push(order);
            const tr = document.createElement('tr');

            // ★変更点: ステータスに応じて背景色を設定
            let statusBgClass = 'bg-white';
            if (order.status === '対応済') {
                statusBgClass = 'bg-blue-50';
            } else if (order.status === 'キャンセル') {
                statusBgClass = 'bg-red-50';
            }
            tr.className = `${statusBgClass} border-b`;

            tr.innerHTML = `
                <td class="px-6 py-4">${order.orderNumber || 'N/A'}</td>
                <td class="px-6 py-4">${new Date(order.orderDate.seconds * 1000).toLocaleString()}</td>
                <td class="px-6 py-4">${order.customerName}</td>
                <td class="px-6 py-4">${order.totalPrice}円</td>
                <td class="px-6 py-4">
                    <select class="status-select border rounded p-1 bg-white" data-id="${order.id}">
                        <option value="未対応" ${order.status === '未対応' ? 'selected' : ''}>未対応</option>
                        <option value="対応済" ${order.status === '対応済' ? 'selected' : ''}>対応済</option>
                        <option value="キャンセル" ${order.status === 'キャンセル' ? 'selected' : ''}>キャンセル</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    <button class="view-order-btn text-blue-600 hover:underline">詳細</button>
                </td>
            `;
            tr.querySelector('.status-select').addEventListener('change', (e) => updateOrderStatus(e.target.dataset.id, e.target.value));
            tr.querySelector('.view-order-btn').addEventListener('click', () => showOrderDetails(order));
            ordersTableBody.appendChild(tr);
        });
    });
}

async function updateOrderStatus(id, status) {
    await updateDoc(doc(db, "orders", id), { status });
}

function showOrderDetails(order) {
    const modalContent = document.getElementById('modal-content');
    const itemsHtml = order.items.map(item => `<li>${item.name} x ${item.quantity} (${item.price * item.quantity}円)</li>`).join('');
    modalContent.innerHTML = `
        <div class="space-y-4">
            <p><strong>注文番号:</strong> ${order.orderNumber || 'N/A'}</p>
            <p><strong>注文日時:</strong> ${new Date(order.orderDate.seconds * 1000).toLocaleString()}</p>
            <hr>
            <p><strong>お名前:</strong> ${order.customerName}</p>
            <p><strong>ご住所:</strong> ${order.customerAddress}</p>
            <p><strong>電話番号:</strong> ${order.customerPhone}</p>
            <p><strong>メールアドレス:</strong> ${order.customerEmail}</p>
            <hr>
            <p><strong>配送希望日:</strong> ${order.deliveryDate}</p>
            <p><strong>食事タイミング:</strong> ${order.mealType}</p>
            <p><strong>支払い方法:</strong> ${order.paymentMethod}</p>
            <p><strong>提供スタイル:</strong> ${order.servingStyles.join(', ') || '指定なし'}</p>
            <hr>
            <div><strong>注文商品:</strong><ul class="list-disc list-inside">${itemsHtml}</ul></div>
            <p><strong>合計金額:</strong> ${order.totalPrice}円</p>
            <hr>
            <p><strong>備考:</strong> ${order.remarks || 'なし'}</p>
        </div>
    `;
    document.getElementById('order-details-modal').classList.remove('hidden');
}

function exportOrdersToCSV() {
    const encoding = document.getElementById('csv-encoding-select').value;
    let csvContent = "";
    const headers = ["注文番号", "注文日時", "お客様名", "住所", "電話番号", "メールアドレス", "合計金額", "ステータス", "注文内容", "備考"];
    csvContent += headers.join(",") + "\r\n";
    allOrders.forEach(order => {
        const orderDate = new Date(order.orderDate.seconds * 1000).toLocaleString();
        const items = order.items.map(i => `${i.name}(${i.quantity})`).join(' | ');
        const row = [
            order.orderNumber, `"${orderDate}"`, `"${order.customerName}"`, `"${order.customerAddress}"`, `"${order.customerPhone}"`, `"${order.customerEmail}"`,
            order.totalPrice, order.status, `"${items}"`, `"${(order.remarks || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\r\n";
    });

    const link = document.createElement("a");
    link.setAttribute("download", "orders.csv");

    if (encoding === 'sjis') {
        const sjisArray = Encoding.convert(csvContent, { to: 'SJIS', from: 'UNICODE', type: 'array' });
        const blob = new Blob([new Uint8Array(sjisArray)], { type: 'text/csv;charset=shift_jis;' });
        link.href = URL.createObjectURL(blob);
    } else {
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        link.href = URL.createObjectURL(blob);
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 各種設定機能 ---
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
    const docRef = doc(db, "settings", "storeInfo");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('from-email').value = data.fromEmail || '';
        document.getElementById('admin-email').value = data.adminEmail || '';
    }
}

async function saveEmailSettings() {
    const fromEmail = document.getElementById('from-email').value;
    const adminEmail = document.getElementById('admin-email').value;
    const docRef = doc(db, "settings", "storeInfo");
    await setDoc(docRef, { fromEmail, adminEmail }, { merge: true });
    alert('メール設定を保存しました。');
}