const CACHE_NAME = 'dietapp-cache-v37';
// index.html은 캐시 대상에서 제외 - 항상 최신 코드를 받아오도록 하여
// PWA(특히 Opera standalone 모드)에서 카메라/파일 선택 기능이 캐시된 옛 코드로 인해
// 오작동하는 문제를 방지한다.
const CORE_ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 외부 API(Anthropic, Chart.js, 폰트 등)는 서비스 워커가 절대 관여하지 않고 항상 네트워크로 직행
  if (url.origin !== self.location.origin) return;

  // HTML 문서 요청(index.html 포함, 앱의 메인 페이지)은 캐시를 거치지 않고
  // 항상 네트워크에서 직접 받아온다. 이래야 서비스 워커가 파일 입력/카메라 관련
  // 브라우저 내부 처리에 개입해서 생기는 오작동을 피할 수 있고, 코드 업데이트도 즉시 반영된다.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 그 외 정적 리소스(아이콘, manifest 등)만 캐시 우선으로 처리
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          })
          .catch(() => cached)
      );
    })
  );
});
