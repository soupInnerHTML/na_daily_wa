const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const schedule = require('node-schedule');
const dayjs = require('dayjs');
require('dayjs/locale/ru.js');
const http = require('http');
const qrcode = require('qrcode-terminal');
require('dotenv').config();
const { useRedisAuthState } = require('redis-baileys');

dayjs.locale('ru');

const redisConfig = {
    password: process.env.REDIS_PASSWORD,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
};
async function startBot() {
    const { state, saveCreds } = await useRedisAuthState(redisConfig, 'main');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    function parse(text) {
        return text
            .replace(/<br>/g, "\n\n")
            .replace(/&laquo;/g, "«")
            .replace(/&raquo;/g, "»")
            .replace(/&mdash;/g, "—")
            .replace(/&hellip;/g, "...");
    }

    async function getDailyMeditation() {
        try {
            const response = await fetch(`https://dev.na-russia.org/api/daily-meditation/?date=${dayjs().format("YYYY-MM-DD")}`);
            const [meditation] = await response.json();
            const dailyMeditationLink = 'https://na-russia.org/eg';
            return `🦔 Ёжик - ${dayjs().format("D MMMM")} 🦔\n\n«${parse(meditation.title)}»\n\n📖 ${parse(meditation.quote)}\n\n📘 ${parse(meditation.quote_from)}\n\n${parse(meditation.body)}\n\n📌 ТОЛЬКО СЕГОДНЯ: ${parse(meditation.jft)}\n\n${dailyMeditationLink}`;
        } catch (err) {
            console.log(err);
            return '';
        }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Выводим QR-код в консоль в виде ASCII
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode === DisconnectReason.restartRequired;
            console.log('Соединение закрыто. Reconnect:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Бот готов!');

            const molodezhkaChatId = "79128862212-1503840727@g.us"; // ID чата Молодёжки в WA
            // 120363420861533061@g.us - Для теста

            const molodezhkaText = 'Группа МОЛОДЁЖКА\n' +
                'Адрес: ул. Пушкина 13\n' +
                'Вход со стороны сквера Пушкина\n' +
                'Время: 21:00 - 22:15\n' +
                'Ежедневник и Вкусный чай\n' +
                'Незабываемая атмосфера при свечах\n' +
                'Ты нужен NAм!\n' +
                'Для координации:\n' +
                'Артём +7(912) 984-37-77'

            schedule.scheduleJob({ rule: "00 08 * * *", tz: "Asia/Yekaterinburg" }, async () => {
                const dailyMeditation = await getDailyMeditation();
                console.log(dailyMeditation);
                await sock.sendMessage(molodezhkaChatId, { text: dailyMeditation });
            });

            schedule.scheduleJob({ rule: '00 12 * * 1,3,5,6,0', tz: 'Asia/Yekaterinburg' }, async () => {
                await sock.sendMessage(molodezhkaChatId, {
                    caption: molodezhkaText,
                    image: {url: "https://i.ibb.co/tp08X77B/2025-09-17-20-06-43.jpg"}
                });
            });

            schedule.scheduleJob({ rule: '00 00 * * 1,3,5,6,0', tz: 'Asia/Yekaterinburg' }, async () => {
                const chatId = '79519388508@s.whatsapp.net'
                await sock.sendMessage(chatId, { text: molodezhkaText });
            });
        }
    });
}

startBot();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('ok'))
    .listen(PORT, '0.0.0.0', () => console.log(`Server listening on 0.0.0.0:${PORT}`));
