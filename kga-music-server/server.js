
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PORT = 7777;
const TEMP_DIR = join(process.cwd(), '.kga-temp');
const KEEP_DIR = join(homedir(), 'Music', 'KGA');
mkdirSync(TEMP_DIR, { recursive: true });
mkdirSync(KEEP_DIR, { recursive: true });

// check yt-dlp all'avvio: se manca, messaggio chiaro e uscita
const check = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' });
if (check.error) {
  console.error('X yt-dlp NON TROVATO nel PATH.');
  console.error('  Installa:  winget install yt-dlp   (o: pip install -U yt-dlp)');
  console.error('  Poi CHIUDI e RIAPRI il terminale.');
  process.exit(1);
}
console.log(`OK yt-dlp ${check.stdout.trim()}`);
const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (ff.error) console.warn('AVVISO: ffmpeg assente, audio nel formato originale (ok comunque).');
const HAS_FFMPEG = !ff.error;

// auto-update yt-dlp in background (YouTube cambia spesso)
spawn('yt-dlp', ['-U'], { stdio: 'ignore' }).on('close', () => {});

const app = new Hono();
app.use('*', cors());
const jobs = new Map();

app.get('/health', (c) => c.json({ ok: true, ytdlp: check.stdout.trim(), ffmpeg: HAS_FFMPEG }));

app.post('/download', async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'bad json' }, 400); }
  const { videoId, mode = 'temp', title = body.videoId } = body;
  if (!/^[\w-]{11}$/.test(videoId ?? '')) return c.json({ error: 'bad id' }, 400);

  // se lo stesso video e' gia' in download o pronto, riusa quel job
  const existing = [...jobs.entries()].find(
    ([, j]) => j.videoId === videoId && (j.status === 'downloading' || j.status === 'ready'),
  );
  if (existing) return c.json({ jobId: existing[0] });

  // cache: file gia' scaricato in passato? riusalo senza scaricare
  for (const d of [TEMP_DIR, KEEP_DIR]) {
    const found = readdirSync(d).find((f) => f.includes(`[${videoId}]`));
    if (found) {
      const jobId = `${videoId}-cache-${Date.now()}`;
      jobs.set(jobId, { status: 'ready', file: join(d, found), mode, videoId });
      return c.json({ jobId });
    }
  }

  const dir = mode === 'keep' ? KEEP_DIR : TEMP_DIR;
  const safe = String(title).replace(/[^\w\s-]/g, '').slice(0, 60).trim() || videoId;
  const outTemplate = join(dir, `${safe} [${videoId}].%(ext)s`);
  const jobId = `${videoId}-${Date.now()}`;
  jobs.set(jobId, { status: 'downloading', file: null, mode, videoId });

  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '-f', 'bestaudio/best',
    ...(HAS_FFMPEG ? ['-x', '--audio-format', 'm4a', '--audio-quality', '0'] : []),
    '-o', outTemplate,
    '--no-playlist', '--no-warnings',
    '--retries', '3', '--fragment-retries', '3',
    '--socket-timeout', '15',
    '--extractor-args', 'youtube:player_client=android,web',
  ];
  const proc = spawn('yt-dlp', args);
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });
  const killer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 180000);

  proc.on('close', (code) => {
    clearTimeout(killer);
    const job = jobs.get(jobId);
    if (!job) return;
    if (code === 0) {
      const found = readdirSync(dir).find((f) => f.includes(`[${videoId}]`));
      if (found) { job.status = 'ready'; job.file = join(dir, found); return; }
    }
    job.status = 'error';
    if (/Sign in to confirm|age/i.test(stderr)) job.error = 'video con verifica eta/login';
    else if (/unavailable|private/i.test(stderr)) job.error = 'video non disponibile';
    else if (/HTTP Error 429/i.test(stderr)) job.error = 'rate-limit YouTube: attendi qualche minuto';
    else job.error = stderr.slice(-200) || `exit code ${code}`;
  });
  proc.on('error', () => {
    const job = jobs.get(jobId);
    if (job) { job.status = 'error'; job.error = 'yt-dlp non eseguibile'; }
  });

  return c.json({ jobId });
});

app.get('/status/:jobId', (c) => {
  const job = jobs.get(c.req.param('jobId'));
  if (!job) return c.json({ error: 'not found' }, 404);
  return c.json({ status: job.status, error: job.error ?? null });
});

app.get('/stream/:jobId', (c) => {
  const job = jobs.get(c.req.param('jobId'));
  if (!job || job.status !== 'ready' || !existsSync(job.file))
    return c.json({ error: 'not ready' }, 404);
  const size = statSync(job.file).size;
  const mime = job.file.endsWith('.m4a') ? 'audio/mp4'
             : (job.file.endsWith('.opus') || job.file.endsWith('.webm')) ? 'audio/webm'
             : 'application/octet-stream';
  const range = c.req.header('range');
  if (range) {
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = Number(s), end = e ? Number(e) : size - 1;
    c.header('Content-Range', `bytes ${start}-${end}/${size}`);
    c.header('Accept-Ranges', 'bytes');
    c.header('Content-Type', mime);
    return c.body(createReadStream(job.file, { start, end }), 206);
  }
  c.header('Content-Type', mime);
  c.header('Content-Length', String(size));
  return c.body(createReadStream(job.file));
});

app.post('/done/:jobId', (c) => {
  const job = jobs.get(c.req.param('jobId'));
  if (job?.mode === 'temp' && job.file && existsSync(job.file)) {
    try { unlinkSync(job.file); } catch {}
  }
  jobs.delete(c.req.param('jobId'));
  return c.json({ ok: true });
});

setInterval(() => {
  const now = Date.now();
  try {
    for (const f of readdirSync(TEMP_DIR)) {
      const p = join(TEMP_DIR, f);
      if (now - statSync(p).mtimeMs > 30 * 60 * 1000) { try { unlinkSync(p); } catch {} }
    }
  } catch {}
}, 10 * 60 * 1000);

process.on('uncaughtException', (e) => console.error('uncaught:', e.message));
process.on('unhandledRejection', (e) => console.error('unhandled:', e));

serve({ fetch: app.fetch, port: PORT });
console.log(`KGA music server -> http://localhost:${PORT}`);
console.log(`  KEEP: ${KEEP_DIR}`);
console.log(`  TEMP: ${TEMP_DIR} (auto-cleanup 30 min)`);

