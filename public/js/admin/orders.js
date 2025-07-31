import { collection, onSnapshot, doc, updateDoc, query, orderBy, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { db, functions } from '../firebase-init.js';

const ordersTableBody = document.getElementById('orders-table-body');
// ★変更点: isCareUserをデフォルトのソートキー候補に追加
let currentSort = { key: 'orderDate', direction: 'desc' };
let displayedOrders = [];

/**
 * 受注管理タブを初期化する
 */
export function initOrders() {
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
}

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
            // ★変更点: isCareUserの表示ロジックを追加
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
                    <button class="send-complete-email-btn bg-green-500 text-white px-2 py-1 rounded text-xs ml-2 disabled:bg-gray-400 disabled:cursor-not-allowed" 
                            data-id="${order.id}" 
                            ${order.status !== '対応済' || order.completionEmailSent ? 'disabled' : ''}>
                        ${order.completionEmailSent ? '送信済' : '完了メール'}
                    </button>
                </td>
            `;
            tr.querySelector('.status-select').addEventListener('change', (e) => updateOrderStatus(e.target.dataset.id, e.target.value));
            tr.querySelector('.view-order-btn').addEventListener('click', () => showOrderDetails(order));
            tr.querySelector('.send-complete-email-btn').addEventListener('click', (e) => handleSendCompletionEmail(e.target));
            ordersTableBody.appendChild(tr);
        });
        updateSortHeaders();
    }, (error) => {
        console.error("注文の読み込みエラー:", error);
        ordersTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">注文の読み込みに失敗しました。Firestoreのインデックスが正しく作成されているか確認してください。</td></tr>`;
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
    const itemsHtml = order.items.map(item => `<li>${item.name} x ${item.quantity} (${item.price * item.quantity}円)</li>`).join('');
    // ★変更点: 介護保険利用者の表示を追加
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
    // ★変更点: ヘッダーに「介護保険」を追加
    const headers = ["注文番号", "注文日時", "お客様名", "住所", "電話番号", "メールアドレス", "介護保険", "合計金額", "ステータス", "注文内容", "食事タイミング", "提供スタイル", "支払い方法", "備考"];
    csvContent += headers.join(",") + "\r\n";
    displayedOrders.forEach(order => {
        const orderDate = new Date(order.orderDate.seconds * 1000).toLocaleString();
        const items = order.items.map(i => `${i.name}(${i.quantity})`).join(' | ');
        const servingStyles = (order.servingStyles || []).join(' | ');
        // ★変更点: 介護保険利用者の情報を追加
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
        // onSnapshotが自動でボタンの状態を更新します
    } catch (error) {
        console.error("メール送信エラー:", error);
        alert(`メールの送信に失敗しました: ${error.message}`);
        // エラー時は再度押せるように、状態を元に戻す
        // onSnapshotが自動で更新するため、ここでは何もしない
    }
}
