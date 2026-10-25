const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const WARNINGS_FILE = path.join(DATA_DIR, 'warnings.json');
const PREFIX = '.';

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
let settings = readJson(SETTINGS_FILE, {});
let warnings = readJson(WARNINGS_FILE, {});

function groupSettings(jid) {
  if (!settings[jid]) {
    settings[jid] = {
      antilink: true,
      deleteLinks: true,
      warnOnLink: true,
      kickAfterWarnings: false,
      welcome: true,
      goodbye: true,
      antiInvite: true,
      antiTikTok: true,
      antiTelegram: true,
      antiYouTube: true,
      antiWhatsApp: true
    };
    writeJson(SETTINGS_FILE, settings);
  }
  return settings[jid];
}
function textOf(message) {
  const m = message.message || {};
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId || '';
}
function normalizeJid(jid) {
  return (jid || '').split(':')[0];
}
function hasUrl(text) {
  return /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|chat\.whatsapp\.com\/|wa\.me\/|whatsapp\.com\/|youtu\.be\/|youtube\.com\/|tiktok\.com\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/|instagram\.com\/|facebook\.com\/|fb\.watch\/|discord\.gg\/|discord\.com\/invite\/|bit\.ly\/|tinyurl\.com\/)/i.test(text);
}
function linkTypes(text, cfg) {
  const found = [];
  if (cfg.antiTikTok && /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i.test(text)) found.push('TikTok');
  if (cfg.antiTelegram && /(?:t\.me|telegram\.me|telegram\.org)/i.test(text)) found.push('Telegram');
  if (cfg.antiYouTube && /(?:youtube\.com|youtu\.be)/i.test(text)) found.push('YouTube');
  if (cfg.antiWhatsApp && /(?:chat\.whatsapp\.com|wa\.me|whatsapp\.com)/i.test(text)) found.push('WhatsApp');
  if (cfg.antiInvite && /(?:https?:\/\/|www\.|instagram\.com|facebook\.com|fb\.watch|discord\.gg|discord\.com\/invite|bit\.ly|tinyurl\.com)/i.test(text)) found.push('Other link');
  return [...new Set(found)];
}
async function isGroupAdmin(sock, jid, participant) {
  try {
    const meta = await sock.groupMetadata(jid);
    const p = meta.participants.find(x => normalizeJid(x.id) === normalizeJid(participant));
    return p?.admin === 'admin' || p?.admin === 'superadmin';
  } catch { return false; }
}
async function sendText(sock, jid, text, quoted) {
  return sock.sendMessage(jid, { text }, quoted ? { quoted } : {});
}
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(ROOT, 'auth'));
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); }
  catch { version = undefined; }

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['AHMED ANTI-LINK', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\\nScan this QR with WhatsApp > Linked devices > Link a device:\\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('\\n✅ AHMED ANTI-LINK BOT connected. Keep this process running.\\n');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed. Code:', code, '- reconnecting when possible...');
      if (code !== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
      else console.log('Logged out. Remove the auth folder and run again to pair a new device.');
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    try {
      const cfg = groupSettings(update.id);
      const meta = await sock.groupMetadata(update.id);
      const names = update.participants.map(p => '@' + p.split('@')[0]);
      if (update.action === 'add' && cfg.welcome) {
        await sock.sendMessage(update.id, {
          text: `👋 Welcome ${names.join(', ')} to *${meta.subject}*!\\nPlease read the group rules.`,
          mentions: update.participants
        });
      } else if (update.action === 'remove' && cfg.goodbye) {
        await sock.sendMessage(update.id, { text: `👋 ${names.join(', ')} left the group.` });
      }
    } catch (e) { console.error('Welcome/goodbye error:', e.message); }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) continue;

        const sender = msg.key.participant || msg.key.remoteJid;
        const body = textOf(msg).trim();
        const cfg = groupSettings(jid);
        const senderAdmin = await isGroupAdmin(sock, jid, sender);
        const botJid = normalizeJid(sock.user?.id);
        const botAdmin = await isGroupAdmin(sock, jid, botJid);

        if (body.startsWith(PREFIX)) {
          const [rawCmd, ...args] = body.slice(PREFIX.length).split(/\s+/);
          const cmd = (rawCmd || '').toLowerCase();
          if (['menu', 'help'].includes(cmd)) {
            await sendText(sock, jid,
`╭─── *AHMED ANTI-LINK MENU* ───
│ Prefix: .
│ .antilink on/off
│ .deletelinks on/off
│ .warnlinks on/off
│ .kickafterwarn on/off
│ .welcome on/off
│ .goodbye on/off
│ .antitiktok on/off
│ .antitelegram on/off
│ .antiyoutube on/off
│ .antiwhatsapp on/off
│ .antiinvite on/off
│ .status
│ .warnings @user
│ .resetwarn @user
│ .tagall [message]
│ .groupinfo
│ .admins
│ .ping
╰────────────────────────
*Notes:* Group admins are exempt from link moderation. Bot must be a group admin to delete messages or remove members.`, msg);
            continue;
          }
          if (cmd === 'ping') { await sendText(sock, jid, '🏓 Pong! Bot is online.', msg); continue; }
          if (cmd === 'status') {
            await sendText(sock, jid, `⚙️ *Anti-link settings*\\nAnti-link: ${cfg.antilink ? 'ON' : 'OFF'}\\nDelete links: ${cfg.deleteLinks ? 'ON' : 'OFF'}\\nWarn: ${cfg.warnOnLink ? 'ON' : 'OFF'}\\nKick after warnings: ${cfg.kickAfterWarnings ? 'ON' : 'OFF'}\\nWelcome: ${cfg.welcome ? 'ON' : 'OFF'}\\nGoodbye: ${cfg.goodbye ? 'ON' : 'OFF'}\\nTikTok: ${cfg.antiTikTok ? 'ON' : 'OFF'}\\nTelegram: ${cfg.antiTelegram ? 'ON' : 'OFF'}\\nYouTube: ${cfg.antiYouTube ? 'ON' : 'OFF'}\\nWhatsApp: ${cfg.antiWhatsApp ? 'ON' : 'OFF'}\\nOther invites/URLs: ${cfg.antiInvite ? 'ON' : 'OFF'}`, msg);
            continue;
          }
          if (cmd === 'groupinfo') {
            const meta = await sock.groupMetadata(jid);
            await sendText(sock, jid, `📌 *${meta.subject}*\\nMembers: ${meta.participants.length}\\nCreated: ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString() : 'Unknown'}\\nDescription: ${meta.desc || 'None'}`, msg);
            continue;
          }
          if (cmd === 'admins') {
            const meta = await sock.groupMetadata(jid);
            const list = meta.participants.filter(p => p.admin).map(p => '• @' + p.id.split('@')[0]).join('\\n') || 'No admins found';
            await sock.sendMessage(jid, { text: `🛡️ *Group admins*\\n${list}`, mentions: meta.participants.filter(p => p.admin).map(p => p.id) }, { quoted: msg });
            continue;
          }

          const switches = {
            antilink: 'antilink', deletelinks: 'deleteLinks', warnlinks: 'warnOnLink',
            kickafterwarn: 'kickAfterWarnings', welcome: 'welcome', goodbye: 'goodbye',
            antitiktok: 'antiTikTok', antitelegram: 'antiTelegram',
            antiyoutube: 'antiYouTube', antiwhatsapp: 'antiWhatsApp', antiinvite: 'antiInvite'
          };
          if (switches[cmd]) {
            if (!senderAdmin) { await sendText(sock, jid, '⛔ Sirf group admins is setting ko change kar sakte hain.', msg); continue; }
            const val = (args[0] || '').toLowerCase();
            if (!['on', 'off'].includes(val)) { await sendText(sock, jid, `Use: .${cmd} on/off`, msg); continue; }
            cfg[switches[cmd]] = val === 'on';
            writeJson(SETTINGS_FILE, settings);
            await sendText(sock, jid, `✅ ${cmd} ${val.toUpperCase()} kar diya.`, msg);
            continue;
          }
          if (cmd === 'tagall') {
            if (!senderAdmin) { await sendText(sock, jid, '⛔ Sirf group admins use kar sakte hain.', msg); continue; }
            const meta = await sock.groupMetadata(jid);
            const members = meta.participants.map(p => p.id);
            const tags = members.map(id => '• @' + id.split('@')[0]).join('\\n');
            await sock.sendMessage(jid, { text: `📢 *${args.join(' ') || 'Attention everyone!'}*\\n\\n${tags}`, mentions: members }, { quoted: msg });
            continue;
          }
          if (['warnings', 'resetwarn'].includes(cmd)) {
            if (!senderAdmin) { await sendText(sock, jid, '⛔ Sirf group admins use kar sakte hain.', msg); continue; }
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!target) { await sendText(sock, jid, `Kisi member ko mention karke .${cmd} use karo.`, msg); continue; }
            const key = `${jid}:${normalizeJid(target)}`;
            if (cmd === 'resetwarn') {
              delete warnings[key]; writeJson(WARNINGS_FILE, warnings);
              await sendText(sock, jid, '✅ Warnings reset kar di gayi.', msg);
            } else {
              await sendText(sock, jid, `⚠️ @${target.split('@')[0]} ke warnings: ${warnings[key] || 0}`, msg);
            }
            continue;
          }
        }

        if (!cfg.antilink || !hasUrl(body) || senderAdmin) continue;
        const types = linkTypes(body, cfg);
        if (!types.length) continue;

        if (!botAdmin) {
          await sendText(sock, jid, '⚠️ Anti-link detect hua, lekin bot admin nahi hai. Messages delete karne ke liye bot ko group admin banao.', msg);
          continue;
        }
        if (cfg.deleteLinks) {
          try { await sock.sendMessage(jid, { delete: msg.key }); }
          catch (e) { console.error('Delete failed:', e.message); }
        }
        const warningKey = `${jid}:${normalizeJid(sender)}`;
        if (cfg.warnOnLink) {
          warnings[warningKey] = (warnings[warningKey] || 0) + 1;
          writeJson(WARNINGS_FILE, warnings);
          await sock.sendMessage(jid, {
            text: `🚫 @${sender.split('@')[0]}, ${types.join(', ')} link allowed nahi hai.\\n⚠️ Warning: ${warnings[warningKey]}${cfg.kickAfterWarnings ? '/3' : ''}`,
            mentions: [sender]
          });
          if (cfg.kickAfterWarnings && warnings[warningKey] >= 3) {
            try {
              await sock.groupParticipantsUpdate(jid, [sender], 'remove');
              delete warnings[warningKey]; writeJson(WARNINGS_FILE, warnings);
              await sendText(sock, jid, `👢 @${sender.split('@')[0]} ko 3 warnings ke baad remove kiya gaya.`, msg);
            } catch (e) {
              await sendText(sock, jid, '⚠️ Member remove nahi ho saka. Bot ko admin permission check karo.', msg);
            }
          }
        }
      } catch (err) { console.error('Message handler error:', err.message); }
    }
  });
}
startBot().catch(err => { console.error('Startup failed:', err); process.exit(1); });
