import { collection, onSnapshot, doc, getDocs, addDoc, updateDoc, query, orderBy, where, Timestamp, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { db, functions } from '../firebase-init.js';

// 既存のDOM要素
const ordersTableBody = document.getElementById('orders-table-body');
let currentSort = { key: 'orderDate', direction: 'desc' };
let displayedOrders = [];

// ★★★★★ ここからが新規追加 ★★★★★
// 新規作成・編集モーダル関連のDOM要素
const orderEditModal = document.getElementById('order-edit-modal');
const orderEditForm = document.getElementById('order-edit-form');
const orderEditModalTitle = document.getElementById('order-edit-modal-title');
const editOrderId = document.getElementById('edit-order-id');
const editOrderDateOriginal = document.getElementById('edit-order-date-original');

// 日時変更確認モーダル
const dateConfirmModal = document.getElementById('date-confirm-modal');
let resolveDateConfirmation;

// フォームで使うデータを保持する変数
let allProducts = [];
let allServingStyles = [];
let allPaymentMethods = [];
// ★★★★★ ここまでが新規追加 ★★★★★


/**
 * 受注管理タブを初期化する
 */
export function initOrders() {
    // 既存のイベントリスナー
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
    
    // ★★★★★ ここからが新規追加 ★★★★★
    // 新規注文作成ボタンのイベントリスナー
    document.getElementById('create-new-order-btn').addEventListener('click', () => openOrderEditModal());

    // 編集モーダルのイベントリスナー
    document.getElementById('close-order-edit-modal-btn').addEventListener('click', () => orderEditModal.classList.add('hidden'));
    orderEditForm.addEventListener('submit', handleOrderFormSubmit);
    document.getElementById('add-item-btn').addEventListener('click', () => addItemToModal());

    // 日時変更確認モーダルのイベントリスナー
    document.getElementById('date-confirm-cancel').addEventListener('click', () => {
        dateConfirmModal.classList.add('hidden');
        if (resolveDateConfirmation) resolveDateConfirmation(false);
    });
    document.getElementById('date-confirm-ok').addEventListener('click', () => {
        dateConfirmModal.classList.add('hidden');
        if (resolveDateConfirmation) resolveDateConfirmation(true);
    });
    
    // フォームに必要なデータを事前に読み込む
    loadPrerequisites();
    // ★★★★★ ここまでが新規追加 ★★★★★

    loadOrders();
}

// ★★★★★ ここからが新規追加 ★★★★★
/**
 * 注文フォームに必要な商品リストやオプションを事前に読み込む
 */
async function loadPrerequisites() {
    const productsSnapshot = await getDocs(query(collection(db, "products"), orderBy("name")));
    allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const servingStylesSnapshot = await getDocs(query(collection(db, "servingStyles"), orderBy("name")));
    allServingStyles = servingStylesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const paymentMethodsSnapshot = await getDocs(query(collection(db, "paymentMethods"), orderBy("name")));
    allPaymentMethods = paymentMethodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
// ★★★★★ ここまでが新規追加 ★★★★★

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
            const careUserHtml = order.isCareUser ? '<td class="px-6 py-4 font-bold text-green-600">◯</td>' : '<td class="px-6 py-4"></td>';

            tr.innerHTML = `
                <td class="px-6 py-4">${order.orderNumber || 'N/A'}</td>
                <td class="px-6 py-4">${new Date(order.orderDate.seconds * 1000).toLocaleString()}</td>
                <td class="px-6 py-4">${order.customerName}</td>
                ${careUserHtml} 
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
                    <!-- ★変更点: 編集ボタンを追加 -->
                    <button class="edit-order-btn text-yellow-600 hover:underline ml-2">編集</button>
                    <button class="send-complete-email-btn bg-green-500 text-white px-2 py-1 rounded text-xs ml-2 disabled:bg-gray-400 disabled:cursor-not-allowed" 
                            data-id="${order.id}" 
                            ${order.status !== '対応済' || order.completionEmailSent ? 'disabled' : ''}>
                        ${order.completionEmailSent ? '送信済' : '完了メール'}
                    </button>
                </td>
            `;
            tr.querySelector('.status-select').addEventListener('change', (e) => updateOrderStatus(e.target.dataset.id, e.target.value));
            tr.querySelector('.view-order-btn').addEventListener('click', () => showOrderDetails(order));
            // ★追加: 編集ボタンのイベントリスナー
            tr.querySelector('.edit-order-btn').addEventListener('click', () => openOrderEditModal(order));
            tr.querySelector('.send-complete-email-btn').addEventListener('click', (e) => handleSendCompletionEmail(e.target));
            ordersTableBody.appendChild(tr);
        });
        updateSortHeaders();
    }, (error) => {
        console.error("注文の読み込みエラー:", error);
        ordersTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">注文の読み込みに失敗しました。Firestoreのインデックスが正しく作成されているか確認してください。</td></tr>`;
    });
}

// (handleSort, updateSortHeaders, updateOrderStatus, showOrderDetails, exportOrdersToCSV, handleSendCompletionEmail は変更なしのため省略)
// ... 既存の関数 ...
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
    const itemsHtml = order.items.map(item => `<li>${item.name} x ${item.quantity} (${item.price * item.quantity}円)</li>`).join('');
    const careUserText = order.isCareUser ? '<span class="font-bold text-green-600">はい</span>' : 'いいえ';
    modalContent.innerHTML = `
        <div class="space-y-4">
            <p><strong>注文番号:</strong> ${order.orderNumber || 'N/A'}</p>
            <p><strong>注文日時:</strong> ${new Date(order.orderDate.seconds * 1000).toLocaleString()}</p>
            <hr>
            <p><strong>お名前:</strong> ${order.customerName}</p>
            <p><strong>ご住所:</strong> ${order.customerAddress}</p>
            <p><strong>電話番号:</strong> ${order.customerPhone}</p>
            <p><strong>メールアドレス:</strong> ${order.customerEmail}</p>
            <p><strong>介護保険利用者:</strong> ${careUserText}</p>
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
    const headers = ["注文番号", "注文日時", "お客様名", "住所", "電話番号", "メールアドレス", "介護保険", "合計金額", "ステータス", "注文内容", "食事タイミング", "提供スタイル", "支払い方法", "備考"];
    csvContent += headers.join(",") + "\r\n";
    displayedOrders.forEach(order => {
        const orderDate = new Date(order.orderDate.seconds * 1000).toLocaleString();
        const items = order.items.map(i => `${i.name}(${i.quantity})`).join(' | ');
        const servingStyles = (order.servingStyles || []).join(' | ');
        const isCareUser = order.isCareUser ? 'はい' : 'いいえ';
        const row = [
            order.orderNumber || '', `"${orderDate}"`, `"${order.customerName || ''}"`, `"${order.customerAddress || ''}"`,
            `"${order.customerPhone || ''}"`, `"${order.customerEmail || ''}"`, `"${isCareUser}"`, order.totalPrice || 0, order.status || '',
            `"${items}"`, `"${(order.remarks || '').replace(/"/g, '""')}"`, `"${order.mealType || ''}"`,
            `"${servingStyles}"`, `"${order.paymentMethod || ''}"`
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

async function handleSendCompletionEmail(button) {
    const orderId = button.dataset.id;
    if (!orderId) return;

    button.disabled = true;
    button.textContent = '送信中...';

    try {
        const sendEmail = httpsCallable(functions, 'sendCompletionEmail');
        await sendEmail({ orderId });
        alert('受付完了メールを送信しました。');
    } catch (error) {
        console.error("メール送信エラー:", error);
        alert(`メールの送信に失敗しました: ${error.message}`);
    }
}


// ★★★★★ ここからが新規追加 ★★★★★
/**
 * 新規作成・編集モーダルを開く
 * @param {object | null} order - 編集する注文データ。新規作成の場合はnull
 */
function openOrderEditModal(order = null) {
    orderEditForm.reset();
    
    // オプションのセレクトボックスを生成
    const mealTypeSelect = document.getElementById('edit-meal-type');
    mealTypeSelect.innerHTML = `
        <option value="昼食のみ">昼食のみ</option>
        <option value="夕食のみ">夕食のみ</option>
        <option value="昼と夕両方">昼と夕両方</option>
    `;
    const paymentMethodSelect = document.getElementById('edit-payment-method');
    paymentMethodSelect.innerHTML = allPaymentMethods.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    const statusSelect = document.getElementById('edit-status');
    statusSelect.innerHTML = `
        <option value="未対応">未対応</option>
        <option value="対応済">対応済</option>
        <option value="キャンセル">キャンセル</option>
    `;

    const servingStylesContainer = document.getElementById('edit-serving-styles-container');
    servingStylesContainer.innerHTML = allServingStyles.map(s => `
        <label class="flex items-center">
            <input type="checkbox" class="form-checkbox" name="edit-serving-style" value="${s.name}">
            <span class="ml-2 text-sm">${s.name}</span>
        </label>
    `).join('');

    if (order) {
        // --- 編集モード ---
        orderEditModalTitle.textContent = '注文内容の編集';
        editOrderId.value = order.id;
        
        // 注文日時をISO形式に変換してセット
        const orderDate = new Date(order.orderDate.seconds * 1000);
        const yyyy = orderDate.getFullYear();
        const mm = String(orderDate.getMonth() + 1).padStart(2, '0');
        const dd = String(orderDate.getDate()).padStart(2, '0');
        const hh = String(orderDate.getHours()).padStart(2, '0');
        const mi = String(orderDate.getMinutes()).padStart(2, '0');
        const isoString = `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
        document.getElementById('edit-order-date').value = isoString;
        editOrderDateOriginal.value = isoString;

        // 他のフィールドをセット
        document.getElementById('edit-customer-name').value = order.customerName;
        document.getElementById('edit-customer-address').value = order.customerAddress;
        document.getElementById('edit-customer-phone').value = order.customerPhone;
        document.getElementById('edit-customer-email').value = order.customerEmail;
        document.getElementById('edit-is-care-user').checked = order.isCareUser || false;
        document.getElementById('edit-delivery-date').value = order.deliveryDate;
        mealTypeSelect.value = order.mealType;
        paymentMethodSelect.value = order.paymentMethod;
        statusSelect.value = order.status;
        document.getElementById('edit-remarks').value = order.remarks || '';

        // 提供スタイル
        (order.servingStyles || []).forEach(styleName => {
            const checkbox = servingStylesContainer.querySelector(`input[value="${styleName}"]`);
            if (checkbox) checkbox.checked = true;
        });

        renderItemsInModal(order.items);
        
    } else {
        // --- 新規作成モード ---
        orderEditModalTitle.textContent = '新規注文作成';
        editOrderId.value = '';
        editOrderDateOriginal.value = '';
        renderItemsInModal([]);
        addItemToModal(); // 最初の商品入力欄を追加
    }
    
    updateModalTotal();
    orderEditModal.classList.remove('hidden');
}

/**
 * モーダル内の商品リストを描画する
 * @param {Array} items - 注文商品データの配列
 */
function renderItemsInModal(items) {
    const container = document.getElementById('edit-order-items-container');
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = '<p id="no-items-text" class="text-gray-500">商品がありません。「商品を追加」ボタンで追加してください。</p>';
        return;
    }

    items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'grid grid-cols-12 gap-2 items-center';
        
        const productOptions = allProducts.map(p => `<option value="${p.id}" ${p.id === item.productId ? 'selected' : ''}>${p.name}</option>`).join('');

        itemDiv.innerHTML = `
            <select class="col-span-6 p-2 border rounded item-product" required>${productOptions}</select>
            <input type="number" class="col-span-2 p-2 border rounded item-quantity" value="${item.quantity}" min="1" required>
            <input type="number" class="col-span-2 p-2 border rounded item-price" value="${item.price}" required>
            <button type="button" class="col-span-2 remove-item-btn bg-red-500 text-white rounded p-2">削除</button>
        `;
        container.appendChild(itemDiv);
    });

    // イベントリスナーを再設定
    container.querySelectorAll('.item-product, .item-quantity, .item-price').forEach(el => {
        el.addEventListener('change', updateModalTotal);
    });
    container.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.grid').remove();
            updateModalTotal();
        });
    });
}

/**
 * モーダルに商品入力欄を追加する
 */
function addItemToModal() {
    const container = document.getElementById('edit-order-items-container');
    const noItemsText = document.getElementById('no-items-text');
    if (noItemsText) noItemsText.remove();

    const itemDiv = document.createElement('div');
    itemDiv.className = 'grid grid-cols-12 gap-2 items-center';
    
    const productOptions = allProducts.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name}</option>`).join('');

    itemDiv.innerHTML = `
        <select class="col-span-6 p-2 border rounded item-product" required><option value="">商品を選択...</option>${productOptions}</select>
        <input type="number" class="col-span-2 p-2 border rounded item-quantity" value="1" min="1" required>
        <input type="number" class="col-span-2 p-2 border rounded item-price" value="0" required>
        <button type="button" class="col-span-2 remove-item-btn bg-red-500 text-white rounded p-2">削除</button>
    `;
    container.appendChild(itemDiv);

    const newSelect = itemDiv.querySelector('.item-product');
    const newPriceInput = itemDiv.querySelector('.item-price');

    newSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const price = selectedOption.dataset.price;
        newPriceInput.value = price || 0;
        updateModalTotal();
    });

    itemDiv.querySelectorAll('.item-quantity, .item-price').forEach(el => {
        el.addEventListener('change', updateModalTotal);
    });
    itemDiv.querySelector('.remove-item-btn').addEventListener('click', (e) => {
        e.target.closest('.grid').remove();
        updateModalTotal();
    });
}

/**
 * モーダル内の合計金額を更新する
 */
function updateModalTotal() {
    let total = 0;
    document.querySelectorAll('#edit-order-items-container .grid').forEach(itemDiv => {
        const quantity = Number(itemDiv.querySelector('.item-quantity').value) || 0;
        const price = Number(itemDiv.querySelector('.item-price').value) || 0;
        total += quantity * price;
    });
    document.getElementById('edit-total-price').textContent = total;
}

/**
 * 注文フォームの保存処理
 */
async function handleOrderFormSubmit(e) {
    e.preventDefault();
    const id = editOrderId.value;

    // 日時変更の確認
    if (id) { // 編集モードの場合のみ
        const newDate = document.getElementById('edit-order-date').value;
        if (newDate !== editOrderDateOriginal.value) {
            dateConfirmModal.classList.remove('hidden');
            const confirmed = await new Promise(resolve => {
                resolveDateConfirmation = resolve;
            });
            if (!confirmed) return; // キャンセルされたら処理を中断
        }
    }
    
    const items = [];
    document.querySelectorAll('#edit-order-items-container .grid').forEach(itemDiv => {
        const productId = itemDiv.querySelector('.item-product').value;
        const selectedOption = itemDiv.querySelector('.item-product').options[itemDiv.querySelector('.item-product').selectedIndex];
        items.push({
            productId: productId,
            name: selectedOption.text,
            quantity: Number(itemDiv.querySelector('.item-quantity').value),
            price: Number(itemDiv.querySelector('.item-price').value),
        });
    });

    if (items.length === 0) {
        alert('商品を1つ以上追加してください。');
        return;
    }

    const servingStyles = [];
    document.querySelectorAll('input[name="edit-serving-style"]:checked').forEach(cb => {
        servingStyles.push(cb.value);
    });

    const data = {
        customerName: document.getElementById('edit-customer-name').value,
        customerAddress: document.getElementById('edit-customer-address').value,
        customerPhone: document.getElementById('edit-customer-phone').value,
        customerEmail: document.getElementById('edit-customer-email').value,
        isCareUser: document.getElementById('edit-is-care-user').checked,
        deliveryDate: document.getElementById('edit-delivery-date').value,
        orderDate: Timestamp.fromDate(new Date(document.getElementById('edit-order-date').value)),
        mealType: document.getElementById('edit-meal-type').value,
        paymentMethod: document.getElementById('edit-payment-method').value,
        status: document.getElementById('edit-status').value,
        remarks: document.getElementById('edit-remarks').value,
        servingStyles: servingStyles,
        items: items,
        totalPrice: Number(document.getElementById('edit-total-price').textContent),
    };

    try {
        if (id) {
            // 更新
            const orderRef = doc(db, "orders", id);
            await updateDoc(orderRef, data);
            alert('注文を更新しました。');
        } else {
            // 新規作成
            data.orderDate = serverTimestamp(); // 新規作成時はサーバー時刻を使用
            await addDoc(collection(db, "orders"), data);
            alert('新しい注文を作成しました。');
        }
        orderEditModal.classList.add('hidden');
    } catch (error) {
        console.error("注文の保存に失敗しました:", error);
        alert("注文の保存に失敗しました。");
    }
}
// ★★★★★ ここまでが新規追加 ★★★★★
