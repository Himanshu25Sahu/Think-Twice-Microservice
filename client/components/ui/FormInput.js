"use client"

export function FormInput({ label, type = "text", placeholder, value, onChange, required = false, error }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#3F3F46]">
        {label}
        {required && <span className="text-[#DC2626] ml-1">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 bg-white border border-[#E7E2D6] rounded-xl text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all duration-200"
      />
      {error && <p className="text-[#DC2626] text-sm">{error}</p>}
    </div>
  )
}
