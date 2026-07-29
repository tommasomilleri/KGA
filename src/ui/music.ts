let player: any = null;
let apiReady = false;

function loadYTApi(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) return resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
    (window as any).onYouTubeIframeAPIReady = () => { apiReady = true; resolve(); };
  });
}

// Estrae l'ID video da qualsiasi formato: URL completo, short, o ID nudo
function parseVideoId(input: string): string | null {
  const s = input.trim();
  const m =
    s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/) ||
    s.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

export function initMusicPlayer(): void {
  const wrap = document.createElement('div');
  wrap.id = 'music';
  wrap.innerHTML = `
    <button id="music-toggle" title="Musica">♪</button>
    <div id="music-panel">
      <div class="mp-row">
        <input id="mp-url" type="text"
          placeholder="incolla link YouTube + INVIO" />
      </div>
      <div class="mp-hint">oppure cerca su
        <a id="mp-yt-link" href="https://www.youtube.com" target="_blank">YouTube ↗</a>
        e incolla il link qui</div>
      <div id="mp-frame"></div>
      <div class="mp-row mp-controls">
        <button id="mp-play" title="Play/Pausa">⏯</button>
        <input id="mp-vol" type="range" min="0" max="100" value="60" title="Volume" />
        <button id="mp-fav" title="Salva nei preferiti">★</button>
      </div>
      <div id="mp-favs"></div>
    </div>`;
  document.body.appendChild(wrap);

  const panel = document.getElementById('music-panel')!;
  const toggleBtn = document.getElementById('music-toggle')!;
  toggleBtn.onclick = () => panel.classList.toggle('open');

  const urlInput = document.getElementById('mp-url') as HTMLInputElement;
  let currentId: string | null = null;

  const loadVideo = async (videoId: string) => {
    currentId = videoId;
    await loadYTApi();
    const YT = (window as any).YT;
    if (!player) {
      player = new YT.Player('mp-frame', {
        height: '158', width: '272',
        videoId,
        playerVars: { autoplay: 1 },
        events: { onReady: (e: any) => e.target.playVideo() },
      });
    } else {
      player.loadVideoById(videoId);
    }
  };

  urlInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const id = parseVideoId(urlInput.value);
    if (!id) { urlInput.value = ''; urlInput.placeholder = 'link non valido, riprova'; return; }
    loadVideo(id);
    urlInput.value = '';
    urlInput.placeholder = 'incolla link YouTube + INVIO';
  });

  document.getElementById('mp-play')!.onclick = () => {
    if (!player?.getPlayerState) return;
    player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
  };
  (document.getElementById('mp-vol') as HTMLInputElement).oninput = (e) =>
    player?.setVolume?.(Number((e.target as HTMLInputElement).value));

  // --- Preferiti (persistiti in localStorage) ---
  const favsEl = document.getElementById('mp-favs')!;
  const getFavs = (): { id: string; title: string }[] =>
    JSON.parse(localStorage.getItem('kga-music-favs') ?? '[]');
  const renderFavs = () => {
    const favs = getFavs();
    favsEl.innerHTML = favs.length ? '<div class="mp-favs-title">PREFERITI</div>' : '';
    favs.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'mp-fav-row';
      row.innerHTML = `<span class="mp-fav-name">${f.title}</span><span class="mp-fav-del">✕</span>`;
      (row.querySelector('.mp-fav-name') as HTMLElement).onclick = () => loadVideo(f.id);
      (row.querySelector('.mp-fav-del') as HTMLElement).onclick = () => {
        localStorage.setItem('kga-music-favs',
          JSON.stringify(getFavs().filter((x) => x.id !== f.id)));
        renderFavs();
      };
      favsEl.appendChild(row);
    });
  };
  document.getElementById('mp-fav')!.onclick = () => {
    if (!currentId) return;
    const title = player?.getVideoData?.()?.title ?? currentId;
    const favs = getFavs();
    if (!favs.some((f) => f.id === currentId)) {
      favs.push({ id: currentId, title: String(title).slice(0, 40) });
      localStorage.setItem('kga-music-favs', JSON.stringify(favs));
      renderFavs();
    }
  };
  renderFavs();
}