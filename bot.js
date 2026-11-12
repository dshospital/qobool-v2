const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // مكتبة الصور النقية
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzcJqIWyFDXOCTqmc9N2Jhkj6kBx_LQS2eAtdy4S_CvYxPKHZDQ6RCTVhrC5CmhWouEww/exec';
const ALLOWED_GROUP_NAME = 'قبول';

// متغير لحفظ واجهة الويب
let webContent = '<h2>⏳ جاري تشغيل البوت وتوليد الـ QR... يرجى تحديث الصفحة بعد ثوانٍ.</h2>';

app.get('/', (req, res) => {
    res.send(`
        <div style="text-align: center; margin-top: 50px; font-family: tahoma;">
            <h1>نظام قبول - دار الشفاء</h1>
            ${webContent}
        </div>
    `);
});

app.listen(port, () => console.log(`Web server running on port ${port}`));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', async qr => {
    console.log('تم إنشاء الكود! افتح الرابط لمسحه.');
    try {
        // تحويل الـ QR إلى صورة نقية وعرضها في الرابط
        const qrDataUrl = await qrcode.toDataURL(qr);
        webContent = `
            <h3>امسح الكود التالي من واتساب المبيعات (الأجهزة المرتبطة)</h3>
            <img src="${qrDataUrl}" style="width: 300px; height: 300px; border: 2px solid #ccc; padding: 10px; border-radius: 10px;" />
            <p>لديك 20 ثانية لمسح الكود قبل أن يتغير.</p>
        `;
    } catch (err) {
        console.error(err);
    }
});

client.on('ready', () => {
    console.log(`✅ البوت يعمل بوضع التقييد لجروب: ${ALLOWED_GROUP_NAME}`);
    webContent = '<h2 style="color: green;">✅ تم الربط بنجاح! البوت يعمل الآن 24/7.</h2><p>يمكنك إغلاق هذه الصفحة.</p>';
});

client.on('message', async msg => {
    try {
        if (msg.fromMe || msg.isStatus) return;
        const chat = await msg.getChat();
        if (!chat.isGroup || chat.name.trim() !== ALLOWED_GROUP_NAME) return;
        
        const text = msg.body.trim();
        if (!text.startsWith('قبول /') && !text.startsWith('قبول/')) return;

        await msg.reply('⏳ *تحت الإجراء...* جاري إصدار الخطاب.');

        const senderPhone = (await msg.getContact()).number;
        const response = await axios.post(GAS_WEBHOOK_URL, { sender_phone: senderPhone, message: text });
        const result = response.data;

        if (result.status === 'success') {
            await msg.reply(`✅ *تم اعتماد الخطاب!*\n🩺 الطبيب: ${result.doctor}\n📄 الرابط: ${result.pdf_url}`);
        } else {
            await msg.reply(`❌ *تنبيه:* ${result.message}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
});

client.initialize();
