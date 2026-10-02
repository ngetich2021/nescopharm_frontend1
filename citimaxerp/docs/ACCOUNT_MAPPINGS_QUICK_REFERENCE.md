# Account Mappings - Quick Reference

## Quick Setup

### Access the Setup Page
Navigate to `/finance/account-mappings` to configure account mappings.

### Workflow
1. Enter Company ID (optional - uses selected store by default)
2. Click "Auto-Initialize Mappings"
3. Review results (Mapped count vs Unmapped count)
4. For each unmapped key:
   - Select account from dropdown
   - Click "Save"
5. Validate status (should show all configured)

---

## For Developers

### Add Validation to a Form

```tsx
import { MappingValidationAlert } from '@/components/mapping-validation-alert'

export function MyTransactionForm() {
  const [canSubmit, setCanSubmit] = useState(false)
  const { companyId } = useAuth()

  return (
    <form>
      {/* Validation alert at top */}
      <MappingValidationAlert 
        companyId={companyId}
        onValidationChange={setCanSubmit}
      />
      
      {/* Form fields */}
      <input type="text" />
      
      {/* Disable submit if mappings invalid */}
      <button disabled={!canSubmit}>Submit</button>
    </form>
  )
}
```

### Check Before Submitting

```tsx
import { checkMappingsValid } from '@/lib/account-mappings'

const handleSubmit = async (data) => {
  // Check mappings before proceeding
  if (!await checkMappingsValid(companyId)) {
    toast({ 
      title: 'Setup Required',
      description: 'Please complete account mapping setup first',
      variant: 'destructive'
    })
    return
  }
  
  // Proceed with submission
  await submitTransaction(data)
}
```

### Use the Validation Hook

```tsx
import { useAccountMappingValidation } from '@/hooks/use-account-mapping-validation'

export function MyComponent() {
  const { validate, isValid, validating, validationResult } = 
    useAccountMappingValidation(companyId)
  
  useEffect(() => {
    // Check mappings on component mount
    validate()
  }, [])
  
  if (!isValid) {
    return <div>Please configure account mappings</div>
  }
  
  return <div>Mappings complete: {validationResult?.configured_count} accounts</div>
}
```

### Add to Dashboard

```tsx
import { AccountMappingStatusWidget } from '@/components/widgets/account-mapping-status'

export function FinanceDashboard() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Other widgets */}
      <AccountMappingStatusWidget companyId={companyId} />
    </div>
  )
}
```

---

## API Functions

### `initializeMappings(companyId?)`
Auto-detect accounts from chart of accounts.
```tsx
const result = await initializeMappings(companyId)
// result.mapped_count, result.unmapped_count, result.mapped, result.unmapped
```

### `saveMapping(data)`
Save single mapping.
```tsx
await saveMapping({
  company_id: 'uuid',
  mapping_key: 'accounts_receivable',
  account_code: '1200',
  description: 'Customer receivables'
})
```

### `bulkUpdateMappings(companyId, mappings)`
Save multiple mappings at once.
```tsx
await bulkUpdateMappings(companyId, [
  { mapping_key: 'accounts_receivable', account_code: '1200' },
  { mapping_key: 'sales_revenue', account_code: '4000' }
])
```

### `getMappings(params?)`
Get all configured mappings.
```tsx
const { mappings } = await getMappings({ company_id: 'uuid' })
```

### `validateMappings(companyId?)`
Check if all required mappings configured.
```tsx
const validation = await validateMappings(companyId)
// validation.is_valid, validation.configured_count, validation.missing
```

### `getAvailableMappingKeys()`
Get list of all possible mapping keys.
```tsx
const { core_keys, extended_keys } = await getAvailableMappingKeys()
```

---

## Response Structure

### Validation Response
```json
{
  "is_valid": true,
  "configured_count": 45,
  "required_count": 45,
  "configured": {
    "accounts_receivable": "uuid",
    "sales_revenue": "uuid"
  },
  "missing": [],
  "optional_missing": []
}
```

### Initialize Response
```json
{
  "status": "success",
  "mapped_count": 45,
  "unmapped_count": 3,
  "mapped": {
    "accounts_receivable": "1200",
    "sales_revenue": "4000"
  },
  "unmapped": {
    "training_expense": "Could not auto-detect"
  }
}
```

### Mappings Response
```json
{
  "status": "success",
  "mappings": [
    {
      "id": "uuid",
      "mapping_key": "accounts_receivable",
      "account_code": "1200",
      "chart_of_account": {
        "id": "uuid",
        "account_code": "1200",
        "account_name": "Accounts Receivable",
        "account_type": "asset"
      },
      "is_active": true
    }
  ]
}
```

---

## Common Mapping Keys

| Key | Description | Type | Required |
|-----|-------------|------|----------|
| `accounts_receivable` | Customer debts | asset | Yes |
| `accounts_payable` | Vendor debts | liability | Yes |
| `sales_revenue` | Revenue from sales | income | Yes |
| `expense_account` | General expenses | expense | Yes |
| `cash_on_hand` | Cash/bank accounts | asset | No |
| `expense_payroll` | Payroll expenses | expense | No |
| `discount_account` | Sales discounts | income | No |

---

## Troubleshooting

### "Account code not found"
- Check that account code exists in Chart of Accounts
- Verify account code spelling and format
- Make sure account belongs to current company

### "Mapping key invalid"
- Use only keys from `getAvailableMappingKeys()`
- Keys are case-sensitive
- Check documentation for valid keys

### "User can't access"
- Ensure user has `can_manage_accounting_settings` permission
- Check that user is admin of the company

### Validation always fails
- Ensure all required mappings are configured
- Check `validationResult.missing` for list of missing keys
- Run `initializeMappings` to auto-configure what's possible

---

## Integration Checklist

When adding validation to a new form:

- [ ] Import `MappingValidationAlert` component
- [ ] Add alert to form component
- [ ] Connect `onValidationChange` to form state
- [ ] Disable submit button if not valid
- [ ] Test with incomplete mappings
- [ ] Test with complete mappings
- [ ] Verify error messages display correctly

---

## Testing in Console

```javascript
// Check current company's mapping status
const validation = await validateMappings()
console.log(validation)

// Get all mappings
const mappings = await getMappings()
console.log(mappings)

// Get available keys
const keys = await getAvailableMappingKeys()
console.log(keys)
```

---

## Support

For questions or issues:
1. Check `/finance/account-mappings` page status
2. Review validation error details
3. Ensure all required accounts exist in Chart of Accounts
4. Check user permissions
