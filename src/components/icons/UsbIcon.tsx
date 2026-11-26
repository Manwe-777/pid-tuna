/**
 * USB connector icon. Single-path SVG sourced from SVG Repo
 * (https://www.svgrepo.com/svg/507091/usb-connection — CC0). Inlined here so
 * the fill follows `currentColor` and reacts to the button's hover state.
 */
export function UsbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 222.856 222.856"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M150.917,0l-41.326,41.327l-8.886-8.885l-67.994,67.997l13.427,13.427l-31.362,38.218l17.856,17.856L0,202.572l20.284,20.284l32.633-32.633l17.855,17.854l38.218-31.36l13.428,13.428l67.995-67.997l-8.882-8.882l41.325-41.326L150.917,0z M168.675,100.41l-6.972-6.972l11.571-11.569l-11.999-12.002l-11.572,11.57l-8.285-8.284l11.571-11.573l-11.999-11.997l-11.57,11.572l-6.972-6.972l28.47-28.471l46.227,46.228L168.675,100.41z" />
    </svg>
  );
}
