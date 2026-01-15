// --- BATTERY OPTIMIZATION HELPERS ---

window.requestBatteryPerm = function() {
    // FIX: Grab plugin dynamically to solve initialization race condition
    const svc = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ResolverService) ? window.Capacitor.Plugins.ResolverService : ResolverService;

    if (svc) {
        svc.requestBatteryOpt();
    } else {
        console.log("ResolverService plugin not found");
    }

    localStorage.setItem('bojroBatteryOpt', 'true');
    document.getElementById('batteryModal').classList.add('hidden');
    if (Toast) Toast.show({
        text: 'Opening Settings...',
        duration: 'short'
    });
}

window.skipBatteryPerm = function() {
    localStorage.setItem('bojroBatteryOpt', 'true');
    document.getElementById('batteryModal').classList.add('hidden');
}

// --- QUEUE PERSISTENCE HELPERS ---

function loadQueueState() {
    const saved = localStorage.getItem('bojroQueueState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.ongoing) queueState.ongoing = parsed.ongoing;
            if (parsed.next) queueState.next = parsed.next;
            if (parsed.completed) queueState.completed = parsed.completed;
            updateQueueBadge();
        } catch (e) {}
    }
}

function saveQueueState() {
    localStorage.setItem('bojroQueueState', JSON.stringify(queueState));
    updateQueueBadge();
}

function updateQueueBadge() {
    const totalPending = queueState.ongoing.length + queueState.next.length;
    const badge = document.getElementById('queueBadge');
    if (badge) {
        badge.innerText = totalPending;
        badge.classList.toggle('hidden', totalPending === 0);
    }
}

// --- NOTIFICATIONS & BACKGROUND ---

async function createNotificationChannel() {
    if (!LocalNotifications) return;
    try {
        await LocalNotifications.createChannel({
            id: 'gen_complete_channel',
            name: 'Generation Complete',
            importance: 4,
            visibility: 1,
            vibration: true
        });
        await LocalNotifications.createChannel({
            id: 'batch_channel',
            name: 'Generation Status',
            importance: 2,
            visibility: 1,
            vibration: false
        });
    } catch (e) {}
}

function setupBackgroundListeners() {
    if (!App) return;
    App.addListener('resume', async () => {
        if (LocalNotifications) {
            try {
                const pending = await LocalNotifications.getPending();
                if (pending.notifications.length > 0) await LocalNotifications.cancel(pending);
            } catch (e) {}
        }
        // Only auto-connect if we don't have models loaded
        if (document.getElementById('hostIp').value) {
            window.connect(true);
        }
    });
}

let lastNotifTime = 0; // Tracks the last time we updated Android
let lastProgress = -1; // Tracks the last progress % we sent

async function updateBatchNotification(title, force = false, body = "") {
    let progressVal = 0;
    
    // 1. Calculate Progress %
    try {
        if (body && body.includes(" / ")) {
            const parts = body.split(" / ");
            const current = parseInt(parts[0].replace(/\D/g, '')) || 0;
            const total = parseInt(parts[1].replace(/\D/g, '')) || 1;
            if (total > 0) progressVal = Math.floor((current / total) * 100);
        }
    } catch (e) {
        progressVal = 0;
    }

    // 2. THROTTLING LOGIC (The Fix)
    const now = Date.now();
    // Only update if:
    // a. 'force' is true (e.g., Generation is Done)
    // b. OR it has been more than 1000ms (1 second) since the last update
    // c. OR progress is 0% (Start) or 100% (Finish)
    if (!force && (now - lastNotifTime < 1000) && progressVal !== 0 && progressVal !== 100) {
        return; // SKIP this update (Prevent freezing)
    }

    // 3. Update the Timers
    lastNotifTime = now;
    lastProgress = progressVal;

    // 4. Send to Native Service (Safely)
    // We check multiple places where the plugin might exist
    const svc = (typeof ResolverService !== 'undefined' ? ResolverService : null) || 
                (window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins.ResolverService : null);

    if (svc) {
        try {
            await svc.updateProgress({
                title: title,
                body: body,
                progress: progressVal
            });
        } catch (e) {
            console.error("Native Service Error:", e);
        }
    }
}

async function sendCompletionNotification(msg) {
    if (LocalNotifications) {
        try {
            await LocalNotifications.schedule({
                notifications: [{
                    title: "Mission Complete",
                    body: msg,
                    id: 2002,
                    channelId: 'gen_complete_channel',
                    smallIcon: "ic_launcher"
                }]
            });
        } catch (e) {}
    }
}

// --- FILE SYSTEM & NETWORK UTILS ---

const getHeaders = () => ({
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
});

async function saveToMobileGallery(base64Data) {
    try {
        const isNative = window.Capacitor && window.Capacitor.isNative;
        if (isNative) {
            const cleanBase64 = base64Data.split(',')[1];
            const fileName = `Bojro_${Date.now()}.png`;
            try {
                await Filesystem.mkdir({
                    path: 'Resolver',
                    directory: 'DOCUMENTS',
                    recursive: false
                });
            } catch (e) {}
            await Filesystem.writeFile({
                path: `Resolver/${fileName}`,
                data: cleanBase64,
                directory: 'DOCUMENTS'
            });
            if (Toast) await Toast.show({
                text: 'Image saved to Documents/Resolver',
                duration: 'short',
                position: 'bottom'
            });
        } else {
            const link = document.createElement('a');
            link.href = base64Data;
            link.download = `Bojro_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (e) {
        console.error("Save failed", e);
    }
}

// *** FIXED VRAM PROFILE LOGIC FOR FLUX (12GB 3060) ***
function getVramMapping() {
    const profile = document.getElementById('vramProfile').value;
    switch (profile) {
        case 'low':
            // "Neo" Safety Mode: Reserves 6GB.
            return 6144; 
        case 'mid':
            // "Goldilocks Zone": Reserves 4.5 GB.
            return 4608; 
        case 'high':
            // "Risky": Reserves 1GB.
            return 1024; 
        default:
            return 4608;
    }
}

// --- DATABASE (IndexedDB) ---

// Wrapper function to initialize DB (called in boot.js)
function initDatabase() {
    const request = indexedDB.open("BojroHybridDB", 2)
    request.onupgradeneeded = e => {
        db = e.target.result;
        if (!db.objectStoreNames.contains("images")) {
            db.createObjectStore("images", { keyPath: "id", autoIncrement: true });
        }

        if (!db.objectStoreNames.contains("comfy_templates")) {
            db.createObjectStore("comfy_templates", { keyPath: "name" });
        }
    };
    request.onsuccess = e => {
        db = e.target.result;
        // Call loadGallery if it exists (it will be in engine.js)
        if (typeof loadGallery === 'function') {
            loadGallery();
        }
    };
}

function saveImageToDB(base64) {
    return new Promise((resolve, reject) => {
        if (!db) {
            resolve(null);
            return;
        }
        const tx = db.transaction(["images"], "readwrite");
        const store = tx.objectStore("images");
        const req = store.add({
            data: base64,
            date: new Date().toLocaleString()
        });
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
    });
}

window.clearDbGallery = function() {
    if (confirm("Delete entire history? This cannot be undone.")) {
        const tx = db.transaction(["images"], "readwrite");
        tx.objectStore("images").clear();
        tx.oncomplete = () => {
            isSelectionMode = false;
            selectedImageIds.clear();
            document.getElementById('galDeleteBtn').classList.add('hidden');
            galleryPage = 1;
            if (typeof loadGallery === 'function') loadGallery();
        };
    }
}

// --- METADATA UTILS ---

async function readPngMetadata(blob) {
    try {
        const buffer = await blob.arrayBuffer();
        const view = new DataView(buffer);
        let offset = 8;
        let metadata = "";
        while (offset < view.byteLength) {
            const length = view.getUint32(offset);
            const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
            if (type === 'tEXt') {
                const data = new Uint8Array(buffer, offset + 8, length);
                metadata += new TextDecoder().decode(data) + "\n";
            }
            if (type === 'iTXt') {
                const data = new Uint8Array(buffer, offset + 8, length);
                const text = new TextDecoder().decode(data);
                metadata += text + "\n";
            }
            offset += 12 + length;
        }
        metadata = metadata.trim();
        if (!metadata) return null;
        metadata = metadata.replace(/^parameters\0/, '');
        return metadata;
    } catch (e) {
        console.error("Metadata read error:", e);
        return null;
    }
}

function parseGenInfo(rawText) {
    if (!rawText) return {
        pos: "",
        neg: ""
    };
    let pos = "";
    let neg = "";
    const negSplit = rawText.split("Negative prompt:");
    if (negSplit.length > 1) {
        pos = negSplit[0].trim();
        const paramsSplit = negSplit[1].split(/(\nSteps: |Steps: )/);
        if (paramsSplit.length > 1) {
            neg = paramsSplit[0].trim();
        } else {
            neg = negSplit[1].trim();
        }
    } else {
        const paramSplit = rawText.split(/(\nSteps: |Steps: )/);
        if (paramSplit.length > 1) {
            pos = paramSplit[0].trim();
        } else {
            pos = rawText.trim();
        }
    }
    return {
        pos,
        neg
    };
}

function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
}

window.openExternalLink = async function(url) {
    if (window.Capacitor && window.Capacitor.isNative && Browser) {
        try {
            await Browser.open({ url: url });
        } catch (e) {
            console.error("Browser plugin failed:", e);
            window.open(url, '_system');
        }
    } else {
        window.open(url, '_blank');
    }
};