# WebUI Forge Mobile WebApp by Bojro Dev.

A custom-built Capacitor Standalone Web App designed to act as a mobile-friendly remote control for Stable Diffusion WebUI Forge with built in Metadata reader.

## ⚡ The Problem
The default interface for Stable Diffusion is designed for desktop mouse usage and does not scale well to mobile screens. Additionally, managing server-side files from a phone is typically impossible due to browser sandboxing security.

## ⛈ The Solution
We built a "Vanilla" JavaScript application that interfaces with the Stable Diffusion Forge API. It features:
* **Mobile-First Design:** A responsive, dark-mode UI optimized for touch.
* **Flux Support:** Supported!
* **SDXL Support:** Supported!
* **Capablities:** Can be installed natively on Android.

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (No frameworks). Capacitor for App.
* **Backend:**Stable Diffusion API.
* **Communication:** REST API, Fetch, CORS.

## 📦 How to Run
1.  **Configure PC:** Launch Stable Diffusion Forge with `--listen --api --cors-allow-origins *` on Command line arguement on webui-user.bat.
2.  **Launch App:** Download apk from releases section

## ©redit
1.  **Backend & Communication:** BojroDev
2.  **Frontend:** Marjuk06
