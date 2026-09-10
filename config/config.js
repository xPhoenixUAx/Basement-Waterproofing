/* Shared browser/PHP configuration. Keep JSON syntax: quoted keys, no trailing commas.
 * Edit values here. {brand} works in pageTitles, form.senderName and form.subject.
 * Real delivery requires configured email addresses, brand.siteUrl and PHP mail().
 * This file is public: do not put passwords or API keys here.
 */
// prettier-ignore
window.SITE_CONFIG = {
  "brand": {
    "name": "belowline",
    "companyName": "YOUR COMPANY NAME",
    "siteUrl": "https://example.com",
    "logo": "assets/brand/logo.svg?v=3",
    "favicon": "assets/brand/favicon.svg?v=3"
  },
  "contact": {
    "email": "hello@example.com",
    "address": "YOUR BUSINESS ADDRESS"
  },
  "form": {
    "recipientEmail": "requests@example.com",
    "senderEmail": "website@example.com",
    "senderName": "{brand}",
    "subject": "{brand} — Basement waterproofing request"
  },
  "pageTitles": {
    "index": "Basement Waterproofing Options | {brand}",
    "interior-waterproofing": "Interior waterproofing | {brand}",
    "exterior-waterproofing": "Exterior waterproofing | {brand}",
    "sump-pump-systems": "Sump pump systems | {brand}",
    "foundation-crack-sealing": "Foundation crack sealing | {brand}",
    "privacy": "Privacy Policy | {brand}",
    "terms": "Terms of Use | {brand}",
    "cookies": "Cookie Policy | {brand}"
  },
  "legal": {
    "updated": "2026-09-10"
  },
  "disclaimer": "Disclaimer: This website is a free service that helps users connect with independent local service providers. The website owner and operator do not perform, supervise, direct, or guarantee any work. All contractors and service providers are independent businesses. This website does not warrant or guarantee estimates, availability, licensing status, workmanship, project outcomes, or services performed. Users are solely responsible for verifying that any provider they hire holds all licenses, insurance, permits, certifications, and other credentials required for the work. Any person depicted in a photograph or video is an actor or model unless expressly identified otherwise and is not necessarily a contractor or service provider available through this website."
};
