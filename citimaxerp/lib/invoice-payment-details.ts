// Static payment details shown at the bottom of every invoice so customers know
// where to pay. Not customer/company-specific data from the database — just the
// business's own fixed bank/M-Pesa details, kept here so they're easy to update.
export const INVOICE_PAYMENT_DETAILS = {
  mpesaPaybill: "982800",
  mpesaAccount: "NESEXP",
  bankName: "PRIME BANK",
  bankAccountName: "NESCOPHARM AFRICA LTD EXPENSE ACCOUNT",
  bankAccountNumber: "3000233027",
  bankBranch: "INDUSTRIAL AREA",
}

// Used on printed documents when the eTIMS config has no KRA PIN on record.
export const COMPANY_KRA_PIN = "P052406784Q"
