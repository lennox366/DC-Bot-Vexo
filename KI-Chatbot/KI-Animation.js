'use strict';
// Discord integration for a LOCAL ComfyUI image-to-video workflow.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { AttachmentBuilder } = require('discord.js');
const { isKIChatChannel } = require('./KI-Chat-Setup');

const BASE = path.join(__dirname, 'work');
const COMFY = (process.env.VEXO_COMFY_URL || 'http://127.0.0.1:8188').replace(/\/$/, '');
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ACTIVE = 1;
const sessions = new Map();
let active = 0;
const allowed = new Set(['image/png','image/jpeg','image/webp']);
function sessionKey(m) { return `${m.guildId}:${m.author.id}`; }
function extractImage(m) { return m.attachments.find(a => allowed.has(a.contentType?.split(';')[0]) && a.size <= MAX_BYTES); }
function formatPrompt(text) {
  const t = String(text || '').trim().slice(0, 1500);
  return `Animate the uploaded reference image with faithful subject identity, exact logo letters and original colors. Preserve composition. ${t}. Smooth cinematic motion, temporal consistency, no new text, no watermark.`;
}
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner','-loglevel','error','-y',...args], { windowsHide: true });
    let err = '';
    p.stderr.on('data', x => { err += x.toString().slice(0, 2000); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error('FFmpeg: ' + err.slice(-600))));
  });
}
async function comfyRequest(endpoint, options) {
  const response = await fetch(COMFY + endpoint, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`ComfyUI HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response;
}
async function uploadImage(buffer, filename) {
  const form = new FormData();
  form.append('image', new Blob([buffer], {type:'image/png'}), filename);
  form.append('overwrite','false');
  return (await (await comfyRequest('/upload/image', { method:'POST',body:form })).json()).name;
}
function setNode(workflow, id, input, value) {
  if (!workflow[id]?.inputs || !(input in workflow[id].inputs)) throw Error(`Workflow-Feld ${id}.${input} fehlt`);
  workflow[id].inputs[input] = value;
}
async function runComfy(image, prompt, seconds, fps, jobDir, onProgress) {
  const templatePath = path.join(__dirname, 'workflow_api.json');
  let cfg;
  try { cfg = JSON.parse(await fs.readFile(templatePath, 'utf8')); }
  catch { throw Error('workflow_api.json fehlt. Exportiere zuerst einen echten Image-to-Video-API-Workflow aus ComfyUI.'); }
  if (!cfg.workflow || !cfg.mapping) throw Error('workflow_api.json benÃ¶tigt workflow und mapping (siehe README).');
  const wf = structuredClone(cfg.workflow);
  const name = await uploadImage(image, `vexo_${crypto.randomUUID()}.png`);
  const set = (key, value) => { const ref = cfg.mapping[key]; if (ref) setNode(wf, String(ref.node), ref.input, value); };
  if (!cfg.mapping.image || !cfg.mapping.prompt) throw Error('Workflow-Mapping image und prompt sind Pflicht.');
  set('image', name); set('prompt', formatPrompt(prompt)); set('frames', Math.min(240, Math.max(8, seconds * fps))); set('fps', fps);
  const result = await (await comfyRequest('/prompt', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:wf,client_id:crypto.randomUUID()})})).json();
  if (!result.prompt_id) throw Error('ComfyUI hat keinen Auftrag angenommen: '+JSON.stringify(result.node_errors || {}).slice(0,400));
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const history = await (await comfyRequest('/history/'+encodeURIComponent(result.prompt_id))).json();
    const entry = history[result.prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') throw Error('ComfyUI-Modellgenerierung fehlgeschlagen. PrÃ¼fe das ComfyUI-Terminal.');
    if (!entry.outputs) continue;
    for (const output of Object.values(entry.outputs)) {
      const files = [...(output.gifs || []), ...(output.videos || [])];
      const movie = files.find(f => /\.(mp4|webm|gif)$/i.test(f.filename));
      if (!movie) continue;
      const url = new URL(COMFY + '/view');
      url.searchParams.set('filename',movie.filename);
      url.searchParams.set('subfolder',movie.subfolder || '');
      url.searchParams.set('type',movie.type || 'output');
      const res = await fetch(url, {signal:AbortSignal.timeout(120000)});
      if (!res.ok) throw Error('ComfyUI-Ausgabedatei nicht abrufbar.');
      const ext = path.extname(movie.filename).toLowerCase();
      const raw = path.join(jobDir, 'original'+ext);
      await fs.writeFile(raw,Buffer.from(await res.arrayBuffer()));
      onProgress('ðŸŽžï¸ KI-Frames fertig. GIF und MP4 werden exportiert â€¦');
      const mp4 = path.join(jobDir,'animation.mp4');
      if (ext === '.mp4') await fs.copyFile(raw,mp4);
      else await ffmpeg(['-i',raw,'-an','-pix_fmt','yuv420p','-movflags','+faststart',mp4]);
      const gif = path.join(jobDir,'animation.gif');
      await ffmpeg(['-i',mp4,'-vf',`fps=${Math.min(fps,15)},scale=512:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,'-loop','0',gif]);
      const webp = path.join(jobDir,'animation.webp');
      await ffmpeg(['-i',mp4,'-vf','fps=12,scale=512:-1:flags=lanczos','-loop','0','-quality','75',webp]);
      return {mp4,gif,webp};
    }
    throw Error('Workflow beendet, aber kein GIF/MP4/WEBM erzeugt. Workflow muss eine Videoausgabe speichern.');
  }
  throw Error('ComfyUI-Zeitlimit (20 Minuten) erreicht.');
}
async function handleAnimationMessage(message) {
  if (!message.guild || message.author.bot || !isKIChatChannel(message.guild.id,message.channel.id)) return false;
  const key = sessionKey(message);
  const attachment = extractImage(message);
  if (attachment) {
    const r = await fetch(attachment.url,{signal:AbortSignal.timeout(20000)});
    if (!r.ok) { await message.reply('âŒ Bild konnte nicht heruntergeladen werden.'); return true; }
    const buffer = Buffer.from(await r.arrayBuffer());
    if (buffer.length > MAX_BYTES || buffer.length < 100) { await message.reply('âŒ BildgrÃ¶ÃŸe ungÃ¼ltig (max. 8 MB).'); return true; }
    sessions.set(key,{image:buffer,expires:Date.now()+30*60*1000});
    await message.reply('ðŸ’™ Was mÃ¶chtest du mit deinem Bild machen? Soll ich es animieren, bearbeiten oder besondere Effekte hinzufÃ¼gen? Beschreibe die Bewegung, z. B. â€žLogo schwebt, blaue Blitze und Nebel, 5 Sekundenâ€œ.');
    return true;
  }
  const session = sessions.get(key);
  if (!session || session.expires < Date.now()) {sessions.delete(key); return false;}
  const text = (message.content || '').trim();
  if (!text) return false;
  if (/^(abbrechen|stopp|cancel)$/i.test(text)) {sessions.delete(key);await message.reply('ðŸ—‘ï¸ Animation abgebrochen.');return true;}
  if (active >= MAX_ACTIVE) {await message.reply('â³ Der lokale Animationsrechner ist beschÃ¤ftigt. Bitte spÃ¤ter erneut versuchen.');return true;}
  active++;
  let status;
  const jobDir = path.join(BASE,crypto.randomUUID());
  try {
    // Cleanup belongs inside try so active is always released.
    await fs.mkdir(BASE,{recursive:true});
    for (const item of await fs.readdir(BASE,{withFileTypes:true})) {
      if (!item.isDirectory()) continue;
      const dir = path.join(BASE,item.name);
      const st = await fs.stat(dir).catch(()=>null);
      if (st && Date.now()-st.mtimeMs > 86400000) await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});
    }
    await fs.mkdir(jobDir,{recursive:true});
    status = await message.reply('ðŸ” Bild wird analysiert und die Animation vorbereitet â€¦');
    const seconds = /\b10\s*(?:sek|s\b)/i.test(text) ? 10 : /\b3\s*(?:sek|s\b)/i.test(text) ? 3 : 5;
    const fps = 12;
    await status.edit('ðŸŽ¬ Lokale KI generiert Videoframes. Das kann mehrere Minuten dauern â€¦');
    const output = await runComfy(session.image,text,seconds,fps,jobDir, t=>status.edit(t).catch(()=>{}));
    const files = [];
    for (const [name,p] of Object.entries(output)) {
      const stat = await fs.stat(p);
      if (stat.size <= 8*1024*1024) files.push(new AttachmentBuilder(p,{name:`vexo-animation.${name}`}));
    }
    if (!files.length) throw Error('Die Animation ist grÃ¶ÃŸer als das Discord-Uploadlimit. Dateien liegen lokal in '+jobDir);
    await status.edit({content:'âœ… Echte KI-Animation fertig! ðŸŽ¬ Dateien direkt im Chat ansehen und herunterladen. FÃ¼r Ã„nderungen einfach einen neuen Wunsch schreiben.',files});
  } catch(e) {
    console.error('[KI-Animation]',e);
    if(status) await status.edit('âŒ Animation nicht erstellt: '+String(e.message).slice(0,1400)).catch(()=>{});
    else await message.reply('âŒ Animation fehlgeschlagen: '+String(e.message).slice(0,500));
  } finally { active--; }
  return true;
}
module.exports = {handleAnimationMessage};

