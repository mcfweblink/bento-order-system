import { watchAuthState, handleLogout } from './admin/auth.js';
import { initTabs } from './admin/ui.js';
import { initOrders } from './admin/orders.js';
import { initProducts } from './admin/products.js';
import { initSettings } from './admin/settings.js';

/**
 * ダッシュボード全体の初期化を行う
 */
function initDashboard() {
    // UI関連の初期化
    initTabs();
    document.getElementById('logout-button').addEventListener('click', handleLogout);

    // 各タブの機能ごとの初期化
    initOrders();
    initProducts();
    initSettings();
}

// 認証状態の監視を開始し、ログイン済みならダッシュボードを初期化
watchAuthState(initDashboard);