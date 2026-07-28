import AppSidebar from "@/components/AppSidebar";
import NewsWorkspace from "@/components/news/NewsWorkspace";

export default function NewsPage() {
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background">
      <AppSidebar activeItem="news" orientation="horizontal" />
      <div className="min-h-0 flex-1">
        <NewsWorkspace />
      </div>
    </div>
  );
}
