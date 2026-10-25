# AHMED ANTI-LINK MD BOT

WhatsApp group moderation bot for TikTok, Telegram, YouTube, WhatsApp invite links and common URLs.

## Requirements
- Node.js 20 or newer
- A WhatsApp account to link as a device
- The bot account should be made a group admin if you want it to delete messages or remove members

## Run in Termux (Android)
1. Install Termux from a trusted source and open it.
2. Run:
   ```sh
   pkg update && pkg upgrade
   pkg install nodejs-lts
   ```
3. Extract this ZIP into a folder, then `cd` into that folder.
4. Run:
   ```sh
   npm install
   npm start
   ```
5. Scan the QR shown in Termux using WhatsApp → Linked devices → Link a device.
6. Add the linked WhatsApp account to your group and make it an admin.

## Commands
- `.menu` — show commands
- `.antilink on/off` — master switch
- `.deletelinks on/off` — delete detected links
- `.warnlinks on/off` — issue warnings
- `.kickafterwarn on/off` — remove a member after 3 warnings (off by default)
- `.antitiktok on/off`
- `.antitelegram on/off`
- `.antiyoutube on/off`
- `.antiwhatsapp on/off`
- `.antiinvite on/off` — other common URLs/invites
- `.welcome on/off`
- `.goodbye on/off`
- `.status` — show current settings
- `.warnings @member` — check warnings
- `.resetwarn @member` — reset warnings
- `.tagall [message]` — mention all members
- `.groupinfo`, `.admins`, `.ping`

Only group admins can change settings or use admin commands. Group admins are exempt from link moderation.

## Important notes
- This is a starter project, not a guarantee of uninterrupted service. WhatsApp Web/Baileys is an unofficial integration and may break after platform changes. Keep dependencies updated and test in a small group first.
- The bot must be an admin for deleting messages/removing users. If you see a link remain, check that the message type contains text/caption and that the bot has admin rights.
- Keep the `auth/` folder private. It contains login credentials; never upload or share it.
- This bot is not an official WhatsApp product. Use it responsibly and get group members' consent for moderation rules.
