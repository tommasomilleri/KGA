
const MB_API = 'https://musicbrainz.org/ws/2';
const SERVER = 'http://localhost:7777';

const PIPED = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.private.coffee',
];
const INVIDIOUS = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be'];


export interface Track { id: string; title: string; author: string }

// ---------- rilevamento server locale ----------
let serverOnline = false;
async function checkServer(): Promise<boolean> {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(1200) });
    serverOnline = r.ok;
  } catch { serverOnline = false; }
  return serverOnline;
}

// ---------- RICERCA ALTO LIVELLO: MusicBrainz (nome/artista) ----------
interface MBRecording { title: string; artist: string }
async function searchMusicBrainz(q: string): Promise<MBRecording[]> {
  try {
    const r = await fetch(
      `${MB_API}/recording?query=${encodeURIComponent(q)}&fmt=json&limit=8`,
      { headers: { 'User-Agent': 'KGA/1.0 (knowledge graph app)' },
        signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return [];
    const data = await r.json();
    const seen = new Set<string>();
    return (data.recordings ?? [])
      .map((rec: any) => ({
        title: rec.title,
        artist: rec['artist-credit']?.[0]?.name ?? '?',
      }))
      .filter((t: MBRecording) => {
        const k = `${t.title}::${t.artist}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      })
      .slice(0, 6);
  } catch { return []; }
}

// ---------- risolve "titolo artista" -> videoId YouTube ----------

async function resolveVideoId(query: string): Promise<Track[]> {
  // STRATO 1: Piped (CORS aperto, di solito il piu' affidabile)
  for (const base of PIPED) {
    try {
      const r = await fetch(
        `${base}/search?q=${encodeURIComponent(query)}&filter=videos`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) continue;
      const data = await r.json();
      const t: Track[] = (data.items ?? [])
        .slice(0, 5)
        .map((v: any) => ({
          id: String(v.url ?? '').replace('/watch?v=', ''),
          title: v.title ?? '?',
          author: v.uploaderName ?? '?',
        }))
        .filter((x: Track) => /^[\w-]{11}$/.test(x.id));
      if (t.length) return t;
    } catch { /* istanza giu': prossima */ }
  }
  // STRATO 2: Invidious
  for (const base of INVIDIOUS) {
    try {
      const r = await fetch(
        `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) continue;
      const data = await r.json();
      const t: Track[] = (data as any[])
        .filter((v) => v.type === 'video')
        .slice(0, 5)
        .map((v) => ({ id: v.videoId, title: v.title, author: v.author }));
      if (t.length) return t;
    } catch { /* prossima */ }
  }
  // STRATO 3: YouTube Data API ufficiale (se salvata con /ytkey — infallibile)
  const key = localStorage.getItem('kga-yt-key');
  if (key) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${key}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (r.ok) {
        const data = await r.json();
        return (data.items ?? []).map((v: any) => ({
          id: v.id.videoId,
          title: v.snippet.title,
          author: v.snippet.channelTitle,
        }));
      }
    } catch { /* niente */ }
  }
  return [];
}


function parseVideoId(input: string): string | null {
  const m = input.trim().match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ) || input.trim().match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

// ---------- YouTube IFrame (fallback) ----------
let ytPlayer: any = null;
let apiReady = false;
function loadYTApi(): Promise<void> {
  return new Promise((res) => {
    if (apiReady) return res();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
    (window as any).onYouTubeIframeAPIReady = () => { apiReady = true; res(); };
  });
}

export function initMusicPlayer(): void {
  const wrap = document.createElement('div');
  wrap.id = 'music';
  wrap.innerHTML = `
    <button id="music-toggle" title="Musica">♪</button>
    <div id="music-panel">
      <div class="mp-row">
        <input id="mp-q" type="text" placeholder="brano, artista o link… + INVIO" />
      </div>
      <div id="mp-server-badge"></div>
      <div id="mp-status"></div>
      <ul id="mp-results"></ul>
      <audio id="mp-audio" style="display:none"></audio>
      <div id="mp-frame"></div>
      <div class="mp-row mp-controls">
        <button id="mp-play">⏯</button>
        <button id="mp-next">⏭</button>
        <input id="mp-seek" type="range" min="0" max="100" value="0" />
        <input id="mp-vol" type="range" min="0" max="100" value="60" />
        <button id="mp-fav">★</button>
      </div>
      <label class="mp-keep"><input id="mp-keep" type="checkbox">
        salva su PC (altrimenti file eliminato a fine ascolto)</label>
      <div id="mp-favs"></div>
    </div>`;
  document.body.appendChild(wrap);

  const $ = (id: string) => document.getElementById(id)!;
  const panel = $('music-panel');
  $('music-toggle').onclick = () => panel.classList.toggle('open');

  const q = $('mp-q') as HTMLInputElement;
  const audio = $('mp-audio') as HTMLAudioElement;
  const seek = $('mp-seek') as HTMLInputElement;
  const keepBox = $('mp-keep') as HTMLInputElement;
  const badge = $('mp-server-badge');
  const status = $('mp-status');
  const resultsEl = $('mp-results') as HTMLUListElement;

  let queue: Track[] = [];
  let queueIdx = -1;
  let current: Track | null = null;
  let currentJob: string | null = null;
  let usingAudio = false;

  const setStatus = (m: string, err = false) => {
    status.textContent = m;
    status.style.color = err ? 'var(--err)' : 'var(--dim)';
  };

  // badge stato server (ricontrolla ogni 30s)
  const refreshBadge = async () => {
    await checkServer();
    badge.innerHTML = serverOnline
      ? '<span class="mp-on">● yt-dlp attivo — audio HQ</span>'
      : '<span class="mp-off">○ server spento — modalità YouTube</span>';
    keepBox.parentElement!.style.display = serverOnline ? 'block' : 'none';
  };
  refreshBadge();
  setInterval(refreshBadge, 30000);

  // ---------- PLAYBACK ----------
  const stopAll = () => {
    audio.pause(); audio.removeAttribute('src'); audio.load();
    ytPlayer?.stopVideo?.();
    if (currentJob) { fetch(`${SERVER}/done/${currentJob}`, { method: 'POST' }).catch(() => {}); currentJob = null; }
  };

  const playViaServer = async (track: Track): Promise<boolean> => {
    setStatus(`⬇ yt-dlp: ${track.title}…`);
    try {
      const r = await fetch(`${SERVER}/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: track.id, title: `${track.title} - ${track.author}`,
                               mode: keepBox.checked ? 'keep' : 'temp' }),
      });
      const { jobId } = await r.json();
      // polling fino a ready (max 90s)
      for (let i = 0; i < 90; i++) {
        await new Promise((res) => setTimeout(res, 1000));
        const st = await (await fetch(`${SERVER}/status/${jobId}`)).json();
        if (st.status === 'ready') {
          currentJob = jobId;
          audio.src = `${SERVER}/stream/${jobId}`;
          await audio.play();
          usingAudio = true;
          setStatus(`▶ ${track.title} — ${track.author}` + (keepBox.checked ? ' (salvato)' : ''));
          return true;
        }
        if (st.status === 'error') { setStatus(`yt-dlp: ${st.error}`, true); return false; }
        setStatus(`⬇ download… ${i}s`);
      }
    } catch { /* server caduto a metà */ }
    return false;
  };

  const playViaYouTube = async (track: Track) => {
    usingAudio = false;
    await loadYTApi();
    const YT = (window as any).YT;
    if (!ytPlayer) {
      ytPlayer = new YT.Player('mp-frame', {
        height: '158', width: '272', videoId: track.id,
        playerVars: { autoplay: 1, mute:1,origin: window.location.origin, playsinline: 1 },
        events: {
        onError: (e: any) => { 
          setStatus(`✕ non riproducibile (${e.data}), salto…`, true); 
          setTimeout(nextTrack, 800); 
        },
        onReady: (e: any) => { 
          e.target.playVideo();
        },
        onStateChange: (ev: any) => {
          if (ev.data === 1) {
            ev.target.unMute();
            ev.target.setVolume(Number((document.getElementById('mp-vol') as HTMLInputElement)?.value ?? 60));
            setStatus(`▶ ${current?.title ?? ""} — ${current?.author ?? ""}`);
          }
        }
      }
    });
  } else {
    ytPlayer.loadVideoById(track.id);
  }
    setStatus(`▶ (YouTube) ${track.title} — ${track.author}`);
  };

  const playTrack = async (track: Track) => {
    stopAll();
    current = track;
    renderResults();
    if (serverOnline && (await playViaServer(track))) return;
    await playViaYouTube(track);         // fallback trasparente
  };

  const nextTrack = () => {
    if (queueIdx < queue.length - 1) { queueIdx++; playTrack(queue[queueIdx]); }
    else setStatus('coda terminata');
  };

  // fine brano: notifica il server (cancella se temp) e passa al prossimo
  audio.onended = () => { stopAll(); nextTrack(); };
  audio.ontimeupdate = () => {
    if (audio.duration) seek.value = String((audio.currentTime / audio.duration) * 100);
  };
  seek.oninput = () => {
    if (usingAudio && audio.duration) audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    else if (ytPlayer?.getDuration) ytPlayer.seekTo((Number(seek.value) / 100) * ytPlayer.getDuration(), true);
  };

  // ---------- RICERCA UNIFICATA ----------
  q.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !q.value.trim()) return;
    const raw = q.value.trim(); q.value = '';

    const direct = parseVideoId(raw);
    if (direct) {                                        // basso livello: link
      queue = [{ id: direct, title: raw, author: 'link' }]; queueIdx = 0;
      renderResults(); playTrack(queue[0]); return;
    }

    setStatus(`♪ MusicBrainz: "${raw}"…`);               // alto livello
    const mb = await searchMusicBrainz(raw);
    const searchQuery = mb.length ? `${mb[0].artist} ${mb[0].title}` : raw;
    if (mb.length) setStatus(`→ ${mb[0].artist} – ${mb[0].title}, cerco il video…`);

    queue = await resolveVideoId(searchQuery + ' official audio');
    if (!queue.length) queue = await resolveVideoId(searchQuery);
    queue.sort((a,b)=> {const score = (t:Track) => (/audio|lyric|topic/i.test(t.title + '' + t.author) ? 1 : 0);
      return score(b) - score(a); });



if (!queue.length) {
      setStatus('ricerca offline — incolla un link YouTube o salva una key con /ytkey', true);
      return;
    }
    queueIdx = 0; renderResults(); playTrack(queue[0]);
  });

  const renderResults = () => {
    resultsEl.innerHTML = '';
    queue.forEach((t, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="mp-r-title">${t.title}</span>
                      <span class="mp-r-author">${t.author}</span>`;
      if (i === queueIdx) li.classList.add('playing');
      li.onclick = () => { queueIdx = i; playTrack(t); };
      resultsEl.appendChild(li);
    });
  };

  $('mp-play').onclick = () => {
    if (usingAudio) { audio.paused ? audio.play() : audio.pause(); }
    else if (ytPlayer?.getPlayerState) {
      ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
    }
  };
  $('mp-next').onclick = nextTrack;
  ($('mp-vol') as HTMLInputElement).oninput = (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    audio.volume = v / 100; ytPlayer?.setVolume?.(v);
  };

  // ---------- PREFERITI ----------
  const favsEl = $('mp-favs');
  const getFavs = (): Track[] => JSON.parse(localStorage.getItem('kga-music-favs') ?? '[]');
  const renderFavs = () => {
    const favs = getFavs();
    favsEl.innerHTML = favs.length ? '<div class="mp-favs-title">PREFERITI</div>' : '';
    favs.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'mp-fav-row';
      row.innerHTML = `<span class="mp-fav-name">${f.title}</span><span class="mp-fav-del">✕</span>`;
      (row.querySelector('.mp-fav-name') as HTMLElement).onclick = () => {
        queue = [f]; queueIdx = 0; renderResults(); playTrack(f);
      };
      (row.querySelector('.mp-fav-del') as HTMLElement).onclick = () => {
        localStorage.setItem('kga-music-favs', JSON.stringify(getFavs().filter((x) => x.id !== f.id)));
        renderFavs();
      };
      favsEl.appendChild(row);
    });
  };
  $('mp-fav').onclick = () => {
    if (!current) return;
    const favs = getFavs();
    if (!favs.some((f) => f.id === current!.id)) {
      favs.push(current); localStorage.setItem('kga-music-favs', JSON.stringify(favs)); renderFavs();
    }
  };
  renderFavs();

  // chiudi: se stavi streammando in temp, cancella il file
  window.addEventListener('beforeunload', () => {
    if (currentJob) navigator.sendBeacon?.(`${SERVER}/done/${currentJob}`);
  });
}

