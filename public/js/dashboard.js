import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
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
const functions = getFunctions(app, 'asia-northeast1');

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
    document.getElementById('filter-status').addEventListener('change', loadOrders);
    document.getElementById('filter-start-date').addEventListener('change', loadOrders);
    document.getElementById('filter-end-date').addEventListener('change', loadOrders);
    document.getElementById('filter-reset-button').addEventListener('click', () => {
        document.getElementById('filter-status').value = '未対応';
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        loadOrders();
    });
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => handleSort(header));
    });
    document.getElementById('csv-export-button').addEventListener('click', exportOrdersToCSV);
    document.getElementById('close-modal-button').addEventListener('click', () => document.getElementById('order-details-modal').classList.add('hidden'));
    loadOrders();

    // オプション設定
    loadAndRenderOptions('servingStyles', 'serving-styles-list');
    loadAndRenderOptions('paymentMethods', 'payment-methods-list');
    document.getElementById('add-serving-style-button').addEventListener('click', () => addOption('servingStyles', 'new-serving-style'));
    document.getElementById('add-payment-method-button').addEventListener('click', () => addOption('paymentMethods', 'new-payment-method'));

    // メール設定
    loadEmailSettings();
    document.getElementById('save-email-settings-button').addEventListener('click', saveEmailSettings);

    // プレースホルダーの表示とコピー機能
    renderPlaceholders();
}

// --- ログアウト処理 ---
function onLogout() {
    signOut(auth).catch(error => console.error('ログアウトエラー', error));
}

// --- ヘルパー関数: 安全なDOM要素を作成 ---
function createSafeElement(tag, classes = [], textContent = '') {
    const el = document.createElement(tag);
    if (classes.length > 0) el.className = classes.join(' ');
    el.textContent = textContent;
    return el;
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
            const div = createSafeElement('div', ['flex', 'justify-between', 'items-center', 'p-2', 'border', 'rounded']);

            const infoSpan = createSafeElement('span', [], `${product.name} (${product.price}円) - ${product.isVisible ? '表示中' : '非表示'}`);

            const buttonsDiv = createSafeElement('div', ['flex', 'gap-2']);
            const duplicateBtn = createSafeElement('button', ['duplicate-product-btn', 'bg-blue-500', 'text-white', 'px-3', 'py-1', 'rounded', 'text-sm'], '複製');
            const editBtn = createSafeElement('button', ['edit-product-btn', 'bg-yellow-500', 'text-white', 'px-3', 'py-1', 'rounded', 'text-sm'], '編集');
            const deleteBtn = createSafeElement('button', ['delete-product-btn', 'bg-red-500', 'text-white', 'px-3', 'py-1', 'rounded', 'text-sm'], '削除');

            duplicateBtn.addEventListener('click', () => duplicateProduct(product));
            editBtn.addEventListener('click', () => editProduct(product));
            deleteBtn.addEventListener('click', () => deleteProduct(product));

            buttonsDiv.append(duplicateBtn, editBtn, deleteBtn);
            div.append(infoSpan, buttonsDiv);
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
let currentSort = { key: 'orderDate', direction: 'desc' };
let displayedOrders = [];

async function loadOrders() {
    const status = document.getElementById('filter-status').value;
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    let constraints = [];
    if (status !== 'all') {
        constraints.push(where("status", "==", status));
    }
    if (startDate) {
        constraints.push(where("orderDate", ">=", Timestamp.fromDate(new Date(startDate))));
    }
    if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        constraints.push(where("orderDate", "<=", Timestamp.fromDate(endOfDay)));
    }

    constraints.push(orderBy(currentSort.key, currentSort.direction));

    const q = query(collection(db, "orders"), ...constraints);

    onSnapshot(q, (snapshot) => {
        ordersTableBody.innerHTML = '';
        displayedOrders = [];
        snapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            displayedOrders.push(order);
            const tr = document.createElement('tr');

            let statusBgClass = 'bg-white';
            if (order.status === '対応済') statusBgClass = 'bg-blue-50';
            else if (order.status === 'キャンセル') statusBgClass = 'bg-red-50';
            tr.className = `${statusBgClass} border-b`;

            // セルを個別作成
            const tdOrderNumber = createSafeElement('td', ['px-6', 'py-4'], order.orderNumber || 'N/A');
            const tdOrderDate = createSafeElement('td', ['px-6', 'py-4'], new Date(order.orderDate.seconds * 1000).toLocaleString());
            const tdCustomerName = createSafeElement('td', ['px-6', 'py-4'], order.customerName);
            const tdTotalPrice = createSafeElement('td', ['px-6', 'py-4'], `${order.totalPrice}円`);

            // ステータス選択
            const tdStatus = createSafeElement('td', ['px-6', 'py-4']);
            const selectStatus = document.createElement('select');
            selectStatus.className = 'status-select border rounded p-1 bg-white';
            selectStatus.dataset.id = order.id;
            selectStatus.innerHTML = `
                <option value="未対応" ${order.status === '未対応' ? 'selected' : ''}>未対応</option>
                <option value="対応済" ${order.status === '対応済' ? 'selected' : ''}>対応済</option>
                <option value="キャンセル" ${order.status === 'キャンセル' ? 'selected' : ''}>キャンセル</option>
            `;
            selectStatus.addEventListener('change', (e) => updateOrderStatus(e.target.dataset.id, e.target.value));
            tdStatus.appendChild(selectStatus);

            // 操作ボタン
            const tdActions = createSafeElement('td', ['px-6', 'py-4']);
            const viewBtn = createSafeElement('button', ['view-order-btn', 'text-blue-600', 'hover:underline'], '詳細');
            viewBtn.addEventListener('click', () => showOrderDetails(order));
            tdActions.appendChild(viewBtn);

            tr.append(tdOrderNumber, tdOrderDate, tdCustomerName, tdTotalPrice, tdStatus, tdActions);
            ordersTableBody.appendChild(tr);
        });
        updateSortHeaders();
    }, (error) => {
        console.error("注文の読み込みエラー:", error);
        ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500">注文の読み込みに失敗しました。インデックスが作成されているか確認してください。</td></tr>`;
    });
}

function handleSort(header) {
    const sortKey = header.dataset.sortKey;
    if (currentSort.key === sortKey) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = sortKey;
        currentSort.direction = 'desc';
    }
    loadOrders();
}

function updateSortHeaders() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.classList.remove('active');
        header.querySelector('span').textContent = '';
    });
    const activeHeader = document.querySelector(`.sortable-header[data-sort-key="${currentSort.key}"]`);
    if (activeHeader) {
        activeHeader.classList.add('active');
        activeHeader.querySelector('span').textContent = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    }
}

async function updateOrderStatus(id, status) {
    await updateDoc(doc(db, "orders", id), { status });
}

function showOrderDetails(order) {
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = ''; // コンテンツをクリア

    const contentDiv = createSafeElement('div', ['space-y-4']);

    const createDetailRow = (label, value) => {
        const p = createSafeElement('p');
        const strong = createSafeElement('strong', [], `${label}: `);
        p.appendChild(strong);
        p.append(value); // textContentではなくappendでテキストノードを追加
        return p;
    };

    contentDiv.appendChild(createDetailRow('注文番号', order.orderNumber || 'N/A'));
    contentDiv.appendChild(createDetailRow('注文日時', new Date(order.orderDate.seconds * 1000).toLocaleString()));
    contentDiv.appendChild(document.createElement('hr'));
    contentDiv.appendChild(createDetailRow('お名前', order.customerName));
    contentDiv.appendChild(createDetailRow('ご住所', order.customerAddress));
    contentDiv.appendChild(createDetailRow('電話番号', order.customerPhone));
    contentDiv.appendChild(createDetailRow('メールアドレス', order.customerEmail));
    contentDiv.appendChild(document.createElement('hr'));
    contentDiv.appendChild(createDetailRow('配送希望日', order.deliveryDate));
    contentDiv.appendChild(createDetailRow('食事タイミング', order.mealType));
    contentDiv.appendChild(createDetailRow('支払い方法', order.paymentMethod));
    contentDiv.appendChild(createDetailRow('提供スタイル', order.servingStyles.join(', ') || '指定なし'));
    contentDiv.appendChild(document.createElement('hr'));

    const itemsDiv = createSafeElement('div');
    const itemsStrong = createSafeElement('strong', [], '注文商品:');
    const itemsUl = createSafeElement('ul', ['list-disc', 'list-inside']);
    order.items.forEach(item => {
        const li = createSafeElement('li', [], `${item.name} x ${item.quantity} (${item.price * item.quantity}円)`);
        itemsUl.appendChild(li);
    });
    itemsDiv.append(itemsStrong, itemsUl);
    contentDiv.appendChild(itemsDiv);

    contentDiv.appendChild(createDetailRow('合計金額', `${order.totalPrice}円`));
    contentDiv.appendChild(document.createElement('hr'));
    contentDiv.appendChild(createDetailRow('備考', order.remarks || 'なし'));

    modalContent.appendChild(contentDiv);
    document.getElementById('order-details-modal').classList.remove('hidden');
}

function exportOrdersToCSV() {
    const encoding = document.getElementById('csv-encoding-select').value;
    let csvContent = "";
    const headers = ["注文番号", "注文日時", "お客様名", "住所", "電話番号", "メールアドレス", "合計金額", "ステータス", "注文内容", "食事タイミング", "提供スタイル", "支払い方法", "備考"];
    csvContent += headers.join(",") + "\r\n";
    displayedOrders.forEach(order => {
        const orderDate = new Date(order.orderDate.seconds * 1000).toLocaleString();
        const items = order.items.map(i => `${i.name}(${i.quantity})`).join(' | ');
        const servingStyles = (order.servingStyles || []).join(' | ');
        const row = [
            order.orderNumber || '',
            `"${orderDate}"`,
            `"${order.customerName || ''}"`,
            `"${order.customerAddress || ''}"`,
            `"${order.customerPhone || ''}"`,
            `"${order.customerEmail || ''}"`,
            order.totalPrice || 0,
            order.status || '',
            `"${items}"`,
            `"${(order.remarks || '').replace(/"/g, '""')}"`,
            `"${order.mealType || ''}"`,
            `"${servingStyles}"`,
            `"${order.paymentMethod || ''}"`
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
            const div = createSafeElement('div', ['flex', 'justify-between', 'items-center', 'p-2', 'border-b']);
            const span = createSafeElement('span', [], item.name);
            const button = createSafeElement('button', ['delete-option-btn', 'text-red-500', 'text-xl'], '×');
            button.addEventListener('click', () => deleteOption(collectionName, item.id));
            div.append(span, button);
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