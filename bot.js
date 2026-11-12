const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
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
    console.log('⌛ يرجى مسح الـ QR Code من واجهة الويب.');
});

client.on('ready', () => {
    webContent = '<h2 style="color: green;">✅ تم الربط بنجاح! البوت جاهز.</h2>';
    console.log('✅ البوت جاهز ومربوط بالواتساب بنجاح!');
});

client.on('message_create', async msg => {
    console.log('-----------------------------------');
    console.log('📩 تم التقاط رسالة جديدة!');
    console.log('النص:', msg.body);
    
    try {
        if (msg.isStatus) {
            console.log('❌ تم التجاهل: الرسالة عبارة عن حالة (Status)');
            return;
        }
        
        const chat = await msg.getChat();
        console.log('اسم المحادثة:', chat.name);
        console.log('هل هي مجموعة؟', chat.isGroup);
        
        if (!chat.isGroup) {
            console.log('❌ تم التجاهل: الرسالة ليست في مجموعة');
            return;
        }
        
        if (!chat.name.includes('قبول')) {
            console.log('❌ تم التجاهل: اسم المجموعة لا يحتوي على كلمة "قبول"');
            return;
        }

        const text = msg.body.trim();
        console.log('✅ الجروب صحيح، جاري فحص النص...');

        if (text === 'تجربة البوت') {
            console.log('🤖 تم التعرف على أمر التجربة، جاري إرسال الرد...');
            await msg.reply('🤖 أهلاً بك! البوت حي يرزق ويستمع للجروب بنجاح.');
            return;
        }

        if (!text.startsWith('قبول /') && !text.startsWith('قبول/')) {
            console.log('❌ تم التجاهل: الرسالة لا تبدأ بكلمة "قبول /"');
            return;
        }

        console.log('⏳ جاري إرسال رسالة "تحت الإجراء"...');
        await msg.reply('⏳ *تحت الإجراء...* جاري إصدار الخطاب.');

        const senderPhone = (await msg.getContact()).number;
        console.log('جاري الاتصال بـ Google Apps Script...');
        
        const response = await axios.post(GAS_WEBHOOK_URL, { sender_phone: senderPhone, message: text });
        const result = response.data;

        console.log('رد جوجل سكريبت:', result);

        if (result.status === 'success') {
            await msg.reply(`✅ *تم اعتماد الخطاب!*\n🩺 الطبيب: ${result.doctor}\n📄 الرابط: ${result.pdf_url}`);
            console.log('تم إرسال رابط الـ PDF بنجاح.');
        } else {
            await msg.reply(`❌ *تنبيه:* ${result.message}`);
            console.log('حدث خطأ من جوجل سكريبت:', result.message);
        }
    } catch (error) {
        console.error('🚨 خطأ داخلي:', error.message);
    }
});

client.initialize();
