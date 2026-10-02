# Dispatch Approver API - Quick Reference

## API Endpoint

### Get Potential Approvers
```
GET /api/company/dispatch-settings/potential-approvers
```

**Description:** Get all active users in your company who can be set as approvers.

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "29590834-4d79-46b7-ab0b-fb6be2842c95",
      "first_name": "John",
      "last_name": "Admin",
      "email": "john@company.com",
      "role": "Sales Manager",
      "is_active": true
    },
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@company.com",
      "role": "Warehouse Manager",
      "is_active": true
    },
    {
      "id": "e5f6g7h8-90ij-klmn-opqr-stuvwxyz1234",
      "first_name": "Mike",
      "last_name": "Johnson",
      "email": "mike@company.com",
      "role": "Finance Manager",
      "is_active": true
    },
    {
      "id": "f1g2h3i4-5678-jklm-nopq-rstuvwxyz567",
      "first_name": "Sarah",
      "last_name": "Operations",
      "email": "sarah@company.com",
      "role": "Operations Manager",
      "is_active": true
    }
  ]
}
```

## Frontend Usage

### Fetch Potential Approvers
```typescript
import { getPotentialApprovers } from "@/lib/approver";

async function loadUsers() {
  try {
    const response = await getPotentialApprovers();
    
    if (response.success) {
      const users = response.data;
      console.log(`Loaded ${users.length} potential approvers`);
      
      users.forEach(user => {
        console.log(`${user.first_name} ${user.last_name} - ${user.role}`);
      });
    }
  } catch (error) {
    console.error("Failed to load potential approvers:", error);
  }
}
```

### Display in Component
```typescript
const [potentialApprovers, setPotentialApprovers] = useState<PotentialApprover[]>([]);

useEffect(() => {
  async function fetchApprovers() {
    const response = await getPotentialApprovers();
    setPotentialApprovers(response.data);
  }
  fetchApprovers();
}, []);

// In your JSX
<Select>
  <SelectContent>
    {potentialApprovers.map((user) => (
      <SelectItem key={user.id} value={user.id}>
        {user.first_name} {user.last_name} - {user.role}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Testing

### Using curl
```bash
curl -X GET \
  http://localhost:8000/api/company/dispatch-settings/potential-approvers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Using Postman
1. Method: `GET`
2. URL: `http://localhost:8000/api/company/dispatch-settings/potential-approvers`
3. Headers:
   - `Authorization: Bearer YOUR_TOKEN`
   - `Content-Type: application/json`

## Expected Behavior

1. **Frontend loads approvers page**
2. **Component calls `getPotentialApprovers()`**
3. **API request sent to backend**: `GET /api/company/dispatch-settings/potential-approvers`
4. **Backend returns list of active users**
5. **Frontend populates dropdown with users**
6. **User can select approvers from the list**

## Troubleshooting

### Users not showing in dropdown?

1. **Check browser console** (F12 → Console tab)
   - Look for API errors or network failures

2. **Check network tab** (F12 → Network tab)
   - Find the request to `potential-approvers`
   - Check status code (should be 200)
   - Check response data

3. **Verify backend is running**
   ```bash
   curl http://localhost:8000/api/company/dispatch-settings/potential-approvers
   ```

4. **Check authentication**
   - Ensure you're logged in
   - Token should be valid and not expired

5. **Check backend logs**
   - Look for errors in your Laravel/backend logs
   - Verify the endpoint is registered

### Common Issues

❌ **404 Not Found** - Backend endpoint doesn't exist
❌ **401 Unauthorized** - Token is missing or invalid
❌ **403 Forbidden** - User doesn't have permission
❌ **500 Server Error** - Backend code has an error
✅ **200 OK** - Everything is working correctly!

## Integration Status

✅ Frontend implementation complete
✅ API response types updated to use `success: boolean`
✅ Component ready to display users
⏳ Backend endpoint needs to be implemented (if not already done)

Once the backend endpoint is live and returns the correct format, users will automatically appear in the dropdown!
