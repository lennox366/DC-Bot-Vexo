WexRP /log test – Einbauhinweise

Enthalten:
- logging.js: deine bereitgestellte Logging-Datei, ergänzt um runLogTest(client, executor).
- commands/log.js: Slash-Command /log test (Administratorrechte).

Einbau:
1. Ersetze deine bisherige logging.js durch diese logging.js (vorher Backup machen).
2. Stelle sicher, dass dein Startcode setup(client) aufruft, z. B.:
   const logging = require("./logging");
   logging.setup(client);
   Nur einmal ausführen, nachdem client erstellt wurde.
3. Lege commands/log.js in deinen bestehenden commands-Ordner. Wenn dein Projekt Commands anders lädt, muss der Export ggf. an den vorhandenen Loader angepasst werden.
4. Registriere/ deploye Slash-Commands wie bei deinen anderen Commands.
5. Setze LOG_WEBHOOK_URL in deiner .env:
   LOG_WEBHOOK_URL=https://discord.com/api/webhooks/...
   Niemals die Webhook-URL veröffentlichen oder committen.
6. Starte den Bot neu und führe /log test aus.

Wichtig:
- Der Test sendet pro in logging.js implementierter Ereignisgruppe eine Testnachricht an denselben Webhook.
- Er simuliert KEINE echten Events und führt keine Bans, Kicks, Nachrichtenlöschungen oder Rollenänderungen aus.
- Dieses Paket basiert auf der bereitgestellten logging.js. Andere Log-Systeme in weiteren Dateien werden dadurch nicht automatisch erkannt.
- Discord.js v14 und ein Command-Loader, der { data, execute } unterstützt, werden vorausgesetzt.
