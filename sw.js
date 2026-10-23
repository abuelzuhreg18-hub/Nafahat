/* نفحات — Service Worker */
const V = "nafahat-v13";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(p => new Request(p, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("nafahat-v") && k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  // خطوط جوجل: تُخزَّن لتعمل بدون إنترنت
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(m => {
      const n = fetch(r).then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; }).catch(() => m);
      return m || n;
    })));
    return;
  }

  if (u.origin !== location.origin) return;     // باقي الطلبات الخارجية (مثل API القرآن) يتولاها التطبيق
  if (u.searchParams.has("_c")) return;          // فحص النسخة الجديدة: مباشرة من الشبكة
  if (u.pathname.endsWith(".pdf")) return;
  if (u.pathname.endsWith(".mp3")) return;      // الصوتيات يخزّنها التطبيق بنفسه      // الملفات الكبيرة يحفظها التطبيق بنفسه عند الطلب

  // الصفحة الرئيسية: الشبكة أولًا ثم النسخة المخزنة
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r, { cache: "no-cache" })
        .then(res => {
          if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put("index.html", cp)); return res; }
          if (res.type === "opaqueredirect") return res;   // تحويلات الاستضافة
          throw new Error("bad " + res.status);            // خطأ من الخادم: ارجع للنسخة المخزنة
        })
        .catch(() => caches.match("index.html").then(m => m || caches.match("./")))
    );
    return;
  }

  // باقي الملفات: من المخزن فورًا مع تحديثها في الخلفية
  e.respondWith(caches.match(r).then(m => {
    const n = fetch(r).then(res => { if (res.ok) caches.open(V).then(c => c.put(r, res.clone())); return res; }).catch(() => m);
    return m || n;
  }));
});

// الضغط على الإشعار يفتح التطبيق على الصفحة المناسبة
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.hash) || "";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cl => {
    for (const c of cl) {
      if ("focus" in c) { c.postMessage({ hash }); return c.focus(); }
    }
    return self.clients.openWindow("./" + (hash ? "#" + hash : ""));
  }));
});
