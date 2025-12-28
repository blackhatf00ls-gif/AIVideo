# AIVideo

Een eenvoudige iOS-webgeoptimaliseerde livestream demo op basis van WebRTC. De app vraagt om camera- en microfoonrechten, toont je eigen stream en levert een viewer-voorbeeld via een lokale peer-verbinding.

## Gebruik
1. Open `index.html` lokaal of via een statische host (bijv. `python -m http.server`).
2. Klik op **Start livestream** en sta camera- en microfoonrechten toe op je iPhone.
3. Schakel tussen de front- en backcamera, zet microfoon of camera uit en bekijk de viewer-preview.

> Voor echte kijkers voeg je eigen signalling toe tussen de `RTCPeerConnection`-objecten.
