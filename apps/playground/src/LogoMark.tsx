// Seven strokes through one point: a burst, like light on a letterpress plate.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      viewBox="0 0 28 28"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14.0014 28V0M10.3783 27.523L17.6253 0.477035M7.00137 26.1244L21.0014 1.87564M4.10156 23.8994L23.9006 4.10039M1.87578 20.9997L26.1245 6.9997M0.477148 17.6227L27.5231 10.3758M0 13.9989H28"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
