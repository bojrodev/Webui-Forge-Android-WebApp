package com.resolver.client;

import android.os.Bundle;
import android.os.PowerManager;
import android.content.Context;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ResolverServicePlugin.class);
        super.onCreate(savedInstanceState);
        
        // Acquire Partial WakeLock (CPU Keep Alive)
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Resolver:BatchWakeLock");
            wakeLock.acquire(); 
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // CRITICAL FIX:
        // When app goes to background, Android pauses WebView timers (JS stops).
        // Since we have a Foreground Service running, we can force timers to resume
        // so 'setInterval' in app.js keeps firing.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }
}