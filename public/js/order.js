import { db, functions } from './firebase-init.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

const productList = document.getElementById('product-list');
const orderItemsDiv = document.getElementById('order-items');
const totalPriceSpan = document.getElementById('total-price');
const submitOrderButton = document.getElementById('submit-order-button');
const formErrorMessage = document.getElementById('form-error-message');
const successModal = document.getElementById('success-modal');
const orderForm = document.getElementById('bento-order-form');
const servingStyleOptionsDiv = document.getElementById('serving-style-options');
const paymentMethodSelect = document.getElementById('payment-method');
const deliveryDateInput = document.getElementById('delivery-date');
const deliveryAreaText = document.getElementById('delivery-area-text');
const deliveryDateRuleText = document.getElementById('delivery-date-rule');
const isCareUserCheckbox = document.getElementById('is-care-user-checkbox');

let products = [];

// 商品リストを描画する関数
function renderProductList() {
    productList.innerHTML = '';
    const isCareUser = isCareUserCheckbox.checked;

    products.forEach(product => {
        // ★変更点: discountPriceが存在しない場合にpriceを代替使用する
        const effectiveDiscountPrice = (typeof product.discountPrice === 'number') ? product.discountPrice : product.price;
        const price = isCareUser ? effectiveDiscountPrice : product.price;
        const priceLabel = isCareUser ? '介護保険適用価格' : '通常価格';
        
        const productCard = `
            <div class="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
                <img src="${product.imageUrl || 'https://placehold.co/400x250/cccccc/FFFFFF?text=画像なし'}" alt="${product.name}" class="w-full h-48 object-cover">
                <div class="p-4 flex flex-col flex-grow">
                    <h3 class="text-xl font-bold">${product.name}</h3>
                    <p class="text-gray-600 my-2 flex-grow">${product.description}</p>
                    <p class="text-lg font-semibold text-green-600">
                        <span class="text-sm font-normal text-gray-500">${priceLabel}</span> ${price}円
                    </p>
                    <div class="mt-4 flex items-center">
                        <label class="mr-2">数量:</label>
                        <input type="number" id="quantity-${product.id}" class="w-20 p-1 border rounded" value="0" min="0" data-product-id="${product.id}">
                    </div>
                </div>
            </div>
        `;
        productList.innerHTML += productCard;
    });

    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('change', updateOrderSummary);
    });
}


async function loadPublicData() {
    try {
        const getPublicData = httpsCallable(functions, 'getPublicData');
        const result = await getPublicData();
        const data = result.data;

        products = data.products || [];
        renderProductList(); 

        servingStyleOptionsDiv.innerHTML = '';
        (data.servingStyles || []).forEach(style => {
            servingStyleOptionsDiv.innerHTML += `
                <label class="flex items-center">
                    <input type="checkbox" class="form-checkbox" name="serving-style" value="${style.name}">
                    <span class="ml-2">${style.name}</span>
                </label>
            `;
        });

        paymentMethodSelect.innerHTML = '';
        (data.paymentMethods || []).forEach(method => {
            paymentMethodSelect.innerHTML += `<option value="${method.name}">${method.name}</option>`;
        });

        deliveryAreaText.textContent = (data.storeInfo || {}).deliveryAreaText || '配達エリア情報は店舗にご確認ください。';

    } catch (error) {
        console.error("公開データの読み込みエラー: ", error);
        productList.innerHTML = `<p class="text-red-500 col-span-full">データの読み込みに失敗しました。時間をおいて再度お試しください。</p>`;
    }
}

// 合計金額の計算ロジックを更新
function updateOrderSummary() {
    let total = 0;
    orderItemsDiv.innerHTML = '';
    let hasItem = false;
    const isCareUser = isCareUserCheckbox.checked;

    document.querySelectorAll('input[type="number"]').forEach(input => {
        const quantity = parseInt(input.value);
        if (quantity > 0) {
            hasItem = true;
            const productId = input.dataset.productId;
            const product = products.find(p => p.id === productId);
            if (product) {
                // ★変更点: discountPriceが存在しない場合にpriceを代替使用する
                const effectiveDiscountPrice = (typeof product.discountPrice === 'number') ? product.discountPrice : product.price;
                const price = isCareUser ? effectiveDiscountPrice : product.price;
                total += price * quantity;
                const orderItem = document.createElement('p');
                orderItem.textContent = `${product.name} x ${quantity}`;
                orderItemsDiv.appendChild(orderItem);
            }
        }
    });
    if (!hasItem) {
        orderItemsDiv.innerHTML = '<p class="text-gray-500">メニューから商品を選択してください。</p>';
    }
    totalPriceSpan.textContent = total;
}

function setDeliveryDateRule() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let deliveryStartDate = new Date(today);
    if (now.getHours() >= 15) {
        deliveryStartDate.setDate(today.getDate() + 2);
        deliveryDateRuleText.textContent = `ただいまの時間、最短のお届けは${deliveryStartDate.getMonth()+1}月${deliveryStartDate.getDate()}日です。`;
    } else {
        deliveryStartDate.setDate(today.getDate() + 1);
        deliveryDateRuleText.textContent = `15時までのご注文で、最短翌日(${deliveryStartDate.getMonth()+1}月${deliveryStartDate.getDate()}日)にお届け可能です。`;
    }
    const year = deliveryStartDate.getFullYear();
    const month = String(deliveryStartDate.getMonth() + 1).padStart(2, '0');
    const day = String(deliveryStartDate.getDate()).padStart(2, '0');
    deliveryDateInput.min = `${year}-${month}-${day}`;
}

function validateForm(data) {
    const errors = [];
    if (!data.customerName || !data.customerAddress || !data.customerPhone || !data.customerEmail || !data.deliveryDate || data.items.length === 0) {
        errors.push('お名前、ご住所、電話番号、メールアドレス、配送希望日は必須です。また、商品は1つ以上選択してください。');
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (data.customerEmail && !emailRegex.test(data.customerEmail)) {
        errors.push('有効なメールアドレスの形式ではありません。');
    }
    const phoneRaw = (data.customerPhone || '').replace(/-/g, "");
    const phoneRegex = /^(0[5789]0\d{8}|0\d{1,4}\d{1,4}\d{4})$/;
    if (data.customerPhone && !phoneRegex.test(phoneRaw)) {
         errors.push('有効な日本の電話番号（市外局番、携帯番号）を入力してください。');
    }
    return errors;
}

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formErrorMessage.textContent = '';
    submitOrderButton.disabled = true;
    submitOrderButton.textContent = '送信中...';

    const customerName = document.getElementById('customer-name').value;
    const customerAddress = document.getElementById('customer-address').value;
    const customerPhone = document.getElementById('customer-phone').value;
    const customerEmail = document.getElementById('customer-email').value;
    const deliveryDate = document.getElementById('delivery-date').value;
    const mealType = document.getElementById('meal-type').value;
    const paymentMethod = document.getElementById('payment-method').value;
    const remarks = document.getElementById('remarks').value;
    const isCareUser = isCareUserCheckbox.checked;

    const orderedItems = [];
    let totalPrice = 0;
    document.querySelectorAll('input[type="number"]').forEach(input => {
        const quantity = parseInt(input.value);
        if (quantity > 0) {
            const productId = input.dataset.productId;
            const product = products.find(p => p.id === productId);
            
            // ★変更点: discountPriceが存在しない場合にpriceを代替使用する
            const effectiveDiscountPrice = (typeof product.discountPrice === 'number') ? product.discountPrice : product.price;
            const price = isCareUser ? effectiveDiscountPrice : product.price;
            orderedItems.push({ 
                productId: product.id, 
                name: product.name, 
                quantity: quantity, 
                price: price 
            });
            totalPrice += price * quantity;
        }
    });

    const selectedServingStyles = [];
    document.querySelectorAll('input[name="serving-style"]:checked').forEach(checkbox => {
        selectedServingStyles.push(checkbox.value);
    });

    const orderDataForValidation = { customerName, customerAddress, customerPhone, customerEmail, deliveryDate, items: orderedItems };
    const validationErrors = validateForm(orderDataForValidation);
    if (validationErrors.length > 0) {
        formErrorMessage.innerHTML = validationErrors.join('<br>');
        submitOrderButton.disabled = false;
        submitOrderButton.textContent = 'この内容で注文する';
        return;
    }

    const orderData = {
        customerName, customerAddress, customerPhone, customerEmail,
        deliveryDate, mealType, paymentMethod, remarks,
        items: orderedItems,
        servingStyles: selectedServingStyles,
        totalPrice,
        orderDate: serverTimestamp(),
        status: '未対応',
        isCareUser: isCareUser 
    };

    try {
        await addDoc(collection(db, "orders"), orderData);
        successModal.style.display = 'flex';
    } catch (e) {
        console.error("注文の保存中にエラーが発生しました: ", e);
        formErrorMessage.textContent = '注文の送信に失敗しました。時間をおいて再度お試しください。';
        submitOrderButton.disabled = false;
        submitOrderButton.textContent = 'この内容で注文する';
    }
});

isCareUserCheckbox.addEventListener('change', () => {
    renderProductList();
    updateOrderSummary();
});


document.addEventListener('DOMContentLoaded', () => {
    loadPublicData();
    setDeliveryDateRule();
    updateOrderSummary();
});