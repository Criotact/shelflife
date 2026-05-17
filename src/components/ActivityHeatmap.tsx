import { useMemo } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface ActivityHeatmapProps {
  data: Record<string, number>; // date string (YYYY-MM-DD) -> duration in seconds
  title: string;
}

export function ActivityHeatmap({ data, title }: ActivityHeatmapProps) {
  const days = useMemo(() => {
    const end = new Date();
    // 52 weeks * 7 days
    const start = subDays(end, 363); 
    return eachDayOfInterval({ start, end });
  }, []);

  const getLevel = (seconds: number) => {
    if (!seconds || seconds === 0) return 0;
    if (seconds < 1800) return 1; // < 30m
    if (seconds < 3600) return 2; // < 1h
    if (seconds < 7200) return 3; // < 2h
    return 4; // > 2h
  };

  const levelStyles = [
    "bg-slate-100 dark:bg-slate-800", // heatmap-0
    "bg-indigo-100 dark:bg-indigo-900/30", // heatmap-1
    "bg-indigo-300 dark:bg-indigo-700/50", // heatmap-2
    "bg-indigo-500 dark:bg-indigo-500", // heatmap-3
    "bg-indigo-700 dark:bg-indigo-400", // heatmap-4
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[11px] font-bold text-slate-800 dark:text-white uppercase tracking-tight">{title}</h2>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Playback intensity over the last 12 months</p>
        </div>
        <div className="flex gap-3 items-center bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Quiet</span>
          <div className="flex gap-1">
            {levelStyles.map((style, i) => (
              <div key={i} className={cn("w-2 h-2 rounded-sm", style)} />
            ))}
          </div>
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Vibrant</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 overflow-hidden">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <div className="grid grid-rows-7 grid-flow-col gap-1">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const duration = data[dateStr] || 0;
              const level = getLevel(duration);
              
              return (
                <motion.div
                  key={dateStr}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.4, zIndex: 10, borderRadius: '2px' }}
                  className={cn(
                    "w-2.5 h-2.5 rounded-sm transition-all cursor-pointer relative group",
                    levelStyles[level]
                  )}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-bold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 shadow-xl">
                    <p className="text-indigo-400 mb-0.5">{format(day, "MMM d, yyyy")}</p>
                    <p>{Math.round(duration / 60)}m indexed</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-widest px-1">
          <span>{format(subDays(new Date(), 363), "MMM")}</span>
          <span>{format(subDays(new Date(), 270), "MMM")}</span>
          <span>{format(subDays(new Date(), 180), "MMM")}</span>
          <span>{format(subDays(new Date(), 90), "MMM")}</span>
          <span>{format(new Date(), "MMM")}</span>
        </div>
      </div>
    </div>
  );
}
