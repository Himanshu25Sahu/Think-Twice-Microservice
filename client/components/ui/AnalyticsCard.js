// components/ui/AnalyticsCard.jsx
import React from "react";

const AnalyticsCard = ({ title, value, subtitle, trend, color }) => {
  const getTrendColor = (trendValue) => {
    return trendValue >= 0 ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-[#E7E2D6]">
      <h3 className="text-sm font-medium text-[#71717A] mb-2">{title}</h3>
      <div className="text-2xl font-bold text-[#18181B] mb-1">{value}</div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#A1A1AA]">{subtitle}</p>
        <div className={`text-xs font-medium ${getTrendColor(trend)}`}>
          {trend >= 0 ? `+${trend}%` : `${trend}%`}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCard;