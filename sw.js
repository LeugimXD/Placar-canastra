// Funciona sem internet: guarda os arquivos e busca versões novas em segundo plano.
const CACHE = "canastra-v1";
const ARQUIVOS = ["./", "index.html", "scoring.js", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(e.request, { ignoreSearch: true }).then((salvo) => {
        const rede = fetch(e.request)
          .then((r) => { if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone()); return r; })
          .catch(() => salvo);
        return salvo || rede;
      })
    )
  );
});
