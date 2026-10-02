# Set Password Feature

This feature allows users to set their password after verifying their email.

## URL Structure
- `/set-password?token={password_setup_token}&id={user_id}`

## API Endpoint
- `POST /users/{user_id}/set-password`

## Payload
```json
{
  "token": "password_setup_token_from_email",
  "password": "newSecurePassword123",
  "password_confirmation": "newSecurePassword123"
}
```

## Flow
1. User clicks "Verify & Set Password" button in email
2. Link: `/email/verify/{id}/{hash}` (where id is the user ID)
3. After verification, backend redirects to: `/set-password?token=<password_setup_token>&id=<user_id>`
4. User sets their password using this feature
5. Upon successful password setup, user is redirected to sign-in page

## Files
- `lib/setuppassword.ts` - Contains the API function to set the password
- `app/set-password/[[...set-password]]/page.tsx` - The UI page for setting password
- `app/set-password/layout.tsx` - Layout component for the set password feature