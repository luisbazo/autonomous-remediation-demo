# Bob AI Agent Permission Fix - RESOLVED ✅

## Issue Summary
Pod `bob-ai-agent-578c74cdb-v2vqr` in namespace `demo-namespace` was experiencing permission errors preventing Instana from loading native monitoring modules.

## Root Cause
OpenShift runs containers with random UIDs for security. The original Dockerfile didn't set proper permissions on `/app/node_modules`, causing EACCES errors when Instana tried to write precompiled native modules at runtime.

## Solution Applied

### 1. Updated Dockerfile
Modified [`bob-agent/Dockerfile`](bob-agent/Dockerfile:15) to include OpenShift-compatible permissions:

```dockerfile
# Fix permissions for OpenShift (runs as random UID)
# Instana needs to write precompiled native modules at runtime
RUN chgrp -R 0 /app && \
    chmod -R g=u /app && \
    chmod -R g+w /app/node_modules
```

### 2. Granted Registry Permissions
Added image-builder role to the default service account:
```bash
oc policy add-role-to-user system:image-builder system:serviceaccount:demo-namespace:default -n demo-namespace
```

### 3. Built and Pushed New Image
- Built image locally with podman including permission fixes
- Pushed to OpenShift registry using service account token
- Triggered pod redeployment

## Verification Results

### New Pod Status
```
bob-ai-agent-578c74cdb-ncftt   1/1   Running   0   40s
```

### Log Analysis - SUCCESS ✅
```
Found a precompiled version for gcstats.js (linux/x64/musl/ABI 108), unpacking.
Found a precompiled version for event-loop-stats (linux/x64/musl/ABI 108), unpacking.
Copying the precompiled build for gcstats.js (linux/x64/musl/ABI 108) from /tmp/gcstats.js to /app/node_modules/gcstats.js/precompiled.
Copying the precompiled build for event-loop-stats (linux/x64/musl/ABI 108) from /tmp/event-loop-stats to /app/node_modules/event-loop-stats/precompiled.
Successfully copied the precompiled build for event-loop-stats (linux/x64/musl/ABI 108).
Attempt to load native add-on event-loop-stats after copying precompiled binaries has been successful.
Successfully copied the precompiled build for gcstats.js (linux/x64/musl/ABI 108).
Attempt to load native add-on gcstats.js after copying precompiled binaries has been successful.
```

### Error Count
- **EACCES errors**: 0 (previously multiple)
- **Permission denied errors**: 0 (previously multiple)

## Benefits Achieved

✅ **No more permission errors** - Pod runs without EACCES errors
✅ **Full Instana monitoring** - Native modules loaded successfully:
   - `gcstats.js` - Provides detailed garbage collection metrics
   - `event-loop-stats` - Provides event loop performance metrics
✅ **OpenShift compliant** - Follows security best practices for random UID execution
✅ **Production ready** - Application runs with full observability

## Technical Details

### Permission Strategy
The fix uses OpenShift's recommended approach for handling random UIDs:
- `chgrp -R 0 /app` - Sets group ownership to root (GID 0)
- `chmod -R g=u /app` - Makes group permissions match user permissions
- `chmod -R g+w /app/node_modules` - Ensures node_modules is writable by group

This allows any UID in the root group (which OpenShift assigns) to write to the directory.

### Image Details
- **Image ID**: f2b034e1c1f2
- **Size**: 295 MB (increased from 220 MB due to permission metadata)
- **Registry**: default-route-openshift-image-registry.apps.itz-jem4wu.infra01-lb.fra02.techzone.ibm.com/demo-namespace/bob-ai-agent:latest

## Monitoring Capabilities Now Available

With the native modules successfully loaded, Instana can now monitor:
- **Garbage Collection**: Frequency, duration, and type of GC events
- **Event Loop**: Latency and blocking operations
- **Memory**: Detailed heap statistics
- **Performance**: Real-time application performance metrics

## Automation
The fix has been integrated into the setup script. Future deployments using [`scripts/setup-demo.sh`](scripts/setup-demo.sh) will automatically:
- Grant the necessary image-builder permissions
- Build the image with the permission fixes
- Deploy without manual intervention

## Files Modified
1. [`bob-agent/Dockerfile`](bob-agent/Dockerfile) - Added permission fixes for OpenShift random UID support
2. [`scripts/setup-demo.sh`](scripts/setup-demo.sh) - Added automatic permission granting step
3. Service account permissions - Granted image-builder role to default service account

## Status: RESOLVED ✅
The Bob AI Agent is now running successfully with full Instana monitoring capabilities and no permission errors.