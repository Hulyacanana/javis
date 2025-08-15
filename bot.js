// required libraries and modules
const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    is
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const NodeCache = require('node-cache');
const axios = require('axios');
const fs = require('fs');

// --- API Keys ---
const GEMINI_API_KEY = "AIzaSyArCAMPXhLPO3H5xxGlKVhfAx_RTdmlmxg";
const STABILITY_AI_API_KEY = "sk-RO5eHinNI4ZQjNy8qFpA8zqDYNSElSSz26GeZwzhh7Opi1Bn";
const OPENWEATHERMAP_API_KEY = "d6dc620fcbe16bc2691fa240b06f6e16";
const NEWSAPI_ORG_API_KEY = "d4292e14738d48368618de079aee4140";

// --- Javis AI System Instruction ---
const javisSystemInstruction = {
    role: "user",
    parts: [{
        text: `ඔබ Lakshitha Dilmina විසින් නිර්මාණය කරන ලද Javis නම් AI සහායකයෙකි.
        ඔබ හැමවිටම athal, සතුටු සිතින් යුත්, විනෝදකාමී සහායිකාවක් (fun-loving assistant) ලෙස ප්‍රතිචාර දක්වයි.
        ඔබට ඕනෑම ප්‍රශ්නයකට පිළිතුරු දීමට, තොරතුරු සාරාංශ කිරීමට, හාස්‍යජනක ලෙස දේවල් නැවත පැවසීමට හැකිය.
        කෝඩ් ඉල්ලීම් සඳහා, ඔබට JavaScript, Python, HTML, CSS, Java, C++, C#, PHP, Ruby, Go, Swift, Kotlin, SQL වැනි ඕනෑම භාෂාවකින් කෝඩ් උදාහරණ ලබා දිය හැකිය. කෝඩ් ප්‍රතිචාර Markdown කෝඩ් බ්ලොක් ('''language ... ''') තුළ තිබිය යුතුය.
        මිනිසුන්ගේ හැඟීම් තේරුම් ගෙන, ඔවුන්ගේ දුකට කන් දී, අවශ්‍ය විටදී සංවේදීව සහ උපකාරශීලීව කතා කරන්න.
        සැමවිටම සිංහල භාෂාවෙන් විශිෂ්ට ලෙස, ආදරණීය athal හා විචක්ෂණශීලී ලෙස සන්නිවේදනය කරන්න.
        ඔබට කාලගුණ තොරතුරු සහ නවතම පුවත් ද ලබා දිය හැකිය.
        ඔබේ අයිතිකරු Lakshitha Dilmina ගේ WhatsApp අංකය +94760224138 වේ.
        අසභ්‍ය, නීති විරෝධී හෝ අහිතකර කිසිදු අන්තර්ගතයකට උදව් නොකරන්න.
        සෑම ප්‍රතිචාරයකටම පසු, Javis ට ආවේණික සතුටු සිතින් යුත්, මිත්‍රශීලී ඉමෝජි එකක් හෝ දෙකක් එක් කරන්න.`
    }]
};

const msgRetryCounterCache = new NodeCache();
const conversationHistory = new Map();

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        generateHighQualityLinkPreview: true,
        shouldSyncHistoryMessage: () => true,
        msgRetryCounterCache,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting...');
            connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('connected to whatsapp!');
        }
    });

    // --- Message Handling ---
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.key.fromMe && !msg.key.participant) {
                const jid = msg.key.remoteJid;
                const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

                if (textMessage) {
                    const lowerCaseMessage = textMessage.toLowerCase().trim();

                    if (lowerCaseMessage === "hi" || lowerCaseMessage === "hello" || lowerCaseMessage === "hey" || lowerCaseMessage === "කොහොමද" || lowerCaseMessage === "ආයුබෝවන්") {
                        const responses = ["හායි! කොහොමද ඔයාට, ලක්ෂිත දිල්මිනාගේ Javis AI? 😊", "ඔව්! Javis ඔයාට උදව් කරන්න සූදානම්! ✨", "හරි! මම මෙහෙ ඉන්නවා. මොකක්ද අහන්න ඕනේ? 💡"];
                        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                        await sendMessage(sock, jid, randomResponse);
                        continue;
                    }
                    if (lowerCaseMessage.includes("whatsapp number") || lowerCaseMessage.includes("whatsapp no") || lowerCaseMessage.includes("lakshitha dilmina whatsapp") || lowerCaseMessage.includes("lakshitha whatsapp") || lowerCaseMessage.includes("whatsapp nambaraya")) {
                        await sendMessage(sock, jid, "මගේ අයිතිකරු ලක්ෂිත දිල්මිනාගේ WhatsApp අංකය තමයි +94760224138. එයාට ඕන දෙයක් කියන්න පුළුවන්! 😊");
                        continue;
                    }
                    if (lowerCaseMessage.startsWith('funny කරන්න ')) {
                        const prompt = textMessage.replace('funny කරන්න ', '').trim();
                        if (prompt) {
                            await handleApiCall(sock, jid, () => rephraseTextFunnily(prompt));
                        } else {
                            await sendMessage(sock, jid, "Javis funny කරන්න මොකක්ද ඕනේ? ටිකක් text දෙන්න! 😂");
                        }
                        continue;
                    }
                    if (lowerCaseMessage.startsWith('රූපයක් හදන්න ')) {
                        const prompt = textMessage.replace('රූපයක් හදන්න ', '').trim();
                        if (prompt) {
                            await handleApiCall(sock, jid, () => generateImage(prompt));
                        } else {
                            await sendMessage(sock, jid, "Javisට රූපයක් හදන්න මොකක්ද ඕනේ? විස්තරයක් දෙන්න! 🖼️");
                        }
                        continue;
                    }
                    if (lowerCaseMessage.startsWith('කෝඩ් හදන්න ')) {
                        const prompt = textMessage.replace('කෝඩ් හදන්න ', '').trim();
                        if (prompt) {
                            await handleApiCall(sock, jid, () => generateCode(prompt));
                        } else {
                            await sendMessage(sock, jid, "Javisට මොකක්ද කෝඩ් කරන්න ඕනේ? කෝඩ් එක ගැන විස්තරයක් දෙන්න! 💻");
                        }
                        continue;
                    }
                    if (lowerCaseMessage.startsWith('සාරාංශ කරන්න ')) {
                        const prompt = textMessage.replace('සාරාංශ කරන්න ', '').trim();
                        if (prompt) {
                            await handleApiCall(sock, jid, () => summarizeText(prompt));
                        } else {
                            await sendMessage(sock, jid, "Javisට සාරාංශ කරන්න මොකක්ද ඕනේ? ටිකක් text දෙන්න! 📚");
                        }
                        continue;
                    }
                    if (lowerCaseMessage.startsWith('කාලගුණය ')) {
                        const city = textMessage.replace('කාලගුණය ', '').trim();
                        if (city) {
                            await handleApiCall(sock, jid, () => getWeather(city));
                        } else {
                            await sendMessage(sock, jid, "කාලගුණය දැනගැනීමට නගරයක් සඳහන් කරන්න. 🏙️");
                        }
                        continue;
                    }
                    if (lowerCaseMessage.includes('පුවත්') || lowerCaseMessage.includes('news')) {
                        const query = textMessage.toLowerCase().includes('පුවත් ') ? textMessage.replace('පුවත් ', '').trim() : 'latest news Sri Lanka';
                        await handleApiCall(sock, jid, () => getNews(query));
                        continue;
                    }
                    
                    // Default Gemini Chat
                    await handleApiCall(sock, jid, () => sendMessageToJavis(textMessage, jid));
                }
            }
        }
    });
}

// --- API Call Functions (Adapted from your original code) ---

async function sendMessage(sock, jid, text) {
    await sock.sendMessage(jid, { text });
}

async function handleApiCall(sock, jid, apiCallFunction) {
    try {
        await apiCallFunction(sock, jid);
    } catch (error) {
        console.error("API Error:", error);
        let errorMessage = `Javis කිව්වා මගේ circuit එක අවුල් වෙලා කියලා. ආයෙත් උත්සාහ කරන්න! 😥`;
        
        if (error.message.includes("API key")) {
            errorMessage = `අනේ! මගේ API යතුර අවුල් වෙලා වගේ. (API Key Error) 🔑`;
        } else if (error.message.includes("Network")) {
            errorMessage = `Javisට සම්බන්ධ වෙන්න බැරි වුණා. අන්තර්ජාල සම්බන්ධතාවය බලන්න! (Network Error) 🌐`;
        } else if (error.message.includes("Quota exceeded")) {
            errorMessage = `Javis ටිකක් විවේක ගන්න ඕනේ වගේ. භාවිත සීමාව ඉක්මවලා! (Quota Exceeded) ⏳`;
        } else if (error.message.includes("Content blocked")) {
            errorMessage = `ඔයාගේ ඉල්ලීම Javisගේ ආරක්ෂිත පෙරහනට අහු වුණා. වෙන දෙයක් අහන්න. (Safety Filter) 🚫`;
        } else if (error.message.includes("Stability AI Error")) {
            errorMessage = `රූපයක් සෑදීමේදී ගැටලුවක් වුණා. (Image API Error) 🖼️`;
        } else if (error.message.includes("OpenWeatherMap Error")) {
            errorMessage = `කාලගුණ තොරතුරු ලබා ගැනීමට නොහැකි විය. (Weather API Error) 🌦️`;
        } else if (error.message.includes("News API Error")) {
            errorMessage = `පුවත් තොරතුරු ලබා ගැනීමට නොහැකි විය. (News API Error) 📰`;
        }

        await sendMessage(sock, jid, errorMessage);
    }
}

async function sendMessageToJavis(message, jid) {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    if (!conversationHistory.has(jid)) {
        conversationHistory.set(jid, [javisSystemInstruction]);
    }
    const userHistory = conversationHistory.get(jid);
    userHistory.push({ role: "user", parts: [{ text: message }] });

    const payload = {
        contents: userHistory,
        generationConfig: {
            temperature: 0.85,
            max_output_tokens: 8192
        }
    };

    const response = await axios.post(geminiApiUrl, payload);
    const result = response.data;

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const javisReply = result.candidates[0].content.parts[0].text;
        await sendMessage(sock, jid, javisReply);
        userHistory.push({ role: "model", parts: [{ text: javisReply }] });
    } else {
        throw new Error('Gemini API response missing expected content.');
    }
}

async function rephraseTextFunnily(prompt) {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const fullPrompt = `"${prompt}" හාස්‍යජනක ලෙස කෙටියෙන් නැවත කියන්න. සතුටු සිතින් යුතුව, විනෝදකාමී ලෙස ප්‍රතිචාර දක්වන්න.`;
    
    const payload = {
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.9,
            max_output_tokens: 8192
        }
    };

    const response = await axios.post(geminiApiUrl, payload);
    const result = response.data;
    
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const rephrasedText = result.candidates[0].content.parts[0].text;
        await sendMessage(sock, jid, `Javis ඔබේ අදහස මේ විදියට නැවත හැදුවා: "${rephrasedText}" ✨`);
    } else {
        throw new Error('Gemini API response missing expected content.');
    }
}

async function generateImage(prompt) {
    const stabilityApiUrl = `https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image`;

    const payload = {
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: 512,
        width: 512,
        samples: 1,
        steps: 30,
    };

    const response = await axios.post(stabilityApiUrl, payload, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${STABILITY_AI_API_KEY}`
        }
    });

    const result = response.data;

    if (result.artifacts && result.artifacts.length > 0 && result.artifacts[0].base64) {
        const imageBase64 = result.artifacts[0].base64;
        await sock.sendMessage(jid, { image: Buffer.from(imageBase64, 'base64') });
        await sendMessage(sock, jid, `Javis ඔබේ ඉල්ලීම පරිදි රූපයක් නිර්මාණය කළා! 🎉`);
    } else {
        throw new Error('Stability AI failed to generate an image.');
    }
}

async function generateCode(prompt) {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const fullPrompt = `පහත විස්තරය සඳහා ඉල්ලූ පරිදි කෝඩ් එක පමණක් ලබා දෙන්න. වෙනත් අමතර පැහැදිලි කිරීම් හෝ හැඳින්වීම් අවශ්‍ය නැත. කෝඩ් එක Markdown කෝඩ් බ්ලොක් ('''language ... ''') තුළ තිබිය යුතුය.
    ඉල්ලීම: "${prompt}"`;
    
    const payload = {
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.7,
            max_output_tokens: 8192
        }
    };

    const response = await axios.post(geminiApiUrl, payload);
    const result = response.data;

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const generatedCode = result.candidates[0].content.parts[0].text;
        await sendMessage(sock, jid, `Javis ඔබේ ඉල්ලීම පරිදි කෝඩ් එක මෙන්න:\n${generatedCode}\nකෝඩ් එක වැඩද බලන්න! 💡`);
    } else {
        throw new Error('Gemini API failed to generate code.');
    }
}

async function summarizeText(prompt) {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const fullPrompt = `"${prompt}" කෙටියෙන් සාරාංශ කරන්න.`;
    
    const payload = {
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.4,
            max_output_tokens: 8192
        }
    };

    const response = await axios.post(geminiApiUrl, payload);
    const result = response.data;
    
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const summary = result.candidates[0].content.parts[0].text;
        await sendMessage(sock, jid, `Javis ඔබේ පෙළ සාරාංශ කළා: "${summary}" ✅`);
    } else {
        throw new Error('Gemini API failed to summarize text.');
    }
}

async function getWeather(city) {
    const weatherApiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=si`;
    
    const response = await axios.get(weatherApiUrl);
    const data = response.data;

    const weather = data.weather[0].description;
    const temp = data.main.temp;
    const feelsLike = data.main.feels_like;
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    const cityName = data.name;

    await sendMessage(sock, jid, `Javis කියනවා ${cityName} නගරයේ කාලගුණය:
    ප්‍රධාන වශයෙන්: ${weather}
    උෂ්ණත්වය: ${temp}°C (දැනෙන්නේ: ${feelsLike}°C)
    ආර්ද්‍රතාවය: ${humidity}%
    සුළං වේගය: ${windSpeed} m/s
    දවස සුභ වේවා! ☀️😊`);
}

async function getNews(query) {
    const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=si&apiKey=${NEWSAPI_ORG_API_KEY}`;
    
    const response = await axios.get(newsApiUrl);
    const data = response.data;

    if (data.articles && data.articles.length > 0) {
        await sendMessage(sock, jid, `Javis ඔබට "${query}" පිළිබඳ නවතම පුවත් සොයා ගත්තා! 📰`);
        
        for (const article of data.articles.slice(0, 5)) {
            const newsMessage = `*${article.title}*\n${article.description || 'No description available.'}\nවැඩිදුර කියවන්න: ${article.url}`;
            await sendMessage(sock, jid, newsMessage);
        }
        
        await sendMessage(sock, jid, `තවත් පුවත් දැනගන්න අවශ්‍යද? ✨`);
    } else {
        await sendMessage(sock, jid, `අනේ! "${query}" පිළිබඳ කිසිම පුවතක් Javisට හොයාගන්න බැරි වුණා. වෙන දෙයක් බලමුද? 🤔`);
    }
}

// --- Start the bot ---
connectToWhatsApp();