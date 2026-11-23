const photoCacheName = 'podkarpacie-photo-downloads-v1';

async function storedPhotoUrls(cache) {
  return new Set((await cache.keys()).map(request => request.url));
}

async function downloadPhotoPack(urls, onProgress) {
  const cache = await caches.open(photoCacheName);
  const stored = await storedPhotoUrls(cache);
  const pending = urls.filter(url => !stored.has(url));
  let saved = urls.length - pending.length;
  let checked = saved;
  onProgress(saved, checked);

  async function nextPhoto() {
    while (pending.length) {
      const url = pending.shift();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, {credentials:'omit', signal:controller.signal});
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          await cache.put(url, response);
          saved++;
        }
      } catch {
        // Keep the successful thumbnails and retry the rest on the next request.
      } finally {
        clearTimeout(timeout);
      }
      onProgress(saved, ++checked);
    }
  }

  await Promise.all([nextPhoto(), nextPhoto(), nextPhoto()]);
  return saved;
}
