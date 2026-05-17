import { useMemo, useState } from "react";
import { 
  BookOpen, Clock, UsersRound, Activity, 
  Play, User as UserIcon
} from "lucide-react";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line 
} from "recharts";
import { format, subDays, isAfter } from "date-fns";
import { 
  Library, User, Session, UserStats, Book 
} from "../types";
import { StatsCard } from "./StatsCard";
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
}

export function DashboardView({ 
  recentBooks, totalBooks, sessions, userStats, libraries, activeSessions 
}: DashboardViewProps) {
  const [chartView, setChartView] = useState<'total' | 'users'>('total');
  const [timeframe, setTimeframe] = useState<'7' | '30' | '365' | 'all'>('all');
  
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const filteredSessions = useMemo(() => {
    if (timeframe === 'all') return sessions;
    const cutoff = subDays(new Date(), parseInt(timeframe));
    return sessions.filter(s => isAfter(new Date(s.startedAt), cutoff));
  }, [sessions, timeframe]);

  const topUsers = useMemo(() => userStats.slice(0, 5), [userStats]);

  const lineChartData = useMemo(() => {
    const activity: Record<string, any> = {};
    
    filteredSessions.forEach(session => {
      const dateStr = format(session.startedAt, "MM/dd");
      const listeningTime = (session.timeListening || session.duration || 0) / 3600;

      if (!activity[dateStr]) {
        activity[dateStr] = { date: dateStr, hours: 0 };
        if (chartView === 'users') {
          topUsers.forEach(u => { activity[dateStr][u.username] = 0; });
        }
      }

      if (chartView === 'total') {
        activity[dateStr].hours += listeningTime;
      } else {
        const isTopUser = topUsers.find(u => u.userId === session.userId);
        if (isTopUser) {
          activity[dateStr][isTopUser.username] = (activity[dateStr][isTopUser.username] || 0) + listeningTime;
        }
      }
    });

    return Object.values(activity)
      .map(entry => {
        const newEntry = { ...entry };
        if (chartView === 'total') {
          newEntry.hours = parseFloat(entry.hours.toFixed(1));
        } else {
          topUsers.forEach(u => {
            newEntry[u.username] = parseFloat((entry[u.username] || 0).toFixed(1));
          });
        }
        return newEntry;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSessions, chartView, topUsers]);

  const totalHours = useMemo(() => {
    return Math.floor(filteredSessions.reduce((acc, s) => acc + (s.timeListening || s.duration || 0), 0) / 3600);
  }, [filteredSessions]);

  const avgSession = useMemo(() => {
    if (filteredSessions.length === 0) return "0m";
    const totalSecs = filteredSessions.reduce((acc, s) => acc + (s.timeListening || s.duration || 0), 0);
    const avgSecs = totalSecs / filteredSessions.length;
    return formatDuration(avgSecs);
  }, [filteredSessions]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Total Books" value={totalBooks || recentBooks.length} icon={BookOpen} description="Library items" />
        <StatsCard title="Hours Listened" value={`${totalHours}h`} icon={Clock} description="Cumulative" />
        <StatsCard title="Active Listeners" value={activeSessions.length} icon={Play} description="Currently playing" />
        <StatsCard title="Avg Session" value={avgSession} icon={Activity} description="Per playback" />
      </div>

      {/* Current Activity Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Live Playback</h3>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Direct stream activity</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSessions.map((session) => (
            <div key={session.id} className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-125 transition-transform">
                <Activity size={32} className="text-indigo-600" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden">
                  <UserIcon size={14} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">{session.username}</p>
                  <p className="text-[9px] text-indigo-600 font-semibold uppercase">Now Listening</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 truncate">{session.displayTitle || session.mediaItemTitle}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[9px] font-medium text-slate-500">Live for {formatDuration(Date.now() / 1000 - session.startedAt / 1000)}</p>
                  {session.progress !== undefined && (
                    <p className="text-[9px] font-bold text-indigo-600">{Math.round(session.progress * 100)}%</p>
                  )}
                </div>
              </div>
              <div className="w-full bg-indigo-100 rounded-full h-0.5 mt-1">
                <div 
                  className="bg-indigo-600 h-0.5 rounded-full animate-pulse transition-all duration-1000" 
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Listening History</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                {chartView === 'total' ? 'Global hours consumed' : 'Top 5 users intensity'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                {[
                  { label: '7D', value: '7' },
                  { label: '30D', value: '30' },
                  { label: '1Y', value: '365' },
                  { label: 'ALL', value: 'all' }
                ].map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value as any)}
                    className={`px-2 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${timeframe === tf.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-slate-200 mx-1"></div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setChartView('total')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-lg transition-all ${chartView === 'total' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Total
                </button>
                <button 
                  onClick={() => setChartView('users')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-lg transition-all ${chartView === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  By User
                </button>
              </div>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: '600'
                  }}
                />
                {chartView === 'total' ? (
                  <Line 
                    type="monotone" 
                    dataKey="hours" 
                    stroke="#6366f1" 
                    strokeWidth={2} 
                    dot={{ r: 3, fill: '#6366f1', strokeWidth: 1.5, stroke: '#fff' }} 
                    activeDot={{ r: 5, strokeWidth: 0 }} 
                  />
                ) : (
                  topUsers.map((user, idx) => (
                    <Line 
                      key={user.userId}
                      type="monotone" 
                      dataKey={user.username} 
                      stroke={COLORS[idx % COLORS.length]} 
                      strokeWidth={2} 
                      dot={{ r: 2, fill: COLORS[idx % COLORS.length], strokeWidth: 1, stroke: '#fff' }} 
                      activeDot={{ r: 4, strokeWidth: 0 }} 
                    />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Recent Additions</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Latest library items</p>
            </div>
          </div>
          <RecentItems items={recentBooks} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Top Listeners</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Engagement leaderboard</p>
            </div>
          </div>
          <UserStatsList stats={userStats.slice(0, 8)} />
        </div>
      </div>

    </div>
  );
}
