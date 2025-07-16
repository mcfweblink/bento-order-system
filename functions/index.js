const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const sgMail = require("@sendgrid/mail");

// 関数のデフォルトリージョンを東京に設定
setGlobalOptions({region: "asia-northeast1"});

initializeApp();
const db = getFirestore();

// ★重要: SendGridのAPIキーを、関数のオプションとして安全に読み込む
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("SendGrid APIキーが設定されていません。メール送信は機能しません。");
}

/**
 * お客様向けの公開情報を取得するための呼び出し可能な関数
 */
exports.getPublicData = onCall({enforceAppCheck: true}, async (request) => {
  try {
    const productsPromise = db.collection("products").where("isVisible", "==", true).get();
    const servingStylesPromise = db.collection("servingStyles").get();
    const paymentMethodsPromise = db.collection("paymentMethods").get();
    const storeInfoPromise = db.collection("settings").doc("storeInfo").get();
    const [productsSnapshot, servingStylesSnapshot, paymentMethodsSnapshot, storeInfoDoc] = await Promise.all([productsPromise, servingStylesPromise, paymentMethodsPromise, storeInfoPromise]);
    const products = productsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const servingStyles = servingStylesSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const paymentMethods = paymentMethodsSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const storeInfo = storeInfoDoc.exists ? storeInfoDoc.data() : {};
    return {products, servingStyles, paymentMethods, storeInfo};
  } catch (error) {
    console.error("Error fetching public data:", error);
    throw new HttpsError("internal", "Unable to fetch public data.");
  }
});

/**
 * 新しい注文が作成されたときに実行される関数
 */
exports.onOrderCreate = onDocumentCreated(
    {
      document: "orders/{orderId}",
      secrets: ["SENDGRID_API_KEY"], // これがv2での正しい秘密情報の指定方法
    },
    async (event) => {
      const orderData = event.data.data();
      const orderId = event.params.orderId;

      // --- 1. 注文番号の採番 ---
      const counterRef = db.collection("counters").doc("order_counter");
      let newOrderNumber;
      try {
        await db.runTransaction(async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (!counterDoc.exists) {
            newOrderNumber = 201;
            transaction.set(counterRef, {currentNumber: newOrderNumber});
          } else {
            newOrderNumber = counterDoc.data().currentNumber + 1;
            transaction.update(counterRef, {currentNumber: newOrderNumber});
          }
        });
        await db.collection("orders").doc(orderId).update({orderNumber: newOrderNumber});
      } catch (e) {
        console.error("注文番号の採番に失敗しました: ", e);
        return;
      }

      // --- 2. メール送信 ---
      if (!SENDGRID_API_KEY) {
        console.error("SendGrid APIキーが未設定のため、メールを送信できません。");
        return;
      }

      // ★重要: メールアドレスを【】ごと、ご自身のものに書き換えてください
      const fromEmail = "tanaka35@chance.or.jp";
      const adminEmail = "tanaka35@chance.or.jp";

      const customerMsg = {
        to: orderData.customerEmail,
        from: fromEmail,
        subject: "【〇〇弁当】ご注文ありがとうございます",
        text: `${orderData.customerName}様\n\nこの度はご注文いただき誠にありがとうございます。\n以下の内容でご注文を承りました。\n\n注文番号: ${newOrderNumber}\n\n[ここに注文内容の詳細を記載]\n\n商品のお届け準備が整いましたら、改めてご連絡いたします。`,
      };
      const adminMsg = {
        to: adminEmail,
        from: fromEmail,
        subject: `【新規注文】注文番号: ${newOrderNumber}`,
        text: `新しい注文が入りました。\n\n注文番号: ${newOrderNumber}\nお客様名: ${orderData.customerName}\n\n管理画面から詳細を確認してください。`,
      };

      try {
        await sgMail.send(customerMsg);
        await sgMail.send(adminMsg);
        console.log("メールが正常に送信されました。");
      } catch (error) {
        console.error("メール送信中にエラーが発生しました", error);
        if (error.response) {
          console.error(error.response.body);
        }
      }
    },
);