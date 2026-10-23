const crypto = require('node:crypto');
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Neues KI-Code-Passwort (Eingabe sichtbar, nur lokal ausführen): ', password => {
  if (!password) { console.error('Passwort darf nicht leer sein.'); process.exitCode = 1; rl.close(); return; }
  const salt = crypto.randomBytes(24).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  console.log('In .env eintragen:');
  console.log('KI_CODE_PASSWORD_HASH=' + salt + ':' + hash);
  rl.close();
});
