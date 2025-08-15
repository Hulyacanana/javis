const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeInMemoryStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const fs = require('fs');

// System instruction for Javis AI
const systemInstruction = `You are Javis AI, an enthusiastic, fun, and witty AI assistant. 
You love making jokes and engaging in playful banter. Your responses should be lively and full of personality. 
Use Sinhala, English, or Singlish as appropriate.`;

// API keys and configurations
const geminiApiKey = 'AIzaSyArCAMPXhLPO3H5xxGlKVhfAx_RTdmlmxg';
const stabilityApiKey = 'sk-j2DETyIXz95F6WqQ6pmek8iUhojuV4aKiUVImpEb3pnvWDXJ'; // Stability AI key එකක් නැත්නම් මේක භාවිතා කරන්න ඕනේ නැහැ
const openWeatherMapApiKey = 'd6dc620fcbe16bc2691fa240b06f6e16'; // OpenWeatherMap key එකක් නැත්නම් මේක භාවිතා කරන්න ඕනේ නැහැ
const newsApiKey = 'YOUR_NEWS_API_KEY'; // News API key එකක් නැත්නම් මේක භාවිතා කරන්න ඕනේ නැහැ

// Memory store for chats and messages
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

// Main bot function
const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Javis-Bot', 'Chrome', '1.0.0'],
        auth: state,
    });

    store.bind(sock.ev);

    sock.ev.on('creds.update', saveCreds);

    const getPairingCode = async (phoneNumber) => {
        const { getQR } = await import('@whiskeysockets/baileys');
        const { pairingCode } = getQR(phoneNumber);
        return pairingCode;
    };

    const phoneNumber = '94760224138'; // මෙතන ඔබේ අංකය දාන්න

    getPairingCode(phoneNumber).then(code => {
        console.log(`Pairing Code: ${code}`);
    }).catch(err => {
        console.error('Failed to get pairing code:', err);
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            const message = messages[0];
            if (!message.key.fromMe) {
                const text = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

                // Handle commands
                if (text.startsWith('!')) {
                    const command = text.split(' ')[0].toLowerCase();
                    const args = text.substring(command.length + 1);

                    switch (command) {
                        case '!funny':
                            handleFunnyCommand(message, sock, args);
                            break;
                        case '!image':
                            // handleImageCommand(message, sock, args); // මේ command එකට code එකක් නෑ
                            break;
                        case '!code':
                            // handleCodeCommand(message, sock, args); // මේ command එකට code එකක් නෑ
                            break;
                        case '!summary':
                            // handleSummaryCommand(message, sock, args); // මේ command එකට code එකක් නෑ
                            break;
                        case '!weather':
                            // handleWeatherCommand(message, sock, args); // මේ command එකට code එකක් නෑ
                            break;
                        case '!news':
                            // handleNewsCommand(message, sock, args); // මේ command එකට code එකක් නෑ
                            break;
                    }
                } else {
                    // Handle regular chat messages
                    handleJavisMessage(message, sock, text);
                }
            }
        }
    });
};

const handleJavisMessage = async (message, sock, text) => {
    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
            contents: [
                {
                    parts: [
                        { text: systemInstruction },
                        { text: `User message: ${text}` }
                    ]
                }
            ]
        });

        const reply = response.data.candidates[0].content.parts[0].text;
        sock.sendMessage(message.key.remoteJid, { text: reply });
    } catch (error) {
        console.error('Error in Javis message handling:', error);
        sock.sendMessage(message.key.remoteJid, { text: 'Sorry, I\'m having a bit of a brain fog right now! Try again later.' });
    }
};

const handleFunnyCommand = async (message, sock, args) => {
    try {
        const jokePrompt = "Tell me a very funny joke in Sinhala.";
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
            contents: [
                {
                    parts: [
                        { text: systemInstruction },
                        { text: jokePrompt }
                    ]
                }
            ]
        });

        const joke = response.data.candidates[0].content.parts[0].text;
        sock.sendMessage(message.key.remoteJid, { text: joke });
    } catch (error) {
        console.error('Error in funny command:', error);
        sock.sendMessage(message.key.remoteJid, { text: 'My jokes are currently on vacation! Try again later.' });
    }
};

// Other command handler functions are not implemented in this version.
// You can add your own logic for these commands as needed.
const handleImageCommand = async (message, sock, args) => {};
const handleCodeCommand = async (message, sock, args) => {};
const handleSummaryCommand = async (message, sock, args) => {};
const handleWeatherCommand = async (message, sock, args) => {};
const handleNewsCommand = async (message, sock, args) => {};


startBot();
