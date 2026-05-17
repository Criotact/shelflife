import { useMemo } from "react";
import { 
  BookOpen, Clock, UsersRound, Activity, TrendingUp, BarChart3, PieChart as PieChartIcon, 
  MapPin, Play, User as UserIcon
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie 
} from "recharts";
import { format } from "date-fns";
import { 
  Library, User, Session, UserStats, Book 
} from "../types";
import { StatsCard } from "./StatsCard";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { UserStatsList } from "./UserStatsList";
import { RecentItems } from "./RecentItems";
import { formatDuration } from "../lib/utils";

interface DashboardViewProps {
  recentBooks: Book[];
  totalBooks: number;
  sessions: Session[];
  userStats: UserStats[];
  libraries: Library[];
  activeSessions: Session[];
  darkMode: boolean;
}

export function DashboardView({ 
  recentBooks, totalBooks, sessions, userStats, libraries, activeSessions, darkMode 
}: DashboardViewProps) {
  
  const COLORS = darkMode 
    ? ['#5c6ea3', '#0d9488', '#d97706', '#dc2626', '#7c3aed'] // Muted variations for dark mode
    : ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const lineChartData = useMemo(() => {
    const activity: Record<string, number> = {};
    sessions.forEach(session => {
      const dateStr = format(session.startedAt, "MM/dd");
      const listeningTime = session.timeListening || session.duration || 0;
      activity[dateStr] = (activity[dateStr] || 0) + (listeningTime / 3600);
    });
    return Object.entries(activity)
      .map(([date, hours]) => ({ date, hours: parseFloat(hours.toFixed(1)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions]);

  const libraryDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    recentBooks.forEach(book => {
      const libName = libraries.find(l => l.id === book.libraryId)?.name || "Unknown";
      dist[libName] = (dist[libName] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [recentBooks, libraries]);

  const totalHours = useMemo(() => {
    return Math.floor(sessions.reduce((acc, s) => acc + (s.timeListening || s.duration || 0), 0) / 3600);
  }, [sessions]);

  const avgSession = useMemo(() => {
    if (sessions.length === 0) return "0m";
    const totalSecs = sessions.reduce((acc, s) => acc + (s.timeListening || s.duration || 0), 0);
    const avgSecs = totalSecs / sessions.length;
    return formatDuration(avgSecs);
  }, [sessions]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Total Books" value={totalBooks || recentBooks.length} icon={BookOpen} description="Library items" />
        <StatsCard title="Hours Listened" value={`${totalHours}h`} icon={Clock} description="Cumulative" />
        <StatsCard title="Active Listeners" value={activeSessions.length} icon={Play} description="Currently playing" />
        <StatsCard title="Avg Session" value={avgSession} icon={Activity} description="Per playback" />
      </div>

      {/* Current Activity Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Live Playback</h3>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Direct stream activity</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSessions.map((session) => (
            <div key={session.id} className="p-3 rounded-xl border border-indigo-50 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-900/20 flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-125 transition-transform">
                <Activity size={32} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden">
                  <UserIcon size={14} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">{session.username}</p>
                  <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">Now Listening</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{session.displayTitle || session.mediaItemTitle}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[9px] font-medium text-slate-500">Live for {formatDuration(Date.now() / 1000 - session.startedAt / 1000)}</p>
                  {session.progress !== undefined && (
                    <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">{Math.round(session.progress * 100)}%</p>
                  )}
                </div>
              </div>
              <div className="w-full bg-indigo-100 dark:bg-indigo-900/40 rounded-full h-0.5 mt-1">
                <div 
                  className="bg-indigo-600 dark:bg-indigo-500 h-0.5 rounded-full animate-pulse transition-all duration-1000" 
                  style={{ width: `${(session.progress || 0) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
          {activeSessions.length === 0 && (
            <div className="col-span-full p-4 text-center text-slate-400 text-[10px] italic">
              No active sessions at the moment.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Listening History</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Global hours consumed</p>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#2d3755" : "#f1f5f9"} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: darkMode ? '#2d3755' : '#fff', 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: '600'
                  }}
                />
                <Line type="monotone" dataKey="hours" stroke={darkMode ? "#7184bc" : "#6366f1"} strokeWidth={2} dot={{ r: 3, fill: darkMode ? '#7184bc' : '#6366f1', strokeWidth: 1.5, stroke: darkMode ? '#202940' : '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-4">Content Distribution</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={libraryDistribution} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                    {libraryDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#2d3755' : '#fff', 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '10px',
                      fontWeight: '600'
                    }}
                  />
                </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {libraryDistribution.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-900 dark:text-white">{item.value} items</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Recent Additions</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Latest library items</p>
            </div>
          </div>
          <RecentItems items={recentBooks} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">Top Listeners</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Engagement leaderboard</p>
            </div>
          </div>
          <UserStatsList stats={userStats.slice(0, 8)} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <ActivityHeatmap 
          title="Global Activity Intensity" 
          data={sessions.reduce((acc, s) => {
            const date = format(s.startedAt, "yyyy-MM-dd");
            const listeningTime = s.timeListening || s.duration || 0;
            acc[date] = (acc[date] || 0) + listeningTime;
            return acc;
          }, {} as Record<string, number>)} 
        />
      </div>
    </div>
  );
}
