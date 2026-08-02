"use client";

type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

type UserAvatarProps = {
  label: string;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
  active?: boolean;
  statusClassName?: string;
  statusPositionClassName?: string;
  className?: string;
  imageClassName?: string;
};

const SIZE_CLASSES: Record<UserAvatarSize, { frame: string; text: string; status: string }> = {
  xs: { frame: "h-5 w-5", text: "text-[6px]", status: "h-1.5 w-1.5 border" },
  sm: { frame: "h-7 w-7", text: "text-[8px]", status: "h-2.5 w-2.5 border-2" },
  md: { frame: "h-9 w-9", text: "text-[10px]", status: "h-2.5 w-2.5 border-2" },
  lg: { frame: "h-14 w-14", text: "text-[14px]", status: "h-3 w-3 border-2" },
  xl: { frame: "h-24 w-24", text: "text-[24px]", status: "h-3.5 w-3.5 border-2" },
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "KD";
}

function validAvatarUrl(value: string | null | undefined) {
  if (!value) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return value;
  if (/^https:\/\//i.test(value)) return value;
  return "";
}

export default function UserAvatar({
  label,
  avatarUrl,
  size = "md",
  active = false,
  statusClassName = "",
  statusPositionClassName = "",
  className = "",
  imageClassName = "",
}: UserAvatarProps) {
  const classes = SIZE_CLASSES[size];
  const source = validAvatarUrl(avatarUrl);
  return (
    <span className={`relative inline-flex shrink-0 ${classes.frame} ${className}`}>
      <span className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 font-semibold text-primary ${classes.text}`}>
        <span aria-hidden="true">{initials(label)}</span>
        {source ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source}
            alt={`${label} profile`}
            className={`absolute inset-0 h-full w-full object-cover object-center ${imageClassName}`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </span>
      {active || statusClassName ? <span className={`absolute -bottom-px -right-px rounded-full border-panel shadow-[0_0_8px_currentColor] ${statusPositionClassName} ${statusClassName || "bg-primary text-primary"} ${classes.status}`} /> : null}
    </span>
  );
}
