import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import P from 'pino';
import schedule from 'node-schedule';
import dayjs from 'dayjs';
import 'dayjs/locale/ru.js';
import http from 'http';
import qrcode from 'qrcode-terminal';

dayjs.locale('ru');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
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
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Соединение закрыто. Reconnect:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Бот готов!');
            console.log('Отправка запланирована на 7:30!');

            schedule.scheduleJob({ rule: "30 07 * * *", tz: "Asia/Yekaterinburg" }, async () => {
                const chatId = "79128862212-1503840727@g.us"; // ID чата Молодёжки в WA
                // 120363420861533061@g.us - Для теста
                const dailyMeditation = await getDailyMeditation();
                console.log(dailyMeditation);
                await sock.sendMessage(chatId, { text: dailyMeditation });
            });
        }
    });
}

startBot();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('ok'))
    .listen(PORT, '0.0.0.0', () => console.log(`Server listening on 0.0.0.0:${PORT}`));
