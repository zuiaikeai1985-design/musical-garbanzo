import React from "react";
import { MotifId, palette } from "../theme";

const stroke = palette.gold;

export const Motif: React.FC<{ id: MotifId; color: string }> = ({
  id,
  color,
}) => {
  switch (id) {
    case "dew":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <path
            d="M160 46 C168 92 214 128 214 176 A54 54 0 1 1 106 176 C106 128 152 92 160 46 Z"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <ellipse
            cx="148"
            cy="168"
            rx="10"
            ry="16"
            fill={palette.goldBright}
            opacity="0.55"
          />
          <path
            d="M70 250 C110 220 210 220 250 250"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            opacity="0.6"
          />
        </svg>
      );
    case "jade":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <circle
            cx="160"
            cy="160"
            r="86"
            fill="none"
            stroke={color}
            strokeWidth="10"
          />
          <circle
            cx="160"
            cy="160"
            r="28"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
          />
          <circle cx="160" cy="74" r="4" fill={stroke} />
          <circle cx="160" cy="246" r="4" fill={stroke} />
          <circle cx="74" cy="160" r="4" fill={stroke} />
          <circle cx="246" cy="160" r="4" fill={stroke} />
        </svg>
      );
    case "silkroad":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <path
            d="M20 230 C80 190 120 250 180 210 C230 178 270 220 310 196"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <path
            d="M20 258 C90 230 140 270 210 236 C250 218 280 250 310 234"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            opacity="0.7"
          />
          <circle cx="230" cy="88" r="22" fill="none" stroke={stroke} strokeWidth="2" />
          <circle cx="86" cy="120" r="3" fill={palette.goldBright} />
          <circle cx="118" cy="96" r="2" fill={palette.goldBright} />
          <circle cx="154" cy="128" r="2" fill={palette.goldBright} />
        </svg>
      );
    case "trousseau":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <path
            d="M160 70 C176 110 220 126 160 168 C100 126 144 110 160 70 Z"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <path
            d="M160 168 C176 208 220 224 160 266 C100 224 144 208 160 168 Z"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <path
            d="M70 168 C110 152 126 108 168 168 C126 228 110 184 70 168 Z"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
          />
          <path
            d="M250 168 C210 152 194 108 152 168 C194 228 210 184 250 168 Z"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
          />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <path
            d="M160 70 C210 70 250 108 250 150 C210 150 180 168 160 196 C140 168 110 150 70 150 C70 108 110 70 160 70 Z"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <line x1="160" y1="196" x2="160" y2="250" stroke={stroke} strokeWidth="2" />
          <line x1="92" y1="214" x2="80" y2="246" stroke={color} strokeWidth="1.5" />
          <line x1="124" y1="226" x2="114" y2="258" stroke={color} strokeWidth="1.5" />
          <line x1="196" y1="226" x2="206" y2="258" stroke={color} strokeWidth="1.5" />
          <line x1="228" y1="214" x2="240" y2="246" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "token":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <path
            d="M110 96 C150 70 186 96 186 138 C186 176 150 196 128 220"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M210 224 C170 250 134 224 134 182 C134 144 170 124 192 100"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="160" cy="160" r="8" fill={palette.goldBright} />
        </svg>
      );
    case "ocean":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <rect
            x="88"
            y="86"
            width="144"
            height="96"
            rx="6"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <path
            d="M88 92 L160 142 L232 92"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
          />
          <path
            d="M40 230 C80 210 110 250 160 228 C210 206 240 246 280 224"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
          <path
            d="M40 256 C90 236 120 276 170 254 C220 232 250 270 280 250"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            opacity="0.75"
          />
        </svg>
      );
    case "lamp":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <rect
            x="96"
            y="70"
            width="128"
            height="168"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <line x1="160" y1="70" x2="160" y2="238" stroke={stroke} strokeWidth="1.5" />
          <line x1="96" y1="126" x2="224" y2="126" stroke={stroke} strokeWidth="1.5" />
          <line x1="96" y1="182" x2="224" y2="182" stroke={stroke} strokeWidth="1.5" />
          <rect
            x="132"
            y="142"
            width="56"
            height="32"
            fill={palette.goldBright}
            opacity="0.35"
          />
        </svg>
      );
    case "palms":
      return (
        <svg viewBox="0 0 320 320" width={420} height={420}>
          <path
            d="M70 190 C90 140 140 120 160 168 C180 120 230 140 250 190 C230 236 190 256 160 236 C130 256 90 236 70 190 Z"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <circle
            cx="160"
            cy="176"
            r="22"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
          />
          <circle cx="160" cy="176" r="6" fill={palette.goldBright} />
        </svg>
      );
    default:
      return null;
  }
};
