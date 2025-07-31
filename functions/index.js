const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin"); // ★★★★★ この一行が欠落していました ★★★★★
const {getFirestore} = require("firebase-admin/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const sgMail = require("@sendgrid/mail");

// 関数のデフォルトリージョンを東京に設定
setGlobalOptions({region: "asia-northeast1"});

admin.initializeApp();
const db = getFirestore();

// SendGridのAPIキーを環境変数（Secret Manager）から取得
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("SendGrid APIキーが設定されていません。メール送信は機能しません。");
}

// --- 共通ヘルパー関数: 変数を置換する ---
const replacePlaceholders = (text = "", orderData = {}) => {
    const itemsList = (orderData.items || []).map((item) => `${item.name} x ${item.quantity}`).join("\n");
    const orderDate = orderData.orderDate ? new Date(orderData.orderDate.seconds * 1000).toLocaleString("ja-JP") : "N/A";
    
    return text
        .replace(/{customerName}/g, orderData.customerName || "")
        .replace(/{orderNumber}/g, orderData.orderNumber || "採番中")
        .replace(/{totalPrice}/g, orderData.totalPrice || 0)
        .replace(/{orderDate}/g, orderDate)
        .replace(/{deliveryDate}/g, orderData.deliveryDate || "")
        .replace(/{customerAddress}/g, orderData.customerAddress || "")
        .replace(/{customerPhone}/g, orderData.customerPhone || "")
        .replace(/{itemsList}/g, itemsList)
        .replace(/{dashboardUrl}/g, `https://console.firebase.google.com/project/${process.env.GCLOUD_PROJECT}/firestore/data/~2Forders~2F${orderData.id || ""}`)
        .replace(/{mealType}/g, orderData.mealType || "")
        .replace(/{servingStyles}/g, (orderData.servingStyles || []).join(", ") || "指定なし")
        .replace(/{paymentMethod}/g, orderData.paymentMethod || "")
        .replace(/{remarks}/g, orderData.remarks || "なし");
};

// --- 注文作成時の処理 ---
exports.onOrderCreate = onDocumentCreated({ document: "orders/{orderId}", secrets: ["SENDGRID_API_KEY"] }, async (event) => {
  const orderId = event.params.orderId;
  const orderData = event.data.data();
  orderData.id = orderId;

  // 1. 注文番号の採番
  const counterRef = db.collection("counters").doc("order_counter");
  let newOrderNumber;
  try {
    await db.runTransaction(async (t) => {
      const counterDoc = await t.get(counterRef);
      if (!counterDoc.exists) {
        newOrderNumber = 201;
        t.set(counterRef, {currentNumber: newOrderNumber});
      } else {
        newOrderNumber = counterDoc.data().currentNumber + 1;
        t.update(counterRef, {currentNumber: newOrderNumber});
      }
    });
    await db.collection("orders").doc(orderId).update({orderNumber: newOrderNumber});
    orderData.orderNumber = newOrderNumber;
  } catch (e) {
    console.error("注文番号の採番に失敗:", e);
    return;
  }

  // 2. メール送信
  if (!SENDGRID_API_KEY) {
    console.error("SendGrid APIキーが未設定です。");
    return;
  }

  const settingsDoc = await db.collection("settings").doc("emailTemplates").get();
  const settings = settingsDoc.data() || {};
  const fromEmail = settings.fromEmail;
  const adminEmail = settings.adminEmail;

  if (!fromEmail || !adminEmail) {
    console.error("送信元または管理者メールアドレスが設定されていません。");
    return;
  }

  const customerSubject = replacePlaceholders(settings.orderConfirmSubject || "ご注文ありがとうございます", orderData);
  const customerBody = replacePlaceholders(settings.orderConfirmBody || "ご注文ありがとうございます。", orderData);
  const customerMsg = {to: orderData.customerEmail, from: fromEmail, subject: customerSubject, text: customerBody};

  const adminSubject = replacePlaceholders(settings.adminNotifySubject || "新規注文のお知らせ", orderData);
  const adminBody = replacePlaceholders(settings.adminNotifyBody || "新しい注文が入りました。", orderData);
  const adminMsg = {to: adminEmail, from: fromEmail, subject: adminSubject, text: adminBody};

  try {
    await sgMail.send(customerMsg);
    await sgMail.send(adminMsg);
  } catch (error) {
    console.error("メール送信エラー:", error);
  }
});

// --- 受付完了メール送信機能 ---
exports.sendCompletionEmail = onCall({ enforceAppCheck: true, secrets: ["SENDGRID_API_KEY"] }, async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "認証が必要です。");
    }
    
    const orderId = request.data.orderId;
    if (!orderId) {
      throw new HttpsError("invalid-argument", "注文IDが必要です。");
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      throw new HttpsError("not-found", "注文が見つかりません。");
    }

    const orderData = { id: orderDoc.id, ...orderDoc.data() };
    if (orderData.completionEmailSent) {
      throw new HttpsError("already-exists", "完了メールは既に送信済みです。");
    }

    const settingsDoc = await db.collection("settings").doc("emailTemplates").get();
    const settings = settingsDoc.data() || {};
    const fromEmail = settings.fromEmail;
    if (!fromEmail) {
      throw new HttpsError("failed-precondition", "送信元メールアドレスが設定されていません。");
    }

    const subject = replacePlaceholders(settings.processCompleteSubject || "ご注文の準備ができました", orderData);
    const body = replacePlaceholders(settings.processCompleteBody || "ご注文の商品準備が完了しました。", orderData);
    
    const msg = { to: orderData.customerEmail, from: fromEmail, subject, text: body };
    
    try {
        await sgMail.send(msg);
        await orderRef.update({ completionEmailSent: true });
        return { success: true, message: "メールを送信しました。" };
    } catch (error) {
        console.error("完了メール送信エラー:", error);
        throw new HttpsError("internal", "メールの送信に失敗しました。");
    }
});

// --- 公開データ取得機能 ---
exports.getPublicData = onCall({enforceAppCheck: true}, async (request) => {
  try {
    const productsPromise = db.collection("products").where("isVisible", "==", true).get();
    const servingStylesPromise = db.collection("servingStyles").get();
    const paymentMethodsPromise = db.collection("paymentMethods").get();
    const storeInfoPromise = db.collection("settings").doc("storeInfo").get();
    const [
      productsSnapshot,
      servingStylesSnapshot,
      paymentMethodsSnapshot,
      storeInfoDoc,
    ] = await Promise.all([
      productsPromise,
      servingStylesPromise,
      paymentMethodsPromise,
      storeInfoPromise,
    ]);

    // ★★★★★ ここからが変更点 ★★★★★
    // Firestoreから取得した商品データに対して、データ整形（フォールバック処理）を行う
    const products = productsSnapshot.docs.map((doc) => {
        const productData = doc.data();
        
        // discountPriceフィールドが存在しない、または数値でない場合に、priceフィールドの値をコピーする
        if (typeof productData.discountPrice !== 'number') {
            productData.discountPrice = productData.price;
        }
        
        return {id: doc.id, ...productData};
    });
    // ★★★★★ ここまでが変更点 ★★★★★

    const servingStyles = servingStylesSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const paymentMethods = paymentMethodsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const storeInfo = storeInfoDoc.exists ? storeInfoDoc.data() : {};
    return {products, servingStyles, paymentMethods, storeInfo};
  } catch (error) {
    console.error("Error fetching public data:", error);
    throw new HttpsError("internal", "Unable to fetch public data.");
  }
});


const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getStorage} = require("firebase-admin/storage");

/**
 * 毎日午前3時に実行される、FirestoreのデータをCloud Storageにバックアップする関数
 */
exports.scheduledFirestoreExport = onSchedule(
    {
      schedule: "every day 03:00",
      timeZone: "Asia/Tokyo",
    },
    async (event) => {
      // このコードは、firebase-admin v11.9.0以降が必要です。
      // initializeApp()はファイルの先頭で一度だけ呼び出してください。
      const firestoreClient = new admin.firestore.v1.FirestoreAdminClient();
      const bucket = getStorage().bucket(); // デフォルトのCloud Storageバケット

      const projectId = process.env.GCLOUD_PROJECT;
      const databaseName = firestoreClient.databasePath(projectId, "(default)");
      const bucketName = `gs://${bucket.name}`;

      const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
      const outputUriPrefix = `${bucketName}/backups/${timestamp}`;

      console.log(`Starting Firestore export to ${outputUriPrefix}`);

      try {
        const [operation] = await firestoreClient.exportDocuments({
          name: databaseName,
          outputUriPrefix: outputUriPrefix,
          collectionIds: [], // 空の配列ですべてのコレクションを対象
        });
        const [response] = await operation.promise();
        console.log(`Export operation successful: ${response.name}`);
        console.log(`Output written to ${response.outputUriPrefix}`);
        return null;
      } catch (err) {
        console.error(err);
        throw new Error("Export failed");
      }
    },
);