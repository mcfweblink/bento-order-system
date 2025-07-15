const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");

// 関数のデフォルトリージョンを東京に設定
setGlobalOptions({region: "asia-northeast1"});

initializeApp();
const db = getFirestore();

/**
 * お客様向けの公開情報を取得するための呼び出し可能な関数
 */
exports.getPublicData = onCall({enforceAppCheck: true}, async (request) => {
  // enforceAppCheck: true により、App Checkの検証が自動的に行われます。
  try {
    // 各コレクションからデータを並行して取得
    const productsPromise = db.collection("products")
        .where("isVisible", "==", true).get();
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

    // 取得したデータを整形
    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id, ...doc.data(),
    }));
    const servingStyles = servingStylesSnapshot.docs.map((doc) => ({
      id: doc.id, ...doc.data(),
    }));
    const paymentMethods = paymentMethodsSnapshot.docs.map((doc) => ({
      id: doc.id, ...doc.data(),
    }));
    const storeInfo = storeInfoDoc.exists ? storeInfoDoc.data() : {};

    // 全てのデータをまとめてクライアントに返す
    return {
      products,
      servingStyles,
      paymentMethods,
      storeInfo,
    };
  } catch (error) {
    console.error("Error fetching public data:", error);
    // エラーが発生した場合は、クライアントにエラーを通知
    throw new HttpsError("internal", "Unable to fetch public data.");
  }
});
