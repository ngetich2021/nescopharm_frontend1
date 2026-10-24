import type React from "react"
import { Sidebar } from "@/components/sidebar/sidebar"
import { TopNav } from "@/components/navigation/top-nav"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <div data-sidebar className="sidebar-container print:hidden">
        <Sidebar />
      </div>
      {/* min-w-0: a wide page (report tables, tab rows) must not stretch this column past the
          screen - that pushed the top bar's Reports / notifications / profile off the right edge.
          Wide content scrolls sideways inside <main> instead. */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden print:block print:overflow-visible">
        <div data-topnav className="top-nav-container print:hidden">
          <TopNav />
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-auto bg-gray-50 p-2 sm:p-4 lg:p-6 print:p-0 print:bg-white print:overflow-visible print-content-wrapper">{children}</main>
      </div>
    </div>
  )
}
