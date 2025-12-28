# AIVideo

Een eenvoudige iOS-webgeoptimaliseerde livestream demo op basis van WebRTC. De app vraagt om camera- en microfoonrechten, toont je eigen stream en levert een viewer-voorbeeld via een lokale peer-verbinding. ByteDance Live (Douyin/TikTok) API-hooks zijn toegevoegd voor ingest-gegevens en het ophalen van actieve livestreams.

## Gebruik
1. Open `index.html` lokaal of via een statische host (bijv. `python -m http.server`).
2. Klik op **Start livestream** en sta camera- en microfoonrechten toe op je iPhone.
3. Schakel tussen de front- en backcamera, zet microfoon of camera uit en bekijk de viewer-preview.
4. Vul optioneel je ByteDance `open_api_access_token` in en klik **Haal ingest op** om push-URL/streamkey op te vragen. Klik **Ververs lives** om de huidige ByteDance-livestreams te tonen.

> Voor echte kijkers voeg je eigen signalling toe tussen de `RTCPeerConnection`-objecten.
> ByteDance API-aanroepen vereisen een geldig token en kunnen CORS/proxy-ondersteuning nodig hebben. Als de call faalt toont de UI veilige mock-data zodat je de flow kunt demonstreren.
