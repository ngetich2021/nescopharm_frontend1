// html2canvas works out where text sits by measuring a hidden 1x1 image placed next to sample text
// in the live page. Tailwind's base style makes every image display:block, which throws that
// measurement off, so in downloaded PDFs words were drawn a few pixels low - out of their boxes,
// with borders running through them. Its measuring image (a 1x1 GIF given width="1") is put back
// inline in the live page, and the copy it renders gets inline images too.
const MEASURE_FIX_ID = "html2canvas-text-offset-fix"

export function fixTextOffset(clonedDoc: Document): void {
  if (!document.getElementById(MEASURE_FIX_ID)) {
    const live = document.createElement("style")
    live.id = MEASURE_FIX_ID
    live.textContent = 'img[width="1"][src^="data:image/gif"] { display: inline !important; }'
    document.head.appendChild(live)
  }
  const style = clonedDoc.createElement("style")
  style.textContent = "img { display: inline-block !important; }"
  clonedDoc.head.appendChild(style)
}
