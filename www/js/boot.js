// -----------------------------------------------------------
// APPLICATION ENTRY POINT
// -----------------------------------------------------------

window.onload = function() {
    try {
        console.log("Booting Resolver...");

        // 1. Initialize Icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Battery Optimization Check
        if (!localStorage.getItem('bojroBatteryOpt')) {
            const batteryModal = document.getElementById('batteryModal');
            if (batteryModal) {
                batteryModal.classList.remove('hidden');
                console.log("Battery Modal Triggered");
            }
        }

        // 2. Initialize Database
        if (typeof initDatabase === 'function') {
            initDatabase();
        }

        // 3. Load Centralized Configuration
        loadConnectionConfig();    // cfg.js
        
        // 4. First-Run Check
        if (!connectionConfig.isConfigured) {
            console.log("First run detected - showing configuration");
            setTimeout(() => {
                switchTab('cfg');
                if (typeof Toast !== 'undefined') Toast.show({
                    text: 'Welcome! Please configure your connection settings',
                    duration: 'long',
                    position: 'center'
                });
            }, 500);
        }
        
        // 5. Load Saved Settings & State
        if (typeof injectConfigModal === 'function') injectConfigModal();
        if (typeof loadHostIp === 'function') loadHostIp();
        if (typeof loadQueueState === 'function') loadQueueState();
        if (typeof renderQueueAll === 'function') renderQueueAll();
        if (typeof loadAutoDlState === 'function') loadAutoDlState();
        if (typeof loadLlmSettings === 'function') loadLlmSettings();
        if (typeof loadPowerSettings === 'function') loadPowerSettings();
        if (typeof loadSavedPrompts === 'function') loadSavedPrompts();

        // 6. Setup Background & Notifications
        if (typeof setupBackgroundListeners === 'function') setupBackgroundListeners();
        if (typeof createNotificationChannel === 'function') createNotificationChannel();

        // 7. Initialize Graphics Engine
        if (typeof initMainCanvas === 'function') initMainCanvas();
        if (typeof setupEditorEvents === 'function') setupEditorEvents();
        
        // 8. Request Capacitor Notification Access (Android) - System Check
        if (typeof LocalNotifications !== 'undefined' && LocalNotifications) {
            LocalNotifications.checkPermissions().then(perm => {
                console.log("Notification Perm Status:", perm.display);
            }).catch(e => console.warn("Notif check failed:", e));
        }
        
        // 9. Acquire Wake Lock
        if ("wakeLock" in navigator) {
            navigator.wakeLock.request('screen').then(wakeLock => {
                console.log("Wake lock acquired");
                globalWakeLock = wakeLock;
            }).catch(error => {
                console.log("Wake lock not available:", error);
            });
        } else {
            console.log("Wake Lock API not supported");
        }
        
        // 10. Acquire WiFi Lock
        if ('connection' in navigator && 'saveData' in navigator.connection) {
            try {
                navigator.connection.saveData = false;
                console.log("WiFi lock enabled");
            } catch (error) {
                console.log("WiFi lock not available:", error);
            }
        }
        
        // 11. Release locks on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && globalWakeLock) {
                globalWakeLock.release();
                globalWakeLock = null;
            }
        });

        // 12. Auto-Connect
        if (connectionConfig.isConfigured && connectionConfig.baseIp) {
            console.log("Auto-connecting...");
            window.connect(true);
        } else if (document.getElementById('hostIp') && document.getElementById('hostIp').value) {
            window.connect(true);
        }

        // =========================================================================
        // 13. SPA NAVIGATION OVERRIDE (CRITICAL FOR SEAMLESS COMFYUI)
        // =========================================================================
        window.switchTab = function(view) {
            // List of all valid view IDs
            const views = ['gen', 'inp', 'que', 'gal', 'ana', 'cfg', 'comfy'];
            
            // 1. Hide all views and deactivate all dock items
            views.forEach(v => {
                const el = document.getElementById('view-' + v);
                if (el) el.classList.add('hidden');
                
                const dock = document.getElementById('dock-' + v);
                if (dock) dock.classList.remove('active');
            });

            // 2. Show the selected view
            const target = document.getElementById('view-' + view);
            if (target) target.classList.remove('hidden');
            
            const targetDock = document.getElementById('dock-' + view);
            if (targetDock) targetDock.classList.add('active');

            // --- RESTORED MISSING LOGIC START ---
            if (view === 'gen') currentTask = 'txt';
            if (view === 'inp') {
                currentTask = 'inp';
                // Trigger Inpaint Sampler default check if needed (ported from ui.js)
                const inpSamplerEl = document.getElementById('inp_sampler');
                if (inpSamplerEl && !localStorage.getItem('bojro_inp_sampler')) {
                     inpSamplerEl.value = "DPM++ 2M SDE";
                }
            }
            // --- RESTORED MISSING LOGIC END ---

            // 3. Trigger specific view logic
            if (view === 'cfg') loadConnectionConfig();
            if (view === 'gal' && typeof loadGallery === 'function') loadGallery();
            
            // 4. Auto-Connect ComfyUI if opened and not connected
            if (view === 'comfy' && typeof connectToComfy === 'function') {
                // Only connect if we have a host but no active socket
                const savedHost = localStorage.getItem('comfyHost');
                if(savedHost && (!window.comfySocket || window.comfySocket.readyState !== WebSocket.OPEN)) {
                    // Slight delay to allow UI to render
                    setTimeout(connectToComfy, 100); 
                }
            }
        };

        // =========================================================================
        // 14. NEO BRIDGE
        // =========================================================================
        if (!window.Neo) window.Neo = {};
        
        window.Neo.appInjectConfig = async function(alias, name, textArea) {
            const loraEntry = window.LoraManager && window.LoraManager.allLoras 
                ? window.LoraManager.allLoras.find(l => l.name === name) 
                : null;

            let config = loraConfigs[name];

            if (!config && loraEntry && loraEntry.path) {
                if (typeof Toast !== 'undefined') Toast.show({ text: 'Fetching config...', duration: 'short' });
                config = await loadSidecarConfig(name, loraEntry.path);
            }

            const weight = config ? config.weight : 1.0;
            const trigger = config && config.trigger ? ` ${config.trigger}` : "";
            const tag = ` <lora:${alias}:${weight}>${trigger}`;

            if (!textArea.value.includes(`<lora:${alias}:`)) {
                textArea.value = textArea.value.trim() + tag;
                if (typeof Toast !== 'undefined') Toast.show({ text: `Added ${alias}`, duration: 'short' });
            } else {
                if (typeof Toast !== 'undefined') Toast.show({ text: `Already added`, duration: 'short' });
            }

            const loraModal = document.getElementById('loraModal');
            if (loraModal) loraModal.classList.add('hidden');
        };

        // --- 15. HANDLE HASH NAVIGATION (Fallback) ---
        const hash = window.location.hash.replace('#', '');
        if (hash && ['gen','inp','que','gal','ana','cfg','comfy'].includes(hash)) {
            setTimeout(() => switchTab(hash), 150);
        }

        // =========================================================================
        // 16. SILENT AUTO-UPDATE CHECK
        // =========================================================================
        setTimeout(() => {
            if (typeof checkForAppUpdate === 'function') {
                console.log("Boot: Running silent update check...");
                checkForAppUpdate(true); // <--- TRUE means "Silent Mode"
            }
        }, 3000); // Waits 3 seconds after boot

        console.log("App Initialized Successfully");
    } catch (e) {
        console.error("Initialization Error:", e);
        alert("App Init Failed: " + e.message);
    }
}

// --- BACKGROUND RELIABILITY HACK ---
// We need to play the silent audio once the user touches the screen.
// This "unlocks" the audio engine so it can keep running in the background.
function unlockAudioContext() {
    var audio = document.getElementById('keepAliveAudio');
    if (audio) {
        audio.play().then(() => {
            console.log("Background audio hack activated.");
        }).catch(e => {
            console.warn("Audio autoplay blocked (waiting for interaction):", e);
        });
    }
    // Remove listener after first successful interaction
    document.removeEventListener('click', unlockAudioContext);
    document.removeEventListener('touchstart', unlockAudioContext);
}

// Listen for the first click or touch anywhere in the app
document.addEventListener('click', unlockAudioContext);
document.addEventListener('touchstart', unlockAudioContext);    