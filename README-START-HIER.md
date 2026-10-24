# Vexo RP – Coding- und Animations-KI Upgrade

Dieses Paket enthält **Ersatzdateien für deinen bestehenden Discord.js-v14-Bot**. Es enthält keinen vollständigen Bot, keine Zugangsdaten und kein vorinstalliertes Videomodell. Sichere deinen Bot-Ordner, bevor du etwas überschreibst.

## Installation (Windows)

1. Bot mit `Strg+C` beenden.
2. Gesamten Bot-Ordner sichern.
3. Den Ordner `KI-Chatbot` aus diesem ZIP in deinen vorhandenen Bot-Hauptordner kopieren. Dateien bei Nachfrage ersetzen. `index.js`, `.env`, `node_modules` und alle anderen Dateien **nicht** löschen.
4. `KI-Chatbot/KI-Chat.js` wird bereits über dein bestehendes `index.js` geladen; keinen zweiten Client erstellen.
5. In `.env` mindestens einen vorhandenen KI-Anbieter konfigurieren, zum Beispiel `GROQ_API_KEY=...` oder `GEMINI_API_KEY=...`. Die API-Anbieter können kostenlose Kontingente haben, sind aber nicht unbegrenzt kostenlos. Optional: `AI_MAX_TOKENS=8000`, `AI_TIMEOUT_MS=120000`.
6. Für **Projektänderungen** `KI_CODE_OWNER_ID` (deine Discord-Nutzer-ID) und `KI_CODE_PASSWORD_HASH` konfigurieren. Den Hash mit `node tools/create-password-hash.js` lokal erstellen; Passwort niemals in Discord-Nachrichten, Git oder ZIP speichern. Die Passwortabfrage erfolgt über ein Discord-Modal nach deinem Änderungsauftrag.
7. `npm start` ausführen. Falls der Bot bereits KI-Chat-Setup besitzt, bleiben deine vorhandenen Kanal-Konfigurationen in `KI-Chatbot/KI-Chat.json` erhalten, sofern du sie **nicht** mit der beigefügten Datei überschreibst. Dasselbe gilt für `KI-Chat-Memory.json`.

## Bedienung

- **Fragen, Schreiben, Code als Text:** Einfach im KI-Chat fragen, z. B. „Schreibe mir eine vollständige Discord.js-v14-Funktion für ...“. Große Antworten können als `antwort.md` kommen.
- **Projektänderung:** „Ändere die Datei `KI-Chatbot/XYZ.js` in meinem Bot ...“. Die KI liest passende lokale Projektdateien, macht einen Vorschlag, prüft JS-Syntax bzw. JSON und sendet einen Codeanhang. **Noch keine Änderung.**
- **Einbauen:** „Okay, mach das“ → Button „Privat mit Passwort bestätigen“ → Passwort im Modal. Erst danach schreibt der Bot Dateien und erstellt `.ki-code-backups`. Danach den Bot neu starten.
- **Fehlender Kontext:** Sende die Originaldatei oder nenne den Pfad. Ohne eindeutigen Codekontext wird keine Änderung freigegeben.
- **Bildanimation:** Bild im KI-Chat hochladen und anschließend Bewegung beschreiben. Für echte Videos muss ein lokaler ComfyUI-Server auf `http://127.0.0.1:8188` laufen und `KI-Chatbot/workflow_api.json` existieren. Siehe `COMFYUI-ANLEITUNG.md`.

## Wichtige Grenzen

- **Keine KI garantiert fehlerfreien Code.** Syntax- und JSON-Prüfung verhindern einige Fehler, ersetzen aber keine Integrationstests. Der Bot führt KI-generierten Code **nicht automatisch** aus.
- Das Code-Manager-Modul bearbeitet bewusst nur `.js`- und `.json`-Dateien, begrenzt Änderungsvorschläge und sperrt sensible Dateien sowie Pfade außerhalb des Bot-Projekts.
- Passwortfreigabe gilt ausschließlich für den in `KI_CODE_OWNER_ID` angegebenen Discord-Account. Es gibt keinen unbeaufsichtigten Projektzugriff.
- Keine automatische mehrstündige Hintergrundarbeit: Provider-Limits und Anfrage-Timeouts gelten weiter. Der Bot kann längere Texte ausgeben, aber große Projekte sollten in überprüfbaren Etappen geändert werden.
- Ohne echte ComfyUI-Modelle und korrekt exportierten Workflow ist die Videoerzeugung **nicht** einsatzbereit. Ein frei erfundenes JSON würde keine echte KI-Animation erzeugen.
- Die gelieferten JS-Dateien wurden auf Syntax geprüft; ein echter Discord-/ComfyUI-End-to-End-Test war hier ohne deinen laufenden Bot und deine Modelle nicht möglich.
