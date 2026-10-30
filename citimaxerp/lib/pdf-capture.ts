// html2canvas draws text a few pixels low when images are display:block (Tailwind's base style),
// so in downloaded PDFs words slipped out of their boxes and borders ran through them. The copy it
// renders is given inline images instead; the page itself is untouched.
export function fixTextOffset(clonedDoc: Document): void {
  const style = clonedDoc.createElement("style")
  style.textContent = "img { display: inline-block !important; }"
  clonedDoc.head.appendChild(style)
}
