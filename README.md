# Resolver: Native Android Client for WebUI Forge (SDXL & Flux)

![License](https://img.shields.io/github/license/bojrodev/webui-forge-android-webapp)
![Platform](https://img.shields.io/badge/Platform-Android-green)
![Tech](https://img.shields.io/badge/Tech-Capacitor%20%7C%20VanillaJS-blue)

**Resolver** is a high-performance, native Android wrapper specifically optimized for **Stable Diffusion WebUI Forge**. Unlike standard browser usage, this app utilizes native Android Foreground Services to keep your generation queue running even when your phone screen is off.

> **Note:** This is a standalone client. You must have [Stable Diffusion WebUI Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge) running on your PC.

## 🚀 Key Features

* **Background Generation Service:** Uses a native Java Foreground Service (`ResolverForegroundService`) and Wake Locks to prevent Android from killing the app during long batch generations.
* **Flux & SDXL Support:** Fully optimized UI for Flux GGUF flows and SDXL pipelines.
* **Queue Management:** Add prompts to a batch queue and let them run while you multitask.
* **Metadata Reader:** Built-in PNG Info reader to extract prompt parameters from generated images.
* **Mobile-First UI:** A Cyberpunk-inspired interface designed specifically for touchscreens (no more zooming into desktop UIs).
* **Local Gallery:** Saves images directly to your device's documents folder.

## 📸 Screenshots
*(PLACEHOLDER: Upload 2-3 screenshots of your app here. Use the `style.css` distinct look to show off the Cyberpunk/Flux themes. Visuals are CRITICAL for clicks.)*

## 🛠️ Tech Stack

This project demonstrates a hybrid approach, combining the speed of web technologies with the power of native Android APIs.

* **Frontend:** Vanilla JavaScript (No heavy frameworks), HTML5, CSS3.
* **Native Bridge:** Capacitor 6.0.
* **Android Native:** Java (Custom `ResolverForegroundService` and `WakeLock` implementation).
* **Communication:** Direct API calls to SD WebUI Forge (`--api`).

## 🔧 Installation & Setup

1.  **Prepare your PC:**
    * Open `webui-user.bat` in your Forge installation.
    * Add the arguments: `--listen --api --cors-allow-origins *`
    * Run Forge.

2.  **Install the App:**
    * Download the latest APK from the [Releases Page](#).
    * Or build from source (see below).

3.  **Connect:**
    * Open Resolver.
    * Enter your PC's Local IP (e.g., `http://192.168.1.5:7860`).
    * Click **LINK**.

## 💻 Build from Source

```bash
# Clone the repo
git clone [https://github.com/bojrodev/webui-forge-android-webapp.git](https://github.com/bojrodev/webui-forge-android-webapp.git)

# Install dependencies
npm install

# Sync Capacitor
npx cap sync

# Open in Android Studio
npx cap open android
