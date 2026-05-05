import { type SVGProps } from "react";

type FlagProps = SVGProps<SVGSVGElement>;

export function FlagBR(props: FlagProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width="20"
      height="15"
      {...props}
    >
      <rect width="640" height="480" fill="#009b3a" />
      <polygon points="320,60 590,240 320,420 50,240" fill="#fedf00" />
      <circle cx="320" cy="240" r="95" fill="#002776" />
      <path
        d="M196 270c40-50 130-70 248-30"
        fill="none"
        stroke="#fff"
        strokeWidth="14"
      />
    </svg>
  );
}

export function FlagES(props: FlagProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width="20"
      height="15"
      {...props}
    >
      <rect width="640" height="480" fill="#c60b1e" />
      <rect y="120" width="640" height="240" fill="#ffc400" />
    </svg>
  );
}

export function FlagUS(props: FlagProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 480"
      width="20"
      height="15"
      {...props}
    >
      {/* Stripes */}
      <rect width="640" height="480" fill="#fff" />
      <g fill="#b22234">
        <rect width="640" height="37" />
        <rect y="74" width="640" height="37" />
        <rect y="148" width="640" height="37" />
        <rect y="222" width="640" height="37" />
        <rect y="296" width="640" height="37" />
        <rect y="370" width="640" height="37" />
        <rect y="444" width="640" height="37" />
      </g>
      {/* Canton */}
      <rect width="256" height="259" fill="#3c3b6e" />
      {/* Simplified stars (3 rows) */}
      <g fill="#fff" fontSize="28" fontFamily="serif">
        <text x="20" y="55">&#9733; &#9733; &#9733; &#9733; &#9733;</text>
        <text x="38" y="95">&#9733; &#9733; &#9733; &#9733;</text>
        <text x="20" y="135">&#9733; &#9733; &#9733; &#9733; &#9733;</text>
        <text x="38" y="175">&#9733; &#9733; &#9733; &#9733;</text>
        <text x="20" y="215">&#9733; &#9733; &#9733; &#9733; &#9733;</text>
      </g>
    </svg>
  );
}
