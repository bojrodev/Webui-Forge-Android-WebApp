package com.resolver.client;

import android.os.Bundle;
import android.os.PowerManager;
import android.content.Context;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register your custom plugin so Capacitor can find it
        registerPlugin(ResolverServicePlugin.class);

        super.onCreate(savedInstanceState);
        
        // KEEPING: Partial WakeLock (CPU stays on when screen goes off)
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Resolver:BatchWakeLock");
            wakeLock.acquire(); 
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // Release the wake lock to save battery when app is fully killed
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }
}