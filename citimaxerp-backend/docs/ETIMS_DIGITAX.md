# Kenya eTIMS via DigiTax

Citimax raises Kenyan sales invoices and credit notes on KRA eTIMS through the DigiTax v2 API. It also supports product registration, stock movements, supplier-receipt verification, callbacks, retry/reconciliation workflows, compliance reporting, and signed invoice QR output.

## Production configuration

Set a dedicated, base64-encoded 32-byte key-encryption key in the deployment secret store:

```dotenv
TAX_COMPLIANCE_KEK=<base64-encoded-32-byte-secret>
TAX_COMPLIANCE_KEK_DERIVE_DEV=false
TAX_COMPLIANCE_KEK_VERSION=v1
ETIMS_BASE_URL_TEST=https://api.digitax.tech/ke/v2
ETIMS_BASE_URL_LIVE=https://api.digitax.tech/ke/v2
ETIMS_CALLBACKS_ENABLED=false
```

Never put a DigiTax tenant API key in environment files or source control. Add it per company in **Settings → eTIMS**; Citimax envelope-encrypts it before database storage. DigiTax selects test or live business data from that API key even though both environments use the same API host.

## Deploy and operate

1. Run `php artisan migrate --force`.
2. Run `php artisan db:seed --class=EtimsReferenceDataSeeder --force`.
3. Keep the Laravel queue worker and scheduler running. The scheduler reaps abandoned submission locks every five minutes.
4. In **Settings → eTIMS**, save the KRA identity, save the DigiTax API key, pass **Test connection**, choose the go-live date, and enable the integration.
5. If callbacks are enabled, expose the generated HTTPS callback URL. Status polling remains supported when callbacks are disabled.

Invoices are submitted when Citimax marks them sent or paid. Every eTIMS line is linked to a catalog product and tax profile; missing products are registered before the sale is submitted. Failed submissions stay visible in **eTIMS Compliance** and can be retried without changing the trader invoice number or client request ID.

## Validation

The normal contract suite is safe and uses mocked DigiTax responses:

```bash
php artisan test tests/Feature/Etims/CitimaxDigitaxIntegrationTest.php
```

The opt-in live sandbox test creates a real test item and test sale:

```bash
DIGITAX_TEST_API_KEY='<test-key>' php artisan test tests/Feature/Etims/CitimaxDigitaxLiveSandboxTest.php
```
