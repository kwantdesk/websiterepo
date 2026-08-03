"use client";

const MESSAGE_LINK_PATTERN = /(https?:\/\/[^\s]+)/g;

export default function LinkedMessageBody({
  body,
  className = "",
}: {
  body: string;
  className?: string;
}) {
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {body.split(MESSAGE_LINK_PATTERN).map((part, index) => (
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}:${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline decoration-current/40 underline-offset-2 hover:decoration-current"
          >
            View post
          </a>
        ) : <span key={`text:${index}`}>{part}</span>
      ))}
    </div>
  );
}
