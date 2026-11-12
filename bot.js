// هذا السطر سيجبر السيرفر والمكتبات على التعرف على التشفير
global.crypto = require('crypto');

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const axios = require('axios');
const express = require('express');
const pino = require('pino');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzcJqIWyFDXOCTqmc9N2Jhkj6kBx_LQS2eAtdy4S_CvYxPKHZDQ6RCTVhrC5CmhWouEww/exec';

let webContent = '<h2>⏳ جاري تشغيل البوت الخفيف... يرجى الانتظار 30 ثانية ثم تحديث الصفحة.</h2>';

app.get('/', (req, res) => {
    res.send(`<div style="text-align: center; margin-top: 50px; font-family: tahoma;"><h1>نظام قبول - الإصدار السريع</h1>${webContent}</div>`);
});

app.listen(port, '0.0.0.0', () => console.log(`[1] 🌐 خادم الويب يعمل بنجاح على بورت ${port}`));

async function connectToWhatsApp() {
    console.log('[2] 📁 جاري إنشاء ملفات الجلسة الخفيفة...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    console.log('[3] 🔄 جاري الاتصال بخوادم واتساب...');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'error' }),
        browser: ['Qobool Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('[4] 🟢 تم التقاط كود QR بنجاح! جاري تحويله لصورة...');
            try {
                const qrDataUrl = await qrcode.toDataURL(qr);
                webContent = `
                    <h3>امسح الكود التالي من واتساب المبيعات</h3>
                    <img src="${qrDataUrl}" style="width: 300px; height: 300px; border: 2px solid #ccc; padding: 10px; border-radius: 10px;" />
                    <p>لديك 20 ثانية فقط لمسح الكود قبل تجديده.</p>
                `;
                console.log('[5] 📸 صورة الـ QR جاهزة الآن! (قم بتحديث صفحة الموقع وافحص الكود)');
            } catch (err) {
                console.error('❌ خطأ في توليد الصورة:', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[!] تم قطع الاتصال. إعادة المحاولة؟', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('⚠️ تم تسجيل الخروج يدوياً. يتم مسح الجلسة...');
                fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
                webContent = '<h2>⚠️ تم تسجيل الخروج. يرجى تحديث الصفحة لمسح كود جديد.</h2>';
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('[6] ✅ تم الربط بنجاح! البوت مستعد لاستقبال الرسائل.');
            webContent = '<h2 style="color: green;">✅ تم الربط بنجاح! البوت يعمل الآن باستقرار تام.</h2>';
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        if (!isGroup) return; 

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (!text) return;

        try {
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            if (!groupMetadata.subject.includes('قبول')) return;

            if (text.trim() === 'تجربة البوت') {
                console.log('🤖 تم استلام أمر التجربة، جاري الرد...');
                await sock.sendMessage(msg.key.remoteJid, { text: '🤖 أهلاً بك! البوت يعمل الآن بكفاءة وسرعة على الإصدار الخفيف.' }, { quoted: msg });
                return;
            }

            if (!text.startsWith('قبول /') && !text.startsWith('قبول/')) return;

            console.log('📩 تم استلام طلب خطاب، جاري المعالجة...');
            await sock.sendMessage(msg.key.remoteJid, { text: '⏳ *تحت الإجراء...* جاري إصدار الخطاب.' }, { quoted: msg });

            const senderPhone = msg.key.participant || msg.key.remoteJid;
            const response = await axios.post(GAS_WEBHOOK_URL, { sender_phone: senderPhone, message: text });
            const result = response.data;

            if (result.status === 'success') {
                await sock.sendMessage(msg.key.remoteJid, { text: `✅ *تم اعتماد الخطاب!*\n🩺 الطبيب: ${result.doctor}\n📄 الرابط: ${result.pdf_url}` }, { quoted: msg });
                console.log('✅ تم الإرسال بنجاح!');
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ *تنبيه:* ${result.message}` }, { quoted: msg });
            }
        } catch (error) {
            console.error('🚨 خطأ:', error.message);
        }
    });
}

connectToWhatsApp();
