import 'dotenv/config';
import { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { connectDB } from './db.js';
import { useMongoDBAuthState } from './mongoAuth.js';
import { generateWuhaResponse } from './ai.js';

// Environment Variables (You will set these in Render later)
const MONGO_URI = process.env.MONGO_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VENDOR_ID = "VEND-001"; // Hardcoded for this prototype vendor

// In-memory store to check if a number is a saved contact
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startWuha() {
    console.log("Starting Wuha Agent...");
    await connectDB(MONGO_URI);

    const { state, saveCreds } = await useMongoDBAuthState();
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // We will handle printing manually
        auth: state,
        generateHighQualityLinkPreview: true,
    });

    store.bind(sock.ev);

    // Connection Updates (QR Code & Reconnection)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n\n--- SCAN THIS QR CODE WITH YOUR WHATSAPP ---\n');
            qrcode.generate(qr, { small: true });
            console.log('\n------------------------------------------\n\n');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startWuha();
        } else if (connection === 'open') {
            console.log('✅ Wuha is now online and connected to WhatsApp!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message Listener
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return; // Ignore own messages

        const senderJid = msg.key.remoteJid;
        
        // Smart Contact Filtering: Ignore group chats and saved contacts
        if (senderJid.endsWith('@g.us')) return; 
        
        // If the sender's name exists in the local store, they are likely a saved contact
        const contact = store.contacts[senderJid];
        if (contact && contact.name) {
            console.log(`Ignoring message from saved contact: ${contact.name}`);
            return; 
        }

        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!textMessage) return;

        console.log(`Received message from ${senderJid}: ${textMessage}`);

        // Mark message as read
        await sock.readMessages([msg.key]);

        // Trigger AI Agent
        const aiReply = await generateWuhaResponse(textMessage, VENDOR_ID, GEMINI_API_KEY);
        
        // Send the reply back to the user
        await sock.sendMessage(senderJid, { text: aiReply });
    });
}

startWuha();
