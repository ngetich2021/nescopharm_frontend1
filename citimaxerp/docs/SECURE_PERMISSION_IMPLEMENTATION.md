# Secure Permission & Token Management Implementation

## Overview

This implementation provides a robust, secure, and user-friendly authentication and permission management system for CitiMaxERP. The system focuses on:

1. **Secure Token Management** - Automatic token validation and expiration handling
2. **Permission Caching** - Fast permission checks with secure storage
3. **Automatic Refresh** - Seamless token and permission synchronization
4. **Smooth UX** - No interruptions to user workflow

## Architecture

### Core Components

1. **Token Manager** (`lib/token-manager.ts`)
   - Secure token storage with expiration metadata
   - Token validation and expiration checking
   - Automatic cleanup on expiration

2. **Permission Manager** (`lib/permission-manager.ts`)
   - Obfuscated storage of user data and permissions
   - Fast permission lookup with caching (15-minute cache)
   - User data management utilities

3. **Auth Refresh Service** (`lib/auth-refresh.ts`)
   - Automatic token refresh (5 minutes before expiry)
   - Permission synchronization (every 10 minutes)
   - Background monitoring without UI interruption

4. **Enhanced Auth Context** (`lib/auth-context.tsx`)
   - Integration of all security features
   - Backward compatibility maintained
   - Improved error handling

5. **Enhanced API Client** (`lib/api.ts`)
   - Automatic token expiration detection
   - Secure token retrieval
   - Retry logic for transient errors

## Key Features

### 1. Token Management

**Storage Strategy:**
- Tokens stored with expiration metadata
- Automatic validation before each API call
- Secure cookie storage for server actions
- Backward compatible with existing token storage

**Expiration Handling:**
- Tokens checked for expiration on retrieval
- 5-minute refresh threshold (tokens refreshed proactively)
- Automatic cleanup on logout or expiration

**Security Notes:**
- Client-side validation is for UX only
- All authorization decisions made on backend
- Token format validation prevents malformed tokens

### 2. Permission Management

**Storage Strategy:**
- Permissions cached with 15-minute expiration
- Obfuscation (base64) to prevent casual inspection
- User-specific caching with validation
- Automatic cache invalidation on user change

**Fast Permission Checks:**
```typescript
// Check permission from cache
const canEdit = hasPermissionCached(userId, 'can_edit_orders');

// Get all permission keys
const permissions = getPermissionKeys(userId);
```

**Security Notes:**
- Permissions stored client-side for UI decisions only
- Backend must validate all permissions on each request
- Cache automatically cleared on logout

### 3. Automatic Refresh

**Token Refresh:**
- Monitors token expiration every 2 minutes
- Refreshes 5 minutes before expiry
- Single refresh promise prevents concurrent refreshes
- Graceful failure with automatic logout

**Permission Sync:**
- Syncs permissions every 10 minutes
- Validates cache before syncing
- Background process (no UI interruption)
- Keeps permissions in sync with backend changes

**Monitoring Lifecycle:**
```typescript
// On login
initializeAuthMonitoring(); // Starts both token refresh and permission sync

// On logout
cleanupAuthMonitoring(); // Stops monitoring and clears caches
```

## Usage Guide

### For Developers

**Checking Permissions:**
```typescript
// In components (using Auth Context)
const { hasPermission } = useAuth();

if (hasPermission('can_edit_orders')) {
  // Show edit button
}

// Direct cache check (faster, but less fresh)
import { hasPermissionCached } from '@/lib/permission-manager';

const canEdit = hasPermissionCached(userId, 'can_edit_orders');
```

**Manual Permission Sync:**
```typescript
import { syncPermissions } from '@/lib/auth-refresh';

// Force permission sync (e.g., after role change)
await syncPermissions();
```

**Token Status:**
```typescript
import { getAuthStatus } from '@/lib/auth-refresh';

const status = getAuthStatus();
console.log('Token expires in:', status.timeUntilExpiry, 'ms');
console.log('Should refresh:', status.shouldRefresh);
```

### For Backend API

**Required Endpoints:**

1. **GET /user** - Returns current user with permissions
   ```json
   {
     "status": "success",
     "data": {
       "user": {
         "id": "...",
         "email": "...",
         "role": {
           "permissions": [...]
         }
       }
     }
   }
   ```

2. **All Protected Endpoints** - Must validate permissions server-side
   - Never trust client-side permission checks
   - Validate token on every request
   - Return 401 for expired tokens
   - Return 403 for insufficient permissions

## Security Considerations

### Client-Side Security

**What IS Secure:**
✅ Token stored with validation metadata
✅ Automatic expiration detection
✅ Obfuscated user data (prevents casual inspection)
✅ Automatic cleanup on logout
✅ User-specific cache validation

**What is NOT Secure:**
❌ Client-side encryption (easily bypassed)
❌ Client-side permission checks (for authorization)
❌ localStorage (accessible via DevTools)

### Backend Requirements

**CRITICAL - Backend MUST:**
1. ✅ Validate token on every protected endpoint
2. ✅ Check permissions for each operation
3. ✅ Return proper HTTP status codes (401, 403)
4. ✅ Never trust client-sent permission data
5. ✅ Implement rate limiting
6. ✅ Log authorization failures

## Migration Guide

### Backward Compatibility

The new system maintains backward compatibility:

**Old storage still works:**
- `localStorage.getItem('token')` - Still retrieved
- `localStorage.getItem('user')` - Fallback supported
- Cookies still set for server actions

**Gradual Migration:**
- New storage used alongside old storage
- Old storage can be removed in future version
- No breaking changes to existing code

### Cleanup Old Storage (Future)

```typescript
// Remove after all users migrated
localStorage.removeItem('token'); // Use getToken() instead
localStorage.removeItem('user');  // Use getUserData() instead
```

## Performance Optimization

### Permission Cache

**Benefits:**
- 15-minute cache reduces API calls
- Sub-millisecond permission checks
- Automatic invalidation on user change

**Cache Hit Rate:**
- Expected: >95% for typical usage
- Refresh every 10 minutes in background
- Force refresh on role/permission changes

### Token Refresh

**Benefits:**
- Proactive refresh (no user interruption)
- Single refresh promise (no concurrent requests)
- 2-minute check interval (low overhead)

## Monitoring & Debugging

### Debug Status

```typescript
import { getAuthStatus } from '@/lib/auth-refresh';

// Get current status
const status = getAuthStatus();

console.log('Auth Status:', {
  tokenExpired: status.tokenExpired,
  shouldRefresh: status.shouldRefresh,
  timeUntilExpiry: `${Math.floor(status.timeUntilExpiry / 1000)}s`,
  monitoringActive: status.monitoringActive,
});
```

### Common Issues

**Issue: Permissions not updating**
```typescript
// Force permission sync
import { syncPermissions } from '@/lib/auth-refresh';
await syncPermissions();
```

**Issue: Token expired unexpectedly**
```typescript
// Check token status
import { isTokenExpired, getTimeUntilExpiry } from '@/lib/token-manager';
console.log('Expired:', isTokenExpired());
console.log('Time left:', getTimeUntilExpiry());
```

**Issue: User logged out automatically**
- Check token expiration (default 7 days for Sanctum)
- Check inactivity timeout (10 minutes)
- Check backend token validation

## Future Enhancements

### Potential Improvements

1. **Real Encryption**
   - Use Web Crypto API for proper encryption
   - Encrypt permissions with session key

2. **Permission Diff**
   - Only sync changed permissions
   - Reduce network payload

3. **Service Worker**
   - Background sync even when tab closed
   - Push notification for permission changes

4. **WebSocket Integration**
   - Real-time permission updates
   - Instant revocation support

5. **Analytics**
   - Track permission usage
   - Optimize cache size
   - Monitor refresh success rate

## Testing

### Unit Tests Needed

```typescript
// Token Manager
- Token storage and retrieval
- Expiration calculation
- Format validation

// Permission Manager
- Cache hit/miss
- User change detection
- Obfuscation/deobfuscation

// Auth Refresh
- Token refresh logic
- Permission sync
- Monitoring lifecycle
```

### Integration Tests Needed

```typescript
// Full auth flow
- Login → Storage → Monitoring
- Logout → Cleanup
- Token expiration → Auto-logout
- Permission change → Sync
```

## Support

For questions or issues:
1. Check the debug status using `getAuthStatus()`
2. Review browser console for errors
3. Verify backend endpoints are working
4. Check token hasn't expired

## License

Part of CitiMaxERP - Internal Use Only
