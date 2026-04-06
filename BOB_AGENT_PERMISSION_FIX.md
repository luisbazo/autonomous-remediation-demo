# Bob AI Agent Permission Fix

## Issue Identified
The pod `bob-ai-agent-578c74cdb-v2vqr` in namespace `demo-namespace` was experiencing permission errors when Instana tried to install native add-ons at runtime:

```
EACCES: permission denied, mkdir '/app/node_modules/gcstats.js'
EACCES: permission denied, mkdir '/app/node_modules/event-loop-stats'
```

## Root Cause
OpenShift runs containers with a random UID for security. The original Dockerfile didn't set proper permissions on the `/app/node_modules` directory, preventing Instana from writing precompiled native modules at runtime.

## Fix Applied
Updated `bob-agent/Dockerfile` to include proper permission settings for OpenShift:

```dockerfile
# Fix permissions for OpenShift (runs as random UID)
# Instana needs to write precompiled native modules at runtime
RUN chgrp -R 0 /app && \
    chmod -R g=u /app && \
    chmod -R g+w /app/node_modules
```

This fix:
- Sets group ownership to root (GID 0) - OpenShift standard
- Makes group permissions match user permissions
- Ensures node_modules directory is writable by the group

## Next Steps to Complete the Fix

### 1. Complete the Image Build
The podman build is currently in progress:
```bash
cd bob-agent
podman build -t default-route-openshift-image-registry.apps.itz-jem4wu.infra01-lb.fra02.techzone.ibm.com/demo-namespace/bob-ai-agent:latest .
```

### 2. Push the Image to OpenShift Registry
Once the build completes, push the image:
```bash
# Login to OpenShift registry
podman login -u $(oc whoami) -p $(oc whoami -t) default-route-openshift-image-registry.apps.itz-jem4wu.infra01-lb.fra02.techzone.ibm.com

# Push the image
podman push default-route-openshift-image-registry.apps.itz-jem4wu.infra01-lb.fra02.techzone.ibm.com/demo-namespace/bob-ai-agent:latest
```

### 3. Trigger Redeployment
Delete the current pod to trigger a redeployment with the new image:
```bash
oc delete pod bob-ai-agent-578c74cdb-v2vqr -n demo-namespace
```

### 4. Verify the Fix
Check the new pod's logs to confirm no permission errors:
```bash
# Get the new pod name
oc get pods -n demo-namespace | grep bob-ai-agent

# Check logs
oc logs <new-pod-name> -n demo-namespace --tail=100
```

Look for:
- ✅ No "EACCES: permission denied" errors
- ✅ Messages like "Found a precompiled version for gcstats.js"
- ✅ Successful loading of Instana native modules

## Expected Outcome
After applying this fix, the Bob AI Agent will:
- Run without permission errors
- Successfully load Instana's native add-ons (gcstats.js and event-loop-stats)
- Provide full GC and event loop monitoring in Instana
- Maintain full functionality while being monitored

## Alternative: Manual Build Instructions
If the automated build fails, you can build and push manually:

```bash
# Navigate to bob-agent directory
cd bob-agent

# Build TypeScript
npm run build

# Build image with podman
podman build -t default-route-openshift-image-registry.apps.itz-jem4wu.infra01-lb.fra02.techzone.ibm.com/demo-namespace/bob-ai-agent:latest .

# Login to registry
podman login -u $(oc whoami) -p $(oc whoami -t) default-route-openshift-image-registry.apps.itz-jem4wu.infra01-lb.fra02.techzone.ibm.com

# Push image
podman push default-route-openshift-image-registry.apps.itz-jem4wu.infra01-lb.fra02.techzone.ibm.com/demo-namespace/bob-ai-agent:latest

# Delete pod to trigger redeployment
oc delete pod -l app=bob-ai-agent -n demo-namespace