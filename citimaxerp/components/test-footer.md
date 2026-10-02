import Link from 'next/link';

export default function Footer() {
return (

<footer className="bg-gray-900 text-white py-12">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div className="grid md:grid-cols-4 gap-8">
<div>
<h3 className="text-xl font-bold mb-4">🍒 Cherry</h3>
<p className="text-gray-400">The smartest way to sell products and receive M-Pesa payments through WhatsApp.</p>
</div>
<div>
<h4 className="font-bold mb-4">Product</h4>
<ul className="space-y-2">
<li><Link href="#" className="text-gray-400 hover:text-white">Features</Link></li>
<li><Link href="/pricing" className="text-gray-400 hover:text-white">Pricing</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">Case Studies</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">Reviews</Link></li>
</ul>
</div>
<div>
<h4 className="font-bold mb-4">Resources</h4>
<ul className="space-y-2">
<li><Link href="#" className="text-gray-400 hover:text-white">Blog</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">Help Center</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">API Docs</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">Status</Link></li>
</ul>
</div>
<div>
<h4 className="font-bold mb-4">Company</h4>
<ul className="space-y-2">
<li><Link href="#" className="text-gray-400 hover:text-white">About Us</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">Careers</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">Contact</Link></li>
<li><Link href="#" className="text-gray-400 hover:text-white">Privacy Policy</Link></li>
</ul>
</div>
</div>
<div className="mt-10 pt-6 border-t border-gray-800 text-center text-gray-400">
<p>© 2025 Cherry CRM. All rights reserved.</p>
</div>
</div>
</footer>
);
}

[//]: # (curl -X GET "https://graph.facebook.com/v17.0/2385431365174956/owned_product_catalogs" -H "Authorization: Bearer EAAQa128D9DMBO2OkNvIjpedYwNt1tKNy6flPWsECcZC21NZB07HaMmKRpyXZA7nZC9zeGxwP16olBUKHzw2rgA5ffZAtTNrEHPf2NHRs5XTdWtDs19ZALJyzWTyV1DL7dA1AFpSl5SzLySuGZAyWeXJZAglRjxaxINfVcOyTuMd2V5wrBoZBZCOQti5ZABn2ZArOPZAQUHn8c26y6ZBFegaoner13Y6Bn8NcFIYfZCo0sH93EFf")
