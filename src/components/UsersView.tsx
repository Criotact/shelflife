import { useState, useMemo, useEffect } from "react";
import { 
  Users, Search, Filter, ChevronRight, Clock, Calendar, BarChart3, 
  History, User as UserIcon, TrendingUp, Music, LayoutGrid, List, BookOpen
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { User, Session, UserStats, Book } from "../types";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { formatDuration, cn } from "../lib/utils";

interface UsersViewProps {
  users: User[];
  sessions: Session[];
  userStats: UserStats[];
  books: Book[];
}

export function UsersView({ users, sessions, userStats, books }: UsersViewProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Reset showFullHistory when selected user changes
  useEffect(() => {
    setShowFullHistory(false);
  }, [selectedUserId]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [users, searchQuery]);

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const selectedUserStats = useMemo(() => {
    return userStats.find(s => s.userId === selectedUserId) || null;
  }, [userStats, selectedUserId]);

  const selectedUserSessions = useMemo(() => {
    return sessions
      .filter(s => s.userId === selectedUserId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }, [sessions, selectedUserId]);

  const last14DaysBooks = useMemo(() => {
    const cutoff = subDays(new Date(), 14).getTime();
    const seenBooks = new Set<string>();
    const booksList: { title: string; lastSession: Session }[] = [];

    selectedUserSessions.forEach(session => {
      if (session.startedAt >= cutoff) {
        const title = session.displayTitle || session.mediaItemTitle || "Unknown Book";
        if (!seenBooks.has(title)) {
          seenBooks.add(title);
          booksList.push({
            title,
            lastSession: session
          });
        }
      }
    });

    return booksList;
  }, [selectedUserSessions]);

  const getSessionBookInfo = (session: Session) => {
    const title = session.displayTitle || session.mediaItemTitle || "Unknown Book";
    const matchedBook = books.find(b => b.metadata.title.toLowerCase() === title.toLowerCase());
    const coverUrl = matchedBook?.metadata?.coverPath || `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`;
    const progressPercent = session.progress !== undefined 
      ? Math.round(session.progress * 100) 
      : (session.currentTime && session.duration 
        ? Math.round((session.currentTime / session.duration) * 100) 
        : null);
    return { coverUrl, progressPercent };
  };

  const userActivityChartData = useMemo(() => {
    if (!selectedUserId) return [];
    const last7Days = Array.from({ length: 14 }).map((_, i) => format(subDays(new Date(), i), "MM/dd")).reverse();
    return last7Days.map(date => {
      const daySessions = selectedUserSessions.filter(s => format(s.startedAt, "MM/dd") === date);
      const hours = daySessions.reduce((acc, s) => acc + (s.timeListening || s.duration || 0), 0) / 3600;
      return { date, hours: parseFloat(hours.toFixed(1)) };
    });
  }, [selectedUserSessions, selectedUserId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Sidebar List */}
      <div className="lg:col-span-3 flex flex-col gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-tight">Active Accounts</h3>
            <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest">{users.length} Total</span>
          </div>
          
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-lg py-1.5 pl-9 pr-3 text-[11px] font-medium focus:ring-1 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto no-scrollbar pr-1">
            {filteredUsers.map((user) => {
              const stats = userStats.find(s => s.userId === user.id);
              const isActive = selectedUserId === user.id;
              
              return (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl transition-all group",
                    isActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2 text-left">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border",
                      isActive ? "bg-white/20 border-white/20" : "bg-white border-slate-200 shadow-sm"
                    )}>
                      <UserIcon size={14} className={isActive ? "text-white" : "text-slate-600"} />
                    </div>
                    <div>
                      <p className={cn("text-[11px] font-bold uppercase tracking-tight", isActive ? "text-white" : "text-slate-900")}>
                        {user.username}
                      </p>
                      <p className={cn("text-[9px] font-medium", isActive ? "text-white/60" : "text-slate-400")}>
                        {user.type === 'admin' ? 'System Admin' : 'Listener'}
                      </p>
                    </div>
                  </div>
                  {!isActive && stats && (
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-900">{formatDuration(stats.totalTime)}</p>
                      <p className="text-[8px] text-slate-400 uppercase font-bold">Logged</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail View */}
      <div className="lg:col-span-9">
        {!selectedUserId ? (
          <div className="bg-white rounded-2xl border border-slate-200 border-dashed h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 gap-3 p-8">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center opacity-50">
              <Users size={24} />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pick a listener</p>
              <p className="text-[9px] font-medium">Select a user from the list to view their deep metrics and listening logs.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Header / Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
               <div className="flex flex-col md:flex-row gap-6 items-start md:items-center relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 border-2 border-white">
                  <UserIcon size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">{selectedUser?.username}</h2>
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold uppercase tracking-widest">
                      {selectedUser?.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold">{formatDuration(selectedUserStats?.totalTime || 0)} Total Time</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <TrendingUp size={12} />
                      <span className="text-[10px] font-bold">{formatDuration(selectedUserStats?.avgDaily || 0)}/Day Avg</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar size={12} />
                      <span className="text-[10px] font-bold">Joined {selectedUserStats?.joinedAt ? format(selectedUserStats.joinedAt, "MMM yyyy") : "Unknown"}</span>
                    </div>
                  </div>
                </div>
               </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-tight mb-4">Recent Activity (14 Days)</h3>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userActivityChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }} />
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
                      <Bar dataKey="hours" fill="#6366f1" radius={[2, 2, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-tight mb-2">Listener Profile</h3>
                {[
                  { label: "Top Genre", value: selectedUserStats?.topGenre || "Mixed", icon: Music },
                  { label: "Preferred Time", value: selectedUserStats?.preferredTime || "Varies", icon: Clock },
                  { label: "Device Usage", value: selectedUserStats?.deviceUsage || "Web Client", icon: LayoutGrid },
                  { label: "Completion Rate", value: `${selectedUserStats?.completionRate || 0}%`, icon: TrendingUp },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <item.icon size={12} className="text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{item.label}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <ActivityHeatmap 
                title="Yearly Listening Intensity"
                data={selectedUserStats?.activity || {}}
              />
            </div>

            {/* Session Logs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-tight">Listening Sessions</h3>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                    {showFullHistory ? "Detailed playback history" : "Books listened to in the last 14 days"}
                  </p>
                </div>
                <button 
                  onClick={() => setShowFullHistory(!showFullHistory)}
                  className="flex items-center gap-2 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md text-[9px] font-bold uppercase tracking-widest transition-colors shadow-sm animate-pulse-subtle"
                >
                  {showFullHistory ? (
                    <>
                      <BookOpen size={10} /> Show Recent Books
                    </>
                  ) : (
                    <>
                      <List size={10} /> View Full Log
                    </>
                  )}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">{showFullHistory ? "Title" : "Book Title"}</th>
                      <th className="px-4 py-2">{showFullHistory ? "Duration" : "Last Session Duration"}</th>
                      <th className="px-4 py-2">{showFullHistory ? "Timestamp" : "Last Listened"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {showFullHistory ? (
                      selectedUserSessions.map((session) => {
                        const { coverUrl, progressPercent } = getSessionBookInfo(session);
                        return (
                          <tr key={session.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full inline-block",
                                session.isActive ? "bg-indigo-500 animate-pulse" : "bg-emerald-400"
                              )} />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={coverUrl} 
                                  alt={session.displayTitle || session.mediaItemTitle} 
                                  className="w-7 h-10 rounded object-cover shadow-sm bg-slate-100 shrink-0 border border-slate-200/50"
                                  onError={(e) => {
                                    const title = session.displayTitle || session.mediaItemTitle || "Book";
                                    (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`;
                                  }}
                                />
                                <div>
                                  <p className="text-[11px] font-bold text-slate-900 line-clamp-1">{session.displayTitle || session.mediaItemTitle}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {progressPercent !== null && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">
                                          {progressPercent}%
                                        </span>
                                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-indigo-600 rounded-full" 
                                            style={{ width: `${progressPercent}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    <span className="text-[8px] text-slate-400 font-medium">
                                      ID: {session.id.split('_').pop()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 font-bold text-slate-700 text-[11px]">
                              {formatDuration(session.timeListening || session.duration || 0)}
                            </td>
                            <td className="px-4 py-2">
                              <p className="text-[10px] font-medium text-slate-500">{format(session.startedAt, "MMM d, HH:mm")}</p>
                              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tight">{formatDistanceToNow(session.startedAt)} ago</p>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      last14DaysBooks.length > 0 ? (
                        last14DaysBooks.map(({ title, lastSession }) => {
                          const { coverUrl, progressPercent } = getSessionBookInfo(lastSession);
                          return (
                            <tr key={lastSession.id} className="group hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <img 
                                    src={coverUrl} 
                                    alt={title} 
                                    className="w-7 h-10 rounded object-cover shadow-sm bg-slate-100 shrink-0 border border-slate-200/50"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`;
                                    }}
                                  />
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-900 line-clamp-1">{title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {progressPercent !== null && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">
                                            {progressPercent}%
                                          </span>
                                          <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-indigo-600 rounded-full" 
                                              style={{ width: `${progressPercent}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                      <span className="text-[8px] text-slate-400 font-medium">
                                        ID: {lastSession.id.split('_').pop()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2 font-bold text-slate-700 text-[11px]">
                                {formatDuration(lastSession.timeListening || lastSession.duration || 0)}
                              </td>
                              <td className="px-4 py-2">
                                <p className="text-[10px] font-medium text-slate-500">{format(lastSession.startedAt, "MMM d, HH:mm")}</p>
                                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tight">{formatDistanceToNow(lastSession.startedAt)} ago</p>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-[10px] font-medium">
                            No books listened to in the last 14 days. Click "View Full Log" to see all history.
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
