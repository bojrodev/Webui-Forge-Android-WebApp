# WebUI Forge PWA WebApp by Bojro Dev.

A custom-built Progressive Web App (PWA) designed to act as a mobile-friendly remote control for Stable Diffusion WebUI Forge with built in Metadata reader.

## 🚀 The Problem
The default interface for Stable Diffusion is designed for desktop mouse usage and does not scale well to mobile screens. Additionally, managing server-side files from a phone is typically impossible due to browser sandboxing security.

## 💡 The Solution
I built a "Vanilla" JavaScript application that interfaces with the Stable Diffusion API. It features:
* **Mobile-First Design:** A responsive, dark-mode UI optimized for touch.
* **Python Sidecar:** A custom Python script (`vae_sidecar.py`) that bridges the browser's security sandbox, allowing the web app to scan and list files on the host PC's hard drive.
* **Flux Support:** Still none! Working on it.
* * **SDXL Support:** Supported!
* **PWA Capable:** Can be installed natively on Android/iOS home screens.

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (No frameworks).
* **Backend:** Python (Sidecar script), Stable Diffusion API.
* **Communication:** REST API, Fetch, CORS.

## 📦 How to Run
1.  **Configure PC:** Launch Stable Diffusion Forge with `--listen --api --cors-allow-origins *` on Command line arguement on webui-user.bat.
2.  **Run Sidecar:** Edit `python vae_sidecar.py` with your favourite ide and change the Vae path to your webui's Vae location, then save & Run `python vae_sidecar.py` on the PC to enable file scanning.
3.  **Launch App:** Open `index.html` on any device on the same Wi-Fi network.
