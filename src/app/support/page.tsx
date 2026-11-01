import SupportDeskPanel from "@/components/support/SupportDeskPanel";
import Link from "next/link";
export default function SupportPage() { return <main className="flex h-dvh flex-col bg-background p-3 text-foreground sm:p-5"><header className="mx-auto mb-3 flex w-full max-w-5xl items-center justify-between"><h1 className="text-sm font-semibold">Support centre</h1><Link href="/charts" className="text-xs text-muted hover:text-foreground">Back to KwantDesk</Link></header><div className="mx-auto min-h-0 w-full max-w-5xl flex-1"><SupportDeskPanel page/></div></main>; }
