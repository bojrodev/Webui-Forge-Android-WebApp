package com.resolver.client;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ResolverService")
public class ResolverServicePlugin extends Plugin {

    // This method is called from JavaScript (updateNativeServiceStatus)
    @PluginMethod()
    public void updateProgress(PluginCall call) {
        String title = call.getString("title", "Processing");
        int progress = call.getInt("progress", 0);

        // Start the service if it's a new job, or update if running
        ResolverForegroundService.startOrUpdateService(getContext(), title, progress);
        
        call.resolve();
    }
    
    @PluginMethod()
    public void stop(PluginCall call) {
        // Stop the service (called when generation completes)
        ResolverForegroundService.stopService(getContext());
        call.resolve();
    }
}