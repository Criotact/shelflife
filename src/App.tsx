import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  Library as LibraryIcon, 
  BarChart3, 
  Activity,
  Settings,
  Search,
  Bell,
  User as UserIcon,
  Menu,
  X,
  AlertCircle,
  RefreshCcw
} from "lucide-react";
import axios from "axios";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";

import { 
  Library, 
  User, 
  Session, 
  UserStats, 
  Book 
} from "./types";
import { DashboardView } from "./components/DashboardView";
import { UsersView } from "./components/UsersView";
import { LibraryView } from "./components/LibraryView";
import { SettingsView } from "./components/SettingsView";
import { cn } from "./lib/utils";

const NAV_ITEMS = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
  { id: 'users', icon: Users, label: 'Listeners' },
  { id: 'library', icon: LibraryIcon, label: 'Libraries' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Data state
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      
      setError(null);

      // check health (presence of env vars)
      const healthRes = await axios.get("/api/abs/health");
      if (healthRes.data.error) {
        setError(healthRes.data.error);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [libRes, userRes, sessionRes, recentRes, onlineRes] = await Promise.all([
        axios.get("/api/abs/libraries"),
        axios.get("/api/abs/users"),
        axios.get("/api/abs/sessions?itemsPerPage=5000&sort=startedAt&desc=1"),
        axios.get("/api/abs/recent"),
        axios.get("/api/abs/users/online")
      ]);

      setLibraries(libRes.data.libraries || libRes.data || []);
      setUsers(userRes.data.users || userRes.data || []);
      
      const allSessions = sessionRes.data.sessions || sessionRes.data || [];
      setSessions(allSessions);
      
      const rawUsers: any[] = userRes.data.users || userRes.data || [];
      const usersOnline: any[] = onlineRes.data.usersOnline || [];
      const userMap: Record<string, string> = {};
      rawUsers.forEach((u: any) => { userMap[u.id] = u.username; });
      usersOnline.forEach((u: any) => { if (!userMap[u.id]) userMap[u.id] = u.username; });

      const STALE_THRESHOLD = 10 * 60 * 1000;
      const isRecentlyActive = (s: any) => {
        if (s.updatedAt) return (Date.now() - s.updatedAt) < STALE_THRESHOLD;
        return (Date.now() - (s.startedAt + (s.timeListening || 0) * 1000)) < STALE_THRESHOLD;
      };

      const openSessions = (onlineRes.data.openSessions || [])
        .filter(isRecentlyActive)
        .map((s: any) => ({
          ...s,
          username: s.username || userMap[s.userId] || s.userId,
        }));
      setActiveSessions(openSessions);
      
      const items = recentRes.data.results || recentRes.data || [];
      // Transform Audiobookshelf API response to match Book type
      const transformedBooks: Book[] = items.map((item: any) => {
        const mediaMeta = item.media?.metadata || item.metadata || { title: "Unknown Title", authorName: "Unknown Author" };
        return {
          id: item.id,
          libraryId: item.libraryId,
          metadata: {
            title: mediaMeta.title,
            authorName: mediaMeta.authorName,
            coverPath: `/metadata/items/${item.id}/cover.jpg`,
          },
          addedAt: item.addedAt,
        };
      });
      setBooks(transformedBooks);
      setTotalBooks(recentRes.data.totalBooks || 0);
    } catch (err: any) {
      console.error(err);
      setError("Failed to connect to Audiobookshelf. Please check your ABS_URL and ABS_TOKEN.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Fetch data
  useEffect(() => {
    fetchData(true);
    // Refresh active sessions every 30 seconds
    const interval = setInterval(async () => {
      try {
        const onlineRes = await axios.get("/api/abs/users/online");
        const onlineUserMap: Record<string, string> = {};
        (onlineRes.data.usersOnline || []).forEach((u: any) => { onlineUserMap[u.id] = u.username; });
        // Merge with existing userMap from state
        users.forEach(u => { if (!onlineUserMap[u.id]) onlineUserMap[u.id] = u.username; });
        const STALE_THRESHOLD = 10 * 60 * 1000;
        const isRecentlyActive = (s: any) => {
          if (s.updatedAt) return (Date.now() - s.updatedAt) < STALE_THRESHOLD;
          return (Date.now() - (s.startedAt + (s.timeListening || 0) * 1000)) < STALE_THRESHOLD;
        };
        const openSessions = (onlineRes.data.openSessions || [])
          .filter(isRecentlyActive)
          .map((s: any) => ({
            ...s,
            username: s.username || onlineUserMap[s.userId] || s.userId,
          }));
        setActiveSessions(openSessions);
      } catch (e) {
        console.error("Failed to refresh active sessions", e);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Aggregate User Stats for both Dashboard and Users View
  const userStats = useMemo(() => {
    const statsMap: Record<string, UserStats> = {};
    const userMap: Record<string, string> = {};
    users.forEach(u => { userMap[u.id] = u.username; });

    // Track hour distribution, completion, genres, and devices for each user
    const hourDistribution: Record<string, number[]> = {};
    const completionData: Record<string, { listened: number; total: number }> = {};
    const firstSession: Record<string, number> = {};
    const genreCounts: Record<string, Record<string, number>> = {};
    const deviceCounts: Record<string, Record<string, number>> = {};

    sessions.forEach(session => {
      if (!statsMap[session.userId]) {
        statsMap[session.userId] = {
          userId: session.userId,
          username: userMap[session.userId] || session.username || session.userId,
          totalTime: 0,
          avgDaily: 0,
          activity: {},
          joinedAt: session.startedAt,
          preferredTime: "",
          completionRate: 0,
          deviceUsage: "Web Client",
          topGenre: "Mixed"
        };
        hourDistribution[session.userId] = new Array(24).fill(0);
        completionData[session.userId] = { listened: 0, total: 0 };
        firstSession[session.userId] = session.startedAt;
        genreCounts[session.userId] = {};
        deviceCounts[session.userId] = {};
      }

      // Track earliest session as join date proxy
      if (session.startedAt < firstSession[session.userId]) {
        firstSession[session.userId] = session.startedAt;
      }

      const dateStr = format(session.startedAt, "yyyy-MM-dd");
      const listeningTime = session.timeListening || session.duration || 0;
      statsMap[session.userId].totalTime += listeningTime;
      statsMap[session.userId].activity[dateStr] = (statsMap[session.userId].activity[dateStr] || 0) + listeningTime;

      // Track hour distribution
      const hour = new Date(session.startedAt).getHours();
      hourDistribution[session.userId][hour]++;

      // Track completion rate
      if (session.duration && session.duration > 0) {
        completionData[session.userId].listened += session.timeListening || 0;
        completionData[session.userId].total += session.duration;
      }

      // Track genres from raw metadata
      const rawSession = session as any;
      const genres = rawSession.mediaMetadata?.genres || [];
      if (Array.isArray(genres)) {
        genres.forEach((g: string) => {
          if (g) {
            genreCounts[session.userId][g] = (genreCounts[session.userId][g] || 0) + 1;
          }
        });
      }

      // Track client device usage
      const clientName = rawSession.deviceInfo?.clientName;
      if (clientName) {
        deviceCounts[session.userId][clientName] = (deviceCounts[session.userId][clientName] || 0) + 1;
      }
    });

    return Object.values(statsMap).map(user => {
      const activeDays = Object.keys(user.activity).length;
      user.avgDaily = activeDays > 0 ? user.totalTime / activeDays : 0;
      user.joinedAt = firstSession[user.userId];

      // Calculate preferred time from hour distribution
      const hours = hourDistribution[user.userId];
      if (hours) {
        const maxCount = Math.max(...hours);
        const peakHour = hours.indexOf(maxCount);
        if (maxCount > 0) {
          const label = getTimeLabel(peakHour);
          user.preferredTime = `${label} (${peakHour}:00-${peakHour + 1}:00)`;
        } else {
          user.preferredTime = "Varies";
        }
      }

      // Calculate completion rate
      const comp = completionData[user.userId];
      if (comp && comp.total > 0) {
        user.completionRate = Math.round((comp.listened / comp.total) * 100);
      }

      // Calculate top genre dynamically
      const userGenres = genreCounts[user.userId];
      if (userGenres && Object.keys(userGenres).length > 0) {
        let topG = "Mixed";
        let maxGCount = 0;
        Object.entries(userGenres).forEach(([genre, count]) => {
          if (count > maxGCount) {
            maxGCount = count;
            topG = genre;
          }
        });
        user.topGenre = topG;
      }

      // Calculate device usage dynamically
      const userDevices = deviceCounts[user.userId];
      if (userDevices && Object.keys(userDevices).length > 0) {
        let topD = "Web Client";
        let maxDCount = 0;
        Object.entries(userDevices).forEach(([device, count]) => {
          if (count > maxDCount) {
            maxDCount = count;
            topD = device;
          }
        });
        user.deviceUsage = topD;
      }

      return user;
    }).sort((a, b) => b.totalTime - a.totalTime);
  }, [sessions, users]);

  // Helper to format time preference
  function getTimeLabel(hour: number): string {
    if (hour >= 5 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 21) return "Evening";
    return "Night";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Activity className="animate-spin mb-4 text-indigo-600 mx-auto" size={48} />
          <h2 className="text-xl font-bold text-slate-800">Synchronizing Dashboard...</h2>
          <p className="text-slate-500 mt-2 text-sm font-medium">Hold on, we're fetching your audiobooks data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-10 text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Configuration Required</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            {error}
          </p>
          <div className="space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Steps to fix:</p>
            <ol className="text-left text-sm text-slate-600 space-y-2 list-decimal list-inside">
              <li>Open the <strong>Secrets</strong> panel or <code>.env</code> file.</li>
              <li>Add <code>ABS_URL</code> with your server address.</li>
              <li>Add <code>ABS_TOKEN</code> with your API token.</li>
              <li>Restart the application.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden lg:flex h-screen border-r border-slate-200 bg-white flex-col sticky top-0 z-50 shrink-0 w-[240px]">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold italic shadow-md shadow-indigo-100 ring-2 ring-indigo-50">S</div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Shelf<span className="text-indigo-600">Life</span></h1>
          </div>
          
          <nav className="space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-tight transition-all",
                  activeTab === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col min-h-screen min-w-0 pb-20 lg:pb-0">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex lg:hidden items-center gap-2 mr-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">S</div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">Shelf<span className="text-indigo-600">Life</span></h1>
            </div>
            <div className="hidden sm:flex items-center gap-3 bg-white border border-slate-200 px-4 py-1.5 rounded-xl w-64 md:w-80 group focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <Search size={14} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Query database..." 
                className="bg-transparent border-none text-[11px] font-medium focus:ring-0 placeholder:text-slate-400 w-full outline-none text-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              className="sm:hidden p-2 bg-white border border-slate-200 rounded-lg text-slate-500"
            >
              <Search size={18} />
            </button>
            <button 
              onClick={() => fetchData()}
              disabled={refreshing}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCcw size={18} className={cn(refreshing && "animate-spin")} />
            </button>
            <button className="relative p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">SUPER_ADMIN</p>
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tight">Root Node Access</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center border-2 border-slate-200 shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                <UserIcon size={16} className="text-indigo-600" />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <section className="p-6 max-w-[1600px] mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {activeTab === 'dashboard' && (
                <DashboardView 
                  recentBooks={books}
                  totalBooks={totalBooks}
                  sessions={sessions}
                  userStats={userStats}
                  libraries={libraries}
                  activeSessions={activeSessions}
                />
              )}
              {activeTab === 'users' && (
                <UsersView 
                  users={users}
                  sessions={sessions}
                  userStats={userStats}
                  books={books}
                />
              )}
              {activeTab === 'library' && (
                <LibraryView 
                  books={books}
                  libraries={libraries}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsView />
              )}
              {activeTab === 'activity' && (
                <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center text-slate-400 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <Activity size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{activeTab} node pending</h3>
                    <p className="text-sm font-medium">This module is part of the next rollout phase. Root access verified.</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
        {/* Bottom Navigation - Mobile Only */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-2xl z-50 p-2 flex items-center justify-around">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 min-w-[64px] rounded-xl transition-all relative",
                activeTab === item.id 
                  ? 'text-indigo-600' 
                  : 'text-slate-400'
              )}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="bottomNavTab"
                  className="absolute inset-0 bg-indigo-50 rounded-xl -z-10"
                />
              )}
              <item.icon size={20} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
