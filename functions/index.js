const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ★変更点: 日本のリージョン(asia-northeast1)で動作する関数を、より確実な方法で定義します。
const regionalFunctions = functions.region("asia-northeast1");

/**
 * お客様向けの公開情報を取得するためのHTTP関数
 */
exports.getPublicData = regionalFunctions.https.onCall(async (data, context) => {
  // App Checkの検証
  if (context.app == undefined) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "The function must be called from an App Check verified app.",
    );
  }

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
    throw new functions.https.HttpsError(
        "internal", "Unable to fetch public data.",
    );
  }
});
