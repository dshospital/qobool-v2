const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const axios = require('axios');
const express = require('express');
const pino = require('pino');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzcJqIWyFDXOCTqmc9N2Jhkj6kBx_LQS2eAtdy4S_CvYxPKHZDQ6RCTVhrC5CmhWouEww/exec';

let webContent = '<h2>⏳ جاري تشغيل البوت الخفيف وتوليد الـ QR... يرجى تحديث الصفحة بعد ثوانٍ.</h2>';

app.get('/', (req, res) => {
    res.send(`<div style="text-align: center; margin-top: 50px; font-family: tahoma;"><h1>نظام قبول - الإصدار السريع</h1>${webContent}</div>`);
});

app.listen(port, '0.0.0.0', () => console.log(`Web server running on port ${port}`));

async function connectToWhatsApp() {
    // إنشاء مجلد لحفظ الجلسة لكي لا يطلب الكود مراراً
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // منع السجلات المزعجة
        browser: ['Qobool Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('تم توليد كود QR جديد.');
            try {
                const qrDataUrl = await qrcode.toDataURL(qr);
                webContent = `
                    <h3>امسح الكود التالي من واتساب المبيعات (الأجهزة المرتبطة)</h3>
                    <img src="${qrDataUrl}" style="width: 300px; height: 300px; border: 2px solid #ccc; padding: 10px; border-radius: 10px;" />
                    <p>قم بتحديث الصفحة إذا لم تمسح الكود خلال 20 ثانية.</p>
                `;
            } catch (err) {
                console.error(err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                // في حال تم تسجيل الخروج يدوياً، يتم مسح الجلسة القديمة
                fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
                webContent = '<h2>⚠️ تم تسجيل الخروج. يرجى تحديث الصفحة لمسح كود جديد.</h2>';
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ تم الربط بنجاح!');
            webContent = '<h2 style="color: green;">✅ تم الربط بنجاح! البوت يعمل الآن باستقرار تام وبدون استهلاك للرامات.</h2>';
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        if (msg.key.remoteJid === 'status@broadcast') return; // تجاهل الحالات

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        if (!isGroup) return; // العمل في المجموعات فقط

        // الحصول على النص بشكل دقيق (رسالة عادية أو رسالة مقتبسة)
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (!text) return;

        try {
            // التحقق من اسم الجروب
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            if (!groupMetadata.subject.includes('قبول')) return;

            // أمر الاختبار السريع
            if (text.trim() === 'تجربة البوت') {
                await sock.sendMessage(msg.key.remoteJid, { text: '🤖 أهلاً بك! البوت يعمل الآن بكفاءة على الإصدار الخفيف.' }, { quoted: msg });
                return;
            }

            // التحقق من صيغة القبول
            if (!text.startsWith('قبول /') && !text.startsWith('قبول/')) return;

            await sock.sendMessage(msg.key.remoteJid, { text: '⏳ *تحت الإجراء...* جاري إصدار الخطاب.' }, { quoted: msg });

            const senderPhone = msg.key.participant || msg.key.remoteJid;
            const response = await axios.post(GAS_WEBHOOK_URL, { sender_phone: senderPhone, message: text });
            const result = response.data;

            if (result.status === 'success') {
                await sock.sendMessage(msg.key.remoteJid, { text: `✅ *تم اعتماد الخطاب!*\n🩺 الطبيب: ${result.doctor}\n📄 الرابط: ${result.pdf_url}` }, { quoted: msg });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ *تنبيه:* ${result.message}` }, { quoted: msg });
            }
        } catch (error) {
            console.error(error.message);
        }
    });
}

connectToWhatsApp();
