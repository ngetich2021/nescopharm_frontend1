import { ProductReceiptPage } from "./components/ProductReceiptPage";

export const metadata = {
  title: "Product Receipts | Citimax",
  description: "Manage and view product receipts",
};

// Enable dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic';

// Revalidate every 4 seconds (only relevant if we switch to SSR in future)
export const revalidate = 4;

export default function Page() {
  return <ProductReceiptPage />;
}