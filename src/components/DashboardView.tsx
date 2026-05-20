import { useMemo, useState } from "react";
import { 
  BookOpen, Clock, UsersRound, Activity, 
  Play, User as UserIcon
} from "lucide-react";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line 
} from "recharts";
import { format, subDays, isAfter, formatDistanceToNow } from "date-fns";
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
  sessionsLoading: boolean;
}

export function DashboardView({ 
  recentBooks, totalBooks, sessions, userStats, libraries, activeSessions, sessionsLoading
}: DashboardViewProps) {
  const [chartView, setChartView] = useState<'total' | 'users'>('total');
  const [timeframe, setTimeframe] = useState<'7' | '30' | '365' | 'all'>('30');
  
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

  const last7DaysActivitiesGrouped = useMemo(() => {
    const cutoff = subDays(new Date(), 7).getTime();
    const recentSessions = sessions.filter(s => s.startedAt >= cutoff);

    // Build userId -> username lookup map from userStats
    const usernameMap: Record<string, string> = {};
    userStats.forEach(u => {
      usernameMap[u.userId] = u.username;
    });

    const groups: Record<string, { 
      userId: string; 
      username: string; 
      mostRecentActiveTime: number; 
      totalTime: number;
      uniqueBooks: { 
        title: string; 
        lastSession: Session; 
      }[];
    }> = {};

    recentSessions.forEach(session => {
      const uId = session.userId;
      const title = session.displayTitle || session.mediaItemTitle || "Unknown Book";
      const time = session.timeListening || session.duration || 0;

      if (!groups[uId]) {
        groups[uId] = {
          userId: uId,
          username: usernameMap[uId] || session.username || "Unknown",
          mostRecentActiveTime: session.startedAt,
          totalTime: 0,
          uniqueBooks: []
        };
      }

      groups[uId].totalTime += time;
      if (session.startedAt > groups[uId].mostRecentActiveTime) {
        groups[uId].mostRecentActiveTime = session.startedAt;
      }

      const existingBook = groups[uId].uniqueBooks.find(b => b.title.toLowerCase() === title.toLowerCase());
      if (!existingBook) {
        groups[uId].uniqueBooks.push({
          title,
          lastSession: session
        });
      } else {
        if (session.startedAt > existingBook.lastSession.startedAt) {
          existingBook.lastSession = session;
        }
      }
    });

    const groupedList = Object.values(groups).map(g => {
      g.uniqueBooks.sort((a, b) => b.lastSession.startedAt - a.lastSession.startedAt);
      return {
        ...g,
        uniqueBooks: g.uniqueBooks.slice(0, 3)
      };
    });

    groupedList.sort((a, b) => b.mostRecentActiveTime - a.mostRecentActiveTime);

    return groupedList;
  }, [sessions, userStats]);

  const getSessionBookInfo = (session: Session) => {
    const title = session.displayTitle || session.mediaItemTitle || "Unknown Book";
    const matchedBook = recentBooks.find(b => b.metadata.title.toLowerCase() === title.toLowerCase());
    const coverUrl = matchedBook?.metadata?.coverPath || `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`;
    const progressPercent = session.progress !== undefined 
      ? Math.round(session.progress * 100) 
      : (session.currentTime && session.duration 
        ? Math.round((session.currentTime / session.duration) * 100) 
        : null);
    return { coverUrl, progressPercent };
  };

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
          {sessionsLoading ? (
            <div className="h-[240px] w-full flex flex-col justify-end gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100 animate-pulse relative overflow-hidden select-none">
              <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
                <div className="flex flex-col items-center gap-2">
                  <Activity size={24} className="text-indigo-500 animate-spin" style={{ animationDuration: '3s' }} />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analyzing listening trends...</p>
                </div>
              </div>
              <div className="flex items-end justify-between h-40 px-2 opacity-40">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-4 bg-slate-200 rounded-t-sm" 
                    style={{ height: `${Math.sin(i * 0.5) * 50 + 60}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between border-t border-slate-200/50 pt-2 px-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-8 h-2.5 bg-slate-200 rounded-sm" />
                ))}
              </div>
            </div>
          ) : (
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
          )}
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

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4 px-2 shrink-0">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Recent Activity (7 Days)</h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Weekly user engagement & book summaries</p>
            </div>
          </div>
          
          <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-3 pr-1">
            {sessionsLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-1.5 rounded-2xl border border-slate-100 bg-slate-50/30 animate-pulse select-none">
                  {/* Pulsing User identity row */}
                  <div className="flex items-center justify-between px-2 py-1 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                      <div className="w-16 h-3 bg-slate-200 rounded shrink-0" />
                    </div>
                    <div className="w-12 h-4 bg-slate-100 rounded-full" />
                  </div>
                  {/* Pulsing sub-book items */}
                  <div className="flex flex-col gap-1.5 px-1 pb-1">
                    {Array.from({ length: 2 }).map((_, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-3 p-1.5 rounded-xl bg-white border border-slate-100">
                        <div className="w-7 h-7 bg-slate-200 rounded shrink-0" />
                        <div className="flex-grow">
                          <div className="w-24 h-3 bg-slate-200 rounded mb-1" />
                          <div className="w-16 h-2.5 bg-slate-100 rounded" />
                        </div>
                        <div className="w-10 h-2.5 bg-slate-100 rounded shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <>
                {last7DaysActivitiesGrouped.map((user) => (
                  <div key={user.userId} className="flex flex-col gap-2 p-1.5 rounded-2xl border border-slate-100 bg-slate-50/30">
                    {/* User identity row */}
                    <div className="flex items-center justify-between px-2 py-1 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center text-[10px] font-black shadow-sm uppercase shrink-0">
                          {user.username.charAt(0)}
                        </div>
                        <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">{user.username}</span>
                      </div>
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                        {formatDuration(user.totalTime)}
                      </span>
                    </div>

                    {/* Sub-list of up to 3 unique books */}
                    <div className="flex flex-col gap-1.5 px-1 pb-1">
                      {user.uniqueBooks.map(({ title, lastSession }) => {
                        const { coverUrl, progressPercent } = getSessionBookInfo(lastSession);
                        return (
                          <div key={lastSession.id} className="flex items-center gap-3 p-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-100 transition-all group/book">
                            <img 
                              src={coverUrl} 
                              alt={title} 
                              className="w-7 h-7 aspect-square rounded object-cover shadow-sm bg-slate-100 shrink-0 border border-slate-200/50 group-hover/book:scale-105 transition-transform"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`;
                              }}
                            />
                            <div className="flex-grow min-w-0">
                              <p className="text-[10px] font-bold text-slate-800 truncate group-hover/book:text-indigo-600 transition-colors">{title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {progressPercent !== null && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[8px] font-extrabold text-indigo-600 bg-indigo-50 px-0.5 rounded shrink-0">
                                      {progressPercent}%
                                    </span>
                                    <div className="w-8 h-0.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                      <div 
                                        className="h-full bg-indigo-600 rounded-full" 
                                        style={{ width: `${progressPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                                <span className="text-[8px] text-slate-400 font-medium truncate">
                                  Session: {formatDuration(lastSession.timeListening || lastSession.duration || 0)}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tight">{formatDistanceToNow(lastSession.startedAt)} ago</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {last7DaysActivitiesGrouped.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2 py-12 flex-grow">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center opacity-60">
                      <Activity size={18} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Silence reigns</p>
                      <p className="text-[8px] font-medium text-slate-400">No user activity recorded in the last 7 days.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
