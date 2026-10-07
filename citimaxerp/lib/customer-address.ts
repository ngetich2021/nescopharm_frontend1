// Every customer-facing document (invoice, quotation, order, delivery note,
// statement, emailed PDF) prints the same buyer block. Building it here keeps
// those blocks from drifting apart again - previously each document picked its
// own subset of fields, so postal address, town and country appeared on none
// of them.

export interface CustomerAddressSource {
  name?: string | null
  business_name?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  county?: string | null
  country?: string | null
  pin_number?: string | null
  customer_type?: string | null
}

export interface BuyerBlock {
  /** Business name where captured, otherwise the customer's own name. */
  name: string
  /** Contact person, only when the line above is showing a business name. */
  careOf: string | null
  /** Physical address, postal address, then "Town, County, Country". */
  addressLines: string[]
  /** Null only for an individual with no PIN on record. */
  kraPin: string | null
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * "13967-00100" and "P.O Box 13967-00100" both render as the latter, since
 * the field is captured inconsistently.
 */
export function formatPostalAddress(postalCode: string | null | undefined): string {
  const code = clean(postalCode)
  if (!code) return ""
  return /^p\.?\s*o\.?\s*box/i.test(code) ? code : `P.O Box ${code}`
}

/**
 * "Kisii, Kenya". County is dropped when it merely repeats the town, which is
 * the common case for Kenya's town-named counties.
 */
export function formatTownCountry(customer: CustomerAddressSource): string {
  const town = clean(customer.city)
  const county = clean(customer.county)
  const country = clean(customer.country)

  const parts: string[] = []
  if (town) parts.push(town)
  if (county && county.toLowerCase() !== town.toLowerCase()) parts.push(county)
  if (country) parts.push(country)
  return parts.join(", ")
}

/**
 * Documents hold both a full customer profile and the lighter copy embedded on
 * the invoice/order. The profile wins field by field, falling back wherever it
 * has nothing - a plain object spread would let its nulls erase the embedded
 * copy's values.
 */
export function mergeCustomerSources(
  preferred: CustomerAddressSource | null | undefined,
  fallback: CustomerAddressSource | null | undefined,
): CustomerAddressSource {
  const keys: (keyof CustomerAddressSource)[] = [
    "name",
    "business_name",
    "address",
    "postal_code",
    "city",
    "county",
    "country",
    "pin_number",
    "customer_type",
  ]
  const merged: CustomerAddressSource = {}
  for (const key of keys) {
    merged[key] = clean(preferred?.[key]) ? preferred?.[key] : fallback?.[key]
  }
  return merged
}

export function buildBuyerBlock(customer: CustomerAddressSource | null | undefined): BuyerBlock {
  const source = customer ?? {}
  const businessName = clean(source.business_name)
  const contactName = clean(source.name)

  const addressLines = [
    clean(source.address),
    formatPostalAddress(source.postal_code),
    formatTownCountry(source),
  ].filter(Boolean)

  const pin = clean(source.pin_number)

  return {
    name: businessName || contactName || "Customer Name",
    // Only worth printing when the name line above is the business, not the person.
    careOf: businessName && contactName ? contactName : null,
    addressLines,
    // A company's PIN line always prints, so a missing one is visible on the
    // document rather than silently dropped.
    kraPin: pin || (source.customer_type === "company" ? "Not provided" : null),
  }
}

/** Flat text form, for plain-HTML PDF templates and email bodies. */
export function buyerBlockTextLines(customer: CustomerAddressSource | null | undefined): string[] {
  const block = buildBuyerBlock(customer)
  return [
    block.name,
    ...(block.careOf ? [`c/o ${block.careOf}`] : []),
    ...block.addressLines,
    ...(block.kraPin ? [`PIN : ${block.kraPin}`] : []),
  ]
}
