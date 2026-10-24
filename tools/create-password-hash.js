'use strict';
// Lokal ausführen: node tools/create-password-hash.js
// Das Passwort wird nur in diesem Prozess gelesen, nicht als Klartext gespeichert.
const crypto = require('node:crypto');
const readline = require('node:readline');
const rl = readline.createInterface({input: process.stdin, output: process.stdout});
rl.question('Neues Freigabepasswort eingeben (Eingabe ist im Terminal sichtbar): ', password => {
  rl.close();
  if (password.length < 12) { console.error('Bitte mindestens 12 Zeichen verwenden.'); process.exitCode = 1; return; }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  console.log('\nIn .env eintragen:\nKI_CODE_PASSWORD_HASH=' + salt + ':' + hash);
  console.log('KI_CODE_OWNER_ID=DEINE_DISCORD_NUTZER_ID');
});
