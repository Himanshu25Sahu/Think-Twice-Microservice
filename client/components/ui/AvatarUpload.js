"use client"

import { useState } from "react"

export function AvatarUpload({ onImageSelect }) {
  const [preview, setPreview] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
        onImageSelect(file)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#3F3F46]">Profile Picture</label>
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 bg-[#F2EEE4] border-2 border-dashed border-[#D0C9BA] rounded-full flex items-center justify-center overflow-hidden">
          {preview ? (
            <img src={preview || "/placeholder.svg"} alt="Avatar preview" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-8 h-8 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          )}
        </div>
        <label className="cursor-pointer">
          <span className="bg-[#FFFFFF] hover:bg-[#F2EEE4] text-[#3F3F46] hover:text-[#18181B] px-4 py-2 rounded-lg border border-[#E7E2D6] transition-all duration-200">
            Choose File
          </span>
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </label>
      </div>
    </div>
  )
}
