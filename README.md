# Resolver: Native Android Client for WebUI Forge (Flux, SDXL & Qwen)

![Version](https://img.shields.io/badge/Version-1.1-purple.svg)
![Platform](https://img.shields.io/badge/Platform-Android%2010+-green.svg)
![Backend](https://img.shields.io/badge/Backend-Forge%20Neo-blue)
![License](https://img.shields.io/badge/License-GPLv3-red.svg)

**Resolver** is the ultimate **native Android interface** for [Stable Diffusion WebUI Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo).

Unlike standard browser wrappers, Resolver utilizes **Native Android Foreground Services** and Wake Locks. This ensures your image generation queue continues processing background tasks (batch generations, huge Flux GGUF workflows) even when your phone screen is off or the app is minimized.

> **✨ Major Update (v1.1):** Now supporting **Flux GGUF**, **SDXL**, and **Qwen (Z-Image Turbo)** pipelines with a dedicated LoRA Management System and Local LLM integration.

---

## 🚀 Key Features

### ⚡ Power & Performance
* **True Background Service:** Runs a native Java Foreground Service to keep the WebSocket connection alive. Your long batch queues won't die when your phone sleeps.
* **Hybrid Architecture:** Built with Capacitor 6.0, combining the fluidity of Vanilla JS with native Android file system and networking capabilities.

### 🎨 Advanced Model Support
* **Flux GGUF Optimized:** Dedicated UI for Flux including selectors for **VAE, CLIP, T5**, and specific **Quantization Bits** (bnb-nf4, fp8-e4m3fn, etc.).
* **Qwen / Z-Image Turbo:** New "Turbo Generate" mode specifically tuned for Qwen models with specialized sampler overrides (LCM/Normal).
* **SDXL Powerhouse:** Full control over SDXL sampling, scheduling, and resolution with aspect ratio locking.

### 🧠 Smart Features
* **Neo Bridge LoRA Manager:**
    * **Smart Thumbnails:** Automatically fetches and caches preview images locally.
    * **Folder Management:** Browse by folder and "Heart" favorites for quick access via the filter bar.
    * **Config Injection:** Set preferred weights and trigger words that auto-inject into your prompt.
* **Magic Prompt (LLM Integration):** Connect to a local LLM (like LM Studio or Ollama) to expand simple ideas into complex, detailed prompts within the app.
* **Mobile Inpainting:** Full canvas editor with Draw/Erase, Soft Inpaint, Mask Blur, and Denoising strength sliders. Touch-optimized.

### 📂 Workflow & Gallery
* **Batch Queue:** Drag-and-drop queue management (Ongoing, Next, Completed).
* **Metadata Analyzer:** Built-in PNG Info reader. One-tap "Use in Flux" or "Use in SDXL" to copy parameters from history.
* **Local Storage:** Saves high-res images directly to your Android device's Documents folder.

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/73bc7ab2-47ea-4598-9757-c86be9ad03c7" width="200" /><br />
      <b>Home / SDXL</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/e132a4d3-e33a-479f-af4a-566bd81b04a5" width="200" /><br />
      <b>Flux UI</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/4147b392-b351-4e70-8716-38c4c2e7cc30" width="200" /><br />
      <b>LoRA Manager</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/b489e035-32e3-4392-87b8-fbcfde706134" width="200" /><br />
      <b>Inpainting</b>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/38ab45ce-663c-4b45-91e8-ba77be3f67d9" width="200" /><br />
      <b>Qwen Turbo</b>
    </td>
  </tr>
</table>

---

## 🔌 The "Power Button" Feature

Resolver includes a remote wake/shutdown feature, allowing you to turn on your PC or wake your server directly from the app header.

**⚠️ Requirement:** This feature requires a lightweight helper application running on your PC.

**How to set it up:**

1.  **Download the Helper:** Go to the [Releases Page](#) and download `Resolver-Power-Server.exe`.
2.  **Run on PC:** Execute the file on the PC where WebUI Forge is installed. It will act as a listener for the mobile signal.
3.  **Configure App:**
    * Open Resolver on your Android device.
    * Tap the **Settings Gear** icon next to the Power Button (⚡) in the header.
    * Enter the Local IP address shown in the helper app console (e.g., `http://192.168.1.5:5000`).
    * Click **Save**.
4.  **Usage:** Simply tap the Power Button in the app header to send a Wake/Start signal to your PC.

---

## 🛠️ Installation & Setup

### 1. Install "Forge Neo" (PC)
This app is strictly optimized for **Forge Neo** (Haoming02's branch), which supports Qwen, Z-Image, and Wan 2.2 models. Standard Forge may lack the necessary API endpoints for these features.

1.  Clone the **Neo** branch of WebUI Forge:
    ```bash
    git clone [https://github.com/Haoming02/sd-webui-forge-classic](https://github.com/Haoming02/sd-webui-forge-classic) sd-webui-forge-neo --branch neo
    ```
2.  Edit your `webui-user.bat` file in the new folder.
3.  Add the following to `COMMANDLINE_ARGS`:
    ```bat
    --listen --api --cors-allow-origins *
    ```
4.  Run `webui-user.bat`.

### 2. Install Resolver (Android)
* Download the latest `.apk` from the **[Releases Page](#)**.
* Install on your Android device.

### 3. Link the App
1.  Ensure your phone and PC are on the same Wi-Fi network.
2.  Open Resolver.
3.  Enter your PC's Local IP address (e.g., `http://192.168.1.10:7860`).
4.  Tap **LINK**. The status dot will turn **Green**.

---

## 🤖 Magic Prompt (LLM) Setup

To use the "Magic Prompt" feature to auto-expand your prompts:

1.  Run a local LLM server (e.g., **LM Studio** or **Ollama**).
2.  Ensure it is serving on a local IP (e.g., `http://192.168.1.10:1234`).
3.  In Resolver, tap the **Bot Icon** next to the prompt box.
4.  Open the settings panel inside the modal.
5.  Enter your LLM Server URL and tap **Connect**.
6.  Select your model and start generating prompts!

---

## 💻 Building from Source

If you want to modify the code or contribute:

```bash
# Clone the repository
git clone [https://github.com/bojrodev/webui-forge-android-webapp.git](https://github.com/bojrodev/webui-forge-android-webapp.git)

# Install NPM dependencies
npm install

# Sync Capacitor with Android project
npx cap sync

# Open the Android Project in Android Studio
npx cap open android
