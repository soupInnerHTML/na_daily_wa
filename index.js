const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const schedule = require("node-schedule");
const dayjs = require('dayjs')
require('dayjs/locale/ru')

dayjs.locale('ru');

// Создаём клиента
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process", // иногда помогает
            "--disable-gpu"
        ]
    }
});

// Выводим QR-код в консоль для авторизации
client.on("qr", qr => {
    qrcode.generate(qr, { small: true });
});

function parse(text) {
    return text
        .replace(/<br>/g, "\n\n")
        .replace(/&laquo;/g, "«")
        .replace(/&raquo;/g, "»")
        .replace(/&mdash;/g, "—")
        .replace(/&hellip;/g, "...")
}

async function getDailyMeditation() {
    try {
        const response = await fetch(`https://dev.na-russia.org/api/daily-meditation`)
        const [meditation] = await response.json();
        console.log(meditation)
        const dailyMeditationLink = 'https://na-russia.org/eg'
        return `🦔 Ёжик - ${dayjs().format("D MMMM")} 🦔\n\n«${parse(meditation.title)}»\n\n📖 ${parse(meditation.quote)}\n\n📘 ${parse(meditation.quote_from)}\n\n${parse(meditation.body)}\n\n📌 ТОЛЬКО СЕГОДНЯ: ${parse(meditation.jft)}\n\n${dailyMeditationLink}`
    } catch (err) {
        console.log(err)
        return ''
    }
}

// Когда готов
client.on("ready", async () => {
    console.log("Бот готов!");

    // const chats = await client.getChats();
    //
    // chats.forEach(chat => {
    //     if (chat.isGroup) {
    //         console.log(`Группа: ${chat.name}, ID: ${chat.id._serialized}`);
    //     }
    // });

    const dailyMeditation = await getDailyMeditation();

    // Запускаем задачу каждый день в 10:00
    schedule.scheduleJob("45 16 * * *", () => {
        const chatId = "120363420861533061@g.us"; // ID группы
        // 79128862212-1503840727@g.us
        client.sendMessage(chatId, 'Тест');
        client.sendMessage(chatId, dailyMeditation);
    });
});

client.initialize();
