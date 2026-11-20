// XMart: Google Map Tiles API protocol for MapLibre (based on maplibre-google-maps),
// with the Pakistan region so local places and labels match Google Maps in Pakistan.
const sessions = {};

const createSession = async (url, key) => {
  const sessionRequest = {
    mapType: url.hostname,
    language: 'en-US',
    region: 'PK',
    scale: 'scaleFactor2x',
    highDpi: true,
  };
  const layerType = url.searchParams.get('layerType');
  const overlay = url.searchParams.get('overlay');
  if (layerType) {
    sessionRequest.layerTypes = [layerType];
  }
  if (overlay) {
    sessionRequest.overlay = overlay === 'true';
  }
  const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionRequest),
  });
  const result = await response.json();
  return result.session;
};

export async function googleProtocol(params) {
  const url = new URL(params.url.replace('google://', 'https://'));
  const sessionKey = `${url.hostname}?${url.searchParams}`;
  const key = url.searchParams.get('key');

  if (!sessions[sessionKey]) {
    sessions[sessionKey] = createSession(url, key);
  }
  const session = await sessions[sessionKey];

  const tile = await fetch(
    `https://tile.googleapis.com/v1/2dtiles${url.pathname}?session=${session}&key=${key}`,
  );
  return { data: await tile.arrayBuffer() };
}
