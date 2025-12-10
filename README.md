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

<table>
  <tr>
    <td align="center"><img src="https://github.com/user-attachments/assets/d1c9e8e9-0028-4200-a7cd-34e6a3ff3688" width="200px" /><br /><b>Splash / Home</b></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/47d87dd3-1380-4502-a6b4-4becfa6597de" width="200px" /><br /><b>Generation UI</b></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/5238bf4c-eb40-4b18-9eec-0a4dee6c13b0" width="200px" /><br /><b>Flux Mode</b></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/5ed2bf1b-6966-45f5-b1cd-420b32b2898d" width="200px" /><br /><b>SDXL Settings</b></td>
  </tr>
  <tr>
    <td align="center"><img src="https://github.com/user-attachments/assets/397420f4-43a5-4ccf-8efa-90f9b7c4b817" width="200px" /><br /><b>Queue System</b></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/a34962b8-3a53-417d-9e50-0bc0335b63b7" width="200px" /><br /><b>Gallery View</b></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/6f21e813-d8b6-4275-8797-d92899f3a189" width="200px" /><br /><b>Lightbox</b></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/37e032ca-eff7-4be7-89d1-d0598078a792" width="200px" /><br /><b>Metadata Reader</b></td>
  </tr>
</table>

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
