package com.resolver.client;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ResolverService")
public class ResolverServicePlugin extends Plugin {

    @PluginMethod()
    public void updateProgress(PluginCall call) {
        String title = call.getString("title", "Processing");
        String body = call.getString("body", "Preparing..."); // Get body text
        int progress = call.getInt("progress", 0);

        // Pass 'body' to the service
        ResolverForegroundService.startOrUpdateService(getContext(), title, body, progress);
        
        call.resolve();
    }
    
    @PluginMethod()
    public void stop(PluginCall call) {
        ResolverForegroundService.stopService(getContext());
        call.resolve();
    }
}