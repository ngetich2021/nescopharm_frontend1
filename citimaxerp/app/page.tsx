// Keep the root entry point and the canonical sign-in route on the same login
// experience. The image-led layout lives in the sign-in route; re-exporting it
// here prevents the older, form-only login from being shown at "/".
export { default } from "./sign-in/[[...sign-in]]/page"
