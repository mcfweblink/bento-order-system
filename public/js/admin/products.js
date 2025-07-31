import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { db, storage } from '../firebase-init.js';

const productsListAdmin = document.getElementById('products-list-admin');
const productForm = document.getElementById('product-form');
const imagePreview = document.getElementById('image-preview');
const productImageInput = document.getElementById('product-image');
const productImageUrlHidden = document.getElementById('product-image-url-hidden');

/**
 * 商品管理タブを初期化する
 */
export function initProducts() {
    loadProductsAdmin();
    productForm.addEventListener('submit', handleProductSubmit);
    document.getElementById('cancel-edit-button').addEventListener('click', resetProductForm);
    productImageInput.addEventListener('change', previewImage);
}

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
            // ★変更点: 割引価格が未定義の場合でも表示が崩れないようにする
            const discountPriceText = (typeof product.discountPrice === 'number') ? `${product.discountPrice}円` : '未設定';
            div.innerHTML = `
                <span>${product.name} (通常:${product.price}円 / 割引:${discountPriceText}) - ${product.isVisible ? '表示中' : '非表示'}</span>
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
    const discountPrice = Number(document.getElementById('product-discount-price').value);
    const isVisible = document.getElementById('product-is-visible').checked;
    const imageFile = productImageInput.files[0];

    // 割引価格のバリデーション
    if (document.getElementById('product-discount-price').value === '') {
        alert('割引価格は必須項目です。');
        return;
    }


    let imageUrl = productImageUrlHidden.value;
    if (imageFile) {
        if (id && productImageUrlHidden.value) {
            try {
                const oldImageRef = ref(storage, productImageUrlHidden.value);
                await deleteObject(oldImageRef);
            } catch (error) {
                console.error("古い画像の削除に失敗しました:", error);
            }
        }
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
    }

    const data = { name, description, price, discountPrice, isVisible, imageUrl };

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
    // ★変更点: 割引価格が未定義の場合でもエラーにならないようにする
    document.getElementById('product-discount-price').value = product.discountPrice ?? '';
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
    document.getElementById('product-discount-price').value = '';
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
    if (!confirm(`「${product.name}」を本当に削除しますか？`)) {
        return;
    }
    await deleteDoc(doc(db, "products", product.id));
    if (product.imageUrl && product.imageUrl.includes('firebasestorage')) {
        const imageRef = ref(storage, product.imageUrl);
        await deleteObject(imageRef).catch(error => console.error("画像の削除に失敗:", error));
    }
}