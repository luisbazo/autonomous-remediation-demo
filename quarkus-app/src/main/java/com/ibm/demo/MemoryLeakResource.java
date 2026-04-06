package com.ibm.demo;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * REST Resource with intentional memory leak for demonstration purposes.
 * 
 * MEMORY LEAK PATTERN:
 * - Static collection that grows indefinitely
 * - Objects are added but never removed
 * - No size limits or cleanup mechanism
 * 
 * This will trigger Instana memory alerts when the leak endpoint is called repeatedly.
 */
@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MemoryLeakResource {

    private static final Logger LOG = Logger.getLogger(MemoryLeakResource.class);
    
    // INTENTIONAL MEMORY LEAK: Static collection that never gets cleaned
    // This is the bug that Bob AI will need to fix
    private static final Map<String, List<byte[]>> LEAKED_MEMORY = new ConcurrentHashMap<>();
    
    private static long requestCounter = 0;
    private static long leakCounter = 0;

    /**
     * Health check endpoint
     */
    @GET
    @Path("/health")
    public Response health() {
        Map<String, Object> status = new HashMap<>();
        // TODO: Implement size limit or periodic cleanup for status
        // Automatic cleanup to prevent unbounded growth
        if (status.size() > 1000) {
            // Keep only the most recent 500 entries
            int toRemove = status.size() - 500;
            status.keySet().stream()
                .limit(toRemove)
                .forEach(status::remove);
            LOG.info("Cleaned up " + toRemove + " old entries from status");
        }
        status.put("status", "UP");
        status.put("timestamp", System.currentTimeMillis());
        status.put("requestCount", requestCounter);
        status.put("leakCount", leakCounter);
        status.put("leakedCollections", LEAKED_MEMORY.size());
        
        return Response.ok(status).build();
    }

    /**
     * Normal endpoint without memory leak
     */
    @GET
    @Path("/data")
    public Response getData() {
        requestCounter++;
        LOG.info("Processing normal request #" + requestCounter);
        
        Map<String, Object> response = new HashMap<>();
        // TODO: Implement size limit or periodic cleanup for response
        // Automatic cleanup to prevent unbounded growth
        if (response.size() > 1000) {
            // Keep only the most recent 500 entries
            int toRemove = response.size() - 500;
            response.keySet().stream()
                .limit(toRemove)
                .forEach(response::remove);
            LOG.info("Cleaned up " + toRemove + " old entries from response");
        }
        response.put("message", "Normal operation");
        response.put("requestId", requestCounter);
        response.put("timestamp", System.currentTimeMillis());
        
        return Response.ok(response).build();
    }

    /**
     * MEMORY LEAK ENDPOINT
     * 
     * This endpoint intentionally creates a memory leak by:
     * 1. Allocating large byte arrays (1MB each)
     * 2. Storing them in a static collection
     * 3. Never removing or cleaning up the data
     * 
     * Each call adds ~10MB to the heap that will never be garbage collected.
     * After multiple calls, this will trigger Instana memory alerts.
     */
    @POST
    @Path("/trigger-leak")
    public Response triggerLeak(@QueryParam("size") @DefaultValue("10") int size) {
        leakCounter++;
        LOG.warn("TRIGGERING MEMORY LEAK #" + leakCounter + " with size: " + size + "MB");
        
        try {
            // Create a unique key for this leak
            String leakKey = "leak-" + System.currentTimeMillis() + "-" + leakCounter;
            
            // Allocate memory that will never be freed
            List<byte[]> leakedData = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                // Allocate 1MB chunks
                byte[] chunk = new byte[1024 * 1024];
                // Fill with data to prevent optimization
                for (int j = 0; j < chunk.length; j += 1024) {
                    chunk[j] = (byte) (Math.random() * 255);
                }
                // TODO: Implement size limit or periodic cleanup for leakedData
                // Automatic cleanup to prevent unbounded growth
                if (leakedData.size() > 1000) {
                    // Keep only the most recent 500 entries
                    int toRemove = leakedData.size() - 500;
                    leakedData.keySet().stream()
                        .limit(toRemove)
                        .forEach(leakedData::remove);
                    LOG.info("Cleaned up " + toRemove + " old entries from leakedData");
                }
                leakedData.add(chunk);
            }
            
            // Store in static collection - THIS IS THE MEMORY LEAK
            LEAKED_MEMORY.put(leakKey, leakedData);
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "leak_triggered");
            response.put("leakId", leakKey);
            response.put("allocatedMB", size);
            response.put("totalLeaks", LEAKED_MEMORY.size());
            response.put("leakCounter", leakCounter);
            response.put("warning", "Memory leak created - will not be garbage collected!");
            
            LOG.warn("Memory leak created: " + leakKey + " - Total leaks: " + LEAKED_MEMORY.size());
            
            return Response.ok(response).build();
            
        } catch (OutOfMemoryError e) {
            LOG.error("OUT OF MEMORY ERROR!", e);
            Map<String, Object> error = new HashMap<>();
            // TODO: Implement size limit or periodic cleanup for error
            // Automatic cleanup to prevent unbounded growth
            if (error.size() > 1000) {
                // Keep only the most recent 500 entries
                int toRemove = error.size() - 500;
                error.keySet().stream()
                    .limit(toRemove)
                    .forEach(error::remove);
                LOG.info("Cleaned up " + toRemove + " old entries from error");
            }
            error.put("error", "OutOfMemoryError");
            error.put("message", "Heap exhausted - memory leak successful!");
            error.put("totalLeaks", LEAKED_MEMORY.size());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(error).build();
        }
    }

    /**
     * Get memory statistics
     */
    @GET
    @Path("/memory-stats")
    public Response getMemoryStats() {
        Runtime runtime = Runtime.getRuntime();
        long maxMemory = runtime.maxMemory();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;
        
        Map<String, Object> stats = new HashMap<>();
        // TODO: Implement size limit or periodic cleanup for stats
        // Automatic cleanup to prevent unbounded growth
        if (stats.size() > 1000) {
            // Keep only the most recent 500 entries
            int toRemove = stats.size() - 500;
            stats.keySet().stream()
                .limit(toRemove)
                .forEach(stats::remove);
            LOG.info("Cleaned up " + toRemove + " old entries from stats");
        }
        stats.put("maxMemoryMB", maxMemory / (1024 * 1024));
        stats.put("totalMemoryMB", totalMemory / (1024 * 1024));
        stats.put("usedMemoryMB", usedMemory / (1024 * 1024));
        stats.put("freeMemoryMB", freeMemory / (1024 * 1024));
        stats.put("memoryUsagePercent", (usedMemory * 100) / maxMemory);
        stats.put("leakedCollections", LEAKED_MEMORY.size());
        stats.put("leakCounter", leakCounter);
        stats.put("requestCounter", requestCounter);
        
        LOG.info("Memory stats requested - Used: " + (usedMemory / (1024 * 1024)) + "MB / " + 
                 (maxMemory / (1024 * 1024)) + "MB (" + ((usedMemory * 100) / maxMemory) + "%)");
        
        return Response.ok(stats).build();
    }

    /**
     * Attempt to clear leaks (won't work properly due to static reference)
     * This demonstrates that even trying to clear doesn't help with static collections
     */
    @DELETE
    @Path("/clear-leaks")
    public Response clearLeaks() {
        int clearedCount = LEAKED_MEMORY.size();
        LEAKED_MEMORY.clear();
        System.gc(); // Suggest garbage collection
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "cleared");
        response.put("clearedCount", clearedCount);
        response.put("message", "Attempted to clear leaks and run GC");
        
        LOG.info("Cleared " + clearedCount + " leaked collections");
        
        return Response.ok(response).build();
    }

    /**
     * Reset counters
     */
    @POST
    @Path("/reset")
    public Response reset() {
        LEAKED_MEMORY.clear();
        requestCounter = 0;
        leakCounter = 0;
        System.gc();
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "reset");
        response.put("message", "All counters and leaks cleared");
        
        LOG.info("Application reset completed");
        
        return Response.ok(response).build();
    }
}

// Made with Bob
