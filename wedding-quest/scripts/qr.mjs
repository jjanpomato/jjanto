// 사용법: npm run qr -- https://주소
import QRCode from 'qrcode';
import { mkdirSync } from 'node:fs';

const url = process.argv[2];
if (!url) { console.error('주소를 넣어 주세요: npm run qr -- https://...'); process.exit(1); }
mkdirSync('qr', { recursive: true });
await QRCode.toFile('qr/wedding-quest-qr.png', url, {
  width: 1024, margin: 4, errorCorrectionLevel: 'M',
  color: { dark: '#2e2347', light: '#ffffff' },
});
console.log('qr/wedding-quest-qr.png ←', url);
