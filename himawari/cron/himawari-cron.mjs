// Mở himawari_airmass.php?auto=1&once=1 bằng Chrome headless, đợi trang chụp + tải ảnh xong.
// Trang tự đặt document.title = 'HIMAWARI_DONE' (xong) hoặc 'HIMAWARI_ERROR' (lỗi).
// Chạy: HIMAWARI_CRON_URL="https://.../himawari_airmass.php?auto=1&once=1&key=KHOA" node himawari-cron.mjs
import puppeteer from 'puppeteer';

const url = process.env.HIMAWARI_CRON_URL || 'https://nangmua.vn/himawari_airmass.php?auto=1&once=1';
const timeoutMs = Number(process.env.HIMAWARI_TIMEOUT_MS || 20 * 60 * 1000);
const safeUrl = url.replace(/([?&]key=)[^&]*/i, '$1***');

const log = (...a) => console.log(new Date().toISOString(), ...a);

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let exitCode = 0;
try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[himawari]') || msg.type() === 'error') log(`[${msg.type()}]`, text);
    });
    page.on('pageerror', err => log('[pageerror]', err.message));
    page.on('requestfailed', req => {
        if (req.url().includes('himawari_airmass.php')) log('[requestfailed]', req.url().replace(/([?&]key=)[^&]*/i, '$1***'), req.failure()?.errorText);
    });

    log('Mở', safeUrl);
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (!res || !res.ok()) throw new Error(`Trang trả về HTTP ${res ? res.status() : '???'}`);

    await page.waitForFunction(
        () => document.title === 'HIMAWARI_DONE' || document.title === 'HIMAWARI_ERROR',
        { timeout: timeoutMs, polling: 2000 },
    );
    const title = await page.title();
    if (title === 'HIMAWARI_ERROR') throw new Error('Trang báo lỗi khi chạy tự động (xem log [himawari] ở trên)');
    log('Hoàn tất.');
} catch (err) {
    log('THẤT BẠI:', err.message);
    exitCode = 1;
} finally {
    await browser.close();
}
process.exit(exitCode);
