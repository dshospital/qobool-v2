const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// رابط الـ Webhook الجديد
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzcJqIWyFDXOCTqmc9N2Jhkj6kBx_LQS2eAtdy4S_CvYxPKHZDQ6RCTVhrC5CmhWouEww/exec';

let webContent = '<h2>⏳ جاري تشغيل البوت وتوليد الـ QR...</h2>';

app.get('/', (req, res) => {
    res.send(`<div style="text-align: center; margin-top: 50px; font-family: tahoma;"><h1>نظام قبول</h1>${webContent}</div>`);
});
app.listen(port, '0.0.0.0', () => console.log(`Web server running on port ${port}`));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }
});

client.on('qr', async qr => {
    const qrDataUrl = await qrcode.toDataURL(qr);
    webContent = `<h3>امسح الكود التالي من واتساب المبيعات (الأجهزة المرتبطة)</h3><img src="${qrDataUrl}" style="width: 300px; height: 300px;" />`;
});

client.on('ready', () => {
    webContent = '<h2 style="color: green;">✅ تم الربط بنجاح! البوت جاهز.</h2>';
});

// استخدمنا message_create ليلتقط رسائلك من أي جوال حتى لو جوال المبيعات نفسه
client.on('message_create', async msg => {
    try {
        if (msg.isStatus) return;
        
        const chat = await msg.getChat();
        if (!chat.isGroup) return;
        
        // مرونة في اسم الجروب: سيعمل إذا كان الاسم يحتوي على كلمة "قبول" بأي شكل
        if (!chat.name.includes('قبول')) return;

        const text = msg.body.trim();

        // 🟢 أمر فحص سريع للتأكد أن البوت يعمل دون الاعتماد على جوجل سكريبت
        if (text === 'تجربة البوت') {
            await msg.reply('🤖 أهلاً بك! البوت حي يرزق ويستمع للجروب بنجاح.');
            return;
        }

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
