import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import P from 'pino';
import schedule from 'node-schedule';
import dayjs from 'dayjs';
import 'dayjs/locale/ru.js';
import http from 'http';
import qrcode from 'qrcode-terminal';

dayjs.locale('ru');

let isConnected = false;
let socketInstance = null;

async function safeSendMessage(socket, chatId, message) {
    try {
        if (isConnected && socket?.user) {
            await socket.sendMessage(chatId, message);
        } else {
            console.log("⚠️ Нет соединения, сообщение не отправлено:", chatId);
        }
    } catch (err) {
        console.error("❌ Ошибка при отправке:", err?.message || err);
    }
}

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
        console.log("❌ Ошибка загрузки медитации:", err);
        return '';
    }
}

// Функция для установки всех расписаний (один раз)
function setupSchedules(socket) {
    const molodezhkaChatId = "79128862212-1503840727@g.us";
    const molodezhkaText = 'Группа МОЛОДЁЖКА\n' +
        'Адрес: ул. Пушкина 13\n' +
        'Вход со стороны сквера Пушкина\n' +
        'Время: 21:00 - 22:15\n' +
        'Ежедневник и Вкусный чай\n' +
        'Незабываемая атмосфера при свечах\n' +
        'Ты нужен NAм!\n' +
        'Для координации:\n' +
        'Артём +7(912) 984-37-77';

    // 08:00 — медитация
    schedule.scheduleJob({ rule: "00 08 * * *", tz: "Asia/Yekaterinburg" }, async () => {
        const dailyMeditation = await getDailyMeditation();
        await safeSendMessage(socket, molodezhkaChatId, { text: dailyMeditation });
    });

    // 12:00 — рассылка в чат группы + картинка
    schedule.scheduleJob({ rule: '00 12 * * 1,3,5,6,0', tz: 'Asia/Yekaterinburg' }, async () => {
        await safeSendMessage(socket, molodezhkaChatId, {
            caption: molodezhkaText,
            image: { url: "https://i.ibb.co/tp08X77B/2025-09-17-20-06-43.jpg" }
        });
    });

    // 00:00 — личное сообщение
    schedule.scheduleJob({ rule: '00 00 * * 1,3,5,6,0', tz: 'Asia/Yekaterinburg' }, async () => {
        const chatId = '79519388508@s.whatsapp.net';
        await safeSendMessage(socket, chatId, { text: molodezhkaText });
    });
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        auth: state,
    });

    socketInstance = socket;

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isConnected = false;
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Соединение закрыто. Reconnect:', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => {
                    startBot(); // реконнект с задержкой
                }, 5000);
            }
        } else if (connection === 'open') {
            isConnected = true;
            console.log('✅ Бот готов!');
        }
    });

    // keep alive (иначе WhatsApp дропает через idle)
    setInterval(() => {
        if (isConnected && socket?.ws) {
            socket.sendPresenceUpdate('available');
        }
    }, 60_000);

    return socket;
}

async function main() {
    const socket = await startBot();
    setupSchedules(socket);
}

main();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('ok'))
    .listen(PORT, '0.0.0.0', () => console.log(`Server listening on 0.0.0.0:${PORT}`));
