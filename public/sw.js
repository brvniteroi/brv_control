// Service worker do BRV Control: guarda o "esqueleto" do app para ele abrir sem sinal.
// Dados (Supabase) e fotos (/api/) não passam por aqui: quem cuida deles offline é
// o cache da agenda e a fila de envio do app de campo (src/services/filaCampo.ts).
const CACHE = 'brv-app-v2';

// Guarda o index.html e os arquivos do build que ele cita (JS/CSS com hash no nome)
async function guardarEsqueleto() {
  const c = await caches.open(CACHE);
  const resp = await fetch('/', { cache: 'no-cache' });
  const html = await resp.clone().text();
  await c.put('/', resp);
  const arquivos = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await c.addAll([...new Set([...arquivos, '/manifest.webmanifest', '/logobrvcontrol.png'])]);
}

self.addEventListener('install', (e) => {
  e.waitUntil(guardarEsqueleto());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Fotos e upload (api/) não entram no cache do aparelho
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Páginas: tenta a rede (versão nova); sem sinal, usa o index.html guardado
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put('/', copia));
          return resp;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Arquivos do build (nome muda a cada versão): cache primeiro
  if (url.pathname.startsWith('/assets/') || /\.(png|webp|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return resp;
          }),
      ),
    );
  }
});
