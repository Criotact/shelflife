import { UserStats } from "../types";
import { formatDuration, cn } from "../lib/utils";
import { User as UserIcon, Clock, ChevronRight } from "lucide-react";

interface UserStatsListProps {
  stats: UserStats[];
}

export function UserStatsList({ stats }: UserStatsListProps) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-grow flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                <th className="px-4 py-3">Listener</th>
                <th className="px-4 py-3">Total Time</th>
                <th className="px-4 py-3">Daily Avg</th>
                <th className="px-4 py-3 text-right">Engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-medium italic text-[10px]">No recent activity detected in this cycle.</td>
                </tr>
              ) : (
                stats.map((user) => (
                  <tr key={user.userId} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <UserIcon size={12} />
                        </div>
                        <span className="font-bold text-slate-900">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-bold text-slate-700">{formatDuration(user.totalTime)}</td>
                    <td className="px-4 py-2 text-slate-400 font-medium">{formatDuration(user.avgDaily)}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider",
                          user.totalTime > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                        )}>
                          {user.totalTime > 100000 ? "POWER" : user.totalTime > 0 ? "ACTIVE" : "IDLE"}
                        </span>
                        <ChevronRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
