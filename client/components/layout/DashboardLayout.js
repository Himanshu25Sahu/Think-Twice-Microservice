"use client"
import Sidebar from "./Sidebar"

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#FCFBF7]">
      <div className="flex">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}