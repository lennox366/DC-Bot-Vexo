# ComfyUI: echte Bild-zu-Video-Animation

1. Installiere und starte ComfyUI lokal und installiere ein zu deiner GPU passendes Image-to-Video-Modell samt benötigten Custom Nodes.
2. Teste den Image-to-Video-Workflow zuerst direkt in ComfyUI mit einem eigenen Bild, bis eine MP4-, WEBM- oder GIF-Datei erzeugt wird.
3. Exportiere den Workflow als **API-Format** (nicht als UI-Workflow). Öffne die exportierte JSON und ermittle die Node-IDs sowie Eingabefelder für das hochgeladene Bild, den Textprompt, optional Framezahl und FPS.
4. Erstelle `KI-Chatbot/workflow_api.json` mit folgendem **Schema** (Platzhalter durch echte IDs/Felder ersetzen):

```json
{
  "workflow": {
    "123": {
      "class_type": "LoadImage",
      "inputs": { "image": "beispiel.png" }
    }
  },
  "mapping": {
    "image": { "node": "123", "input": "image" },
    "prompt": { "node": "ECHTE_TEXT_NODE_ID", "input": "ECHTES_PROMPT_FELD" },
    "frames": { "node": "OPTIONALE_NODE_ID", "input": "ECHTES_FRAMES_FELD" },
    "fps": { "node": "OPTIONALE_NODE_ID", "input": "ECHTES_FPS_FELD" }
  }
}
```

**Achtung:** Dieses Schema ist eine Erklärung, **kein lauffähiger Workflow**. `workflow` muss alle Nodes aus deinem echten API-Export enthalten; `mapping` verweist auf die tatsächlich vorhandenen Nodes. Wenn dein Modell keine Textsteuerung unterstützt, benötigst du einen dazu passenden Workflow oder eine Anpassung des Animationsmoduls.

5. Installiere FFmpeg und stelle sicher, dass `ffmpeg -version` im Terminal funktioniert, oder setze `FFMPEG_PATH` in `.env` auf den vollständigen Pfad.
6. Optional `VEXO_COMFY_URL=http://127.0.0.1:8188` in `.env` setzen. Starte Bot und ComfyUI, lade ein Bild im KI-Chat hoch und beschreibe eine Bewegung.

Hinweis: Die Animationsdatei begrenzt Discord-Anhänge auf 8 MB, Jobs auf 20 Minuten und parallele Jobs auf einen. Bildidentität und exakte Logoschrift sind bei generativen Videomodellen nicht garantiert.
