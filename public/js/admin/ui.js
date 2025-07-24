/**
 * タブ切り替え機能を初期化する
 */
export function initTabs() {
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
}

/**
 * クリップボードにテキストをコピーする
 * @param {string} text - コピーするテキスト
 */
export function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.textContent = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

/**
 * コピー完了のツールチップを表示する
 * @param {MouseEvent} event - クリックイベント
 */
export function showCopyTooltip(event) {
    const tooltip = document.getElementById('copy-tooltip');
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 10}px`;
    tooltip.classList.remove('hidden');
    setTimeout(() => {
        tooltip.classList.add('hidden');
    }, 1000);
}
