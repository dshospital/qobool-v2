const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// ضع رابط الـ Webhook الخاص بجوجل سكريبت هنا
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzcJqIWyFDXOCTqmc9N2Jhkj6kBx_LQS2eAtdy4S_CvYxPKHZDQ6RCTVhrC5CmhWouEww/exec';
const ALLOWED_GROUP_NAME = 'قبول';

app.get('/', (req, res) => res.send('Bot is awake! 🤖'));
app.listen(port, () => console.log(`Web server running on port ${port}`));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('امسح كود الـ QR من جوال المبيعات');
});

client.on('ready', () => {
    console.log(`✅ البوت يعمل بوضع التقييد لجروب: ${ALLOWED_GROUP_NAME}`);
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