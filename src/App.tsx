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
import { ConnectionScreen } from "./components/ConnectionScreen";
import { api } from "./lib/api";
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

  // Connection state
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Data state
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchSessions(isInitial = false) {
    try {
      setSessionsLoading(true);
      const sessionRes = await api.getSessions({
        itemsPerPage: 500,
        sort: "startedAt",
        desc: "1",
        bypassCache: isInitial ? undefined : "true"
      });
      const allSessions = sessionRes && Array.isArray(sessionRes.sessions) 
        ? sessionRes.sessions 
        : (Array.isArray(sessionRes) ? sessionRes : []);
      setSessions(allSessions);
    } catch (err) {
      console.error("Failed to fetch listening sessions:", err);
    } finally {
      setSessionsLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchData(isInitial = false) {
    try {
      if (isInitial) {
        setLoading(true);
        setSessionsLoading(true);
      } else {
        setRefreshing(true);
      }
      
      setError(null);

      // Fetch fast primary items first, excluding slow sessions call
      const [libData, userData, recentData, onlineData] = await Promise.all([
        api.getLibraries(),
        api.getUsers(),
        api.getRecentItems(),
        api.getOnlineUsers()
      ]);

      const libs = libData && Array.isArray(libData.libraries) 
        ? libData.libraries 
        : (Array.isArray(libData) ? libData : []);
      setLibraries(libs);

      const rawUsers = userData && Array.isArray(userData.users) 
        ? userData.users 
        : (Array.isArray(userData) ? userData : []);
      setUsers(rawUsers);
      
      const usersOnline = onlineData && Array.isArray(onlineData.usersOnline) 
        ? onlineData.usersOnline 
        : (Array.isArray(onlineData) ? onlineData : []);

      const userMap: Record<string, string> = {};
      rawUsers.forEach((u: any) => { if (u && u.id) userMap[u.id] = u.username || u.id; });
      usersOnline.forEach((u: any) => { if (u && u.id && !userMap[u.id]) userMap[u.id] = u.username || u.id; });

      const STALE_THRESHOLD = 10 * 60 * 1000;
      const isRecentlyActive = (s: any) => {
        if (s.updatedAt) return (Date.now() - s.updatedAt) < STALE_THRESHOLD;
        return (Date.now() - (s.startedAt + (s.timeListening || 0) * 1000)) < STALE_THRESHOLD;
      };

      const openSessions = (onlineData.openSessions || [])
        .filter(isRecentlyActive)
        .map((s: any) => ({
          ...s,
          username: s.username || userMap[s.userId] || s.userId,
        }));
      setActiveSessions(openSessions);
      
      const items = Array.isArray(recentData) ? recentData : (recentData.results || []);
      // Transform Audiobookshelf API response to match Book type
      const transformedBooks: Book[] = items.map((item: any) => {
        const mediaMeta = item.media?.metadata || item.metadata || { title: "Unknown Title", authorName: "Unknown Author" };
        return {
          id: item.id,
          libraryId: item.libraryId,
          metadata: {
            title: mediaMeta.title,
            authorName: mediaMeta.authorName,
            coverPath: api.getCoverPath(item.id),
          },
          addedAt: item.addedAt,
          duration: item.media?.duration || 0,
        };
      });
      setBooks(transformedBooks);
      setTotalBooks(recentData.totalBooks || 0);

      // Shell loaded immediately
      setLoading(false);

      // Asynchronously trigger lazy-loading of sessions
      fetchSessions(isInitial);
    } catch (err: any) {
      console.error(err);
      setError("Failed to connect to Audiobookshelf. Please check your credentials or network.");
      setLoading(false);
      setSessionsLoading(false);
      setRefreshing(false);
    }
  }

  // Handle Startup Connection Discovery
  useEffect(() => {
    async function discoverConnection() {
      await api.initialize();
      const conn = api.getConfig();
      if (conn?.isDirect) {
        setIsConfigured(true);
        fetchData(true);
      } else {
        // If not direct, see if the Node proxy server is running and healthy
        const health = await api.checkHealth();
        if (health.ok) {
          setIsConfigured(true);
          fetchData(true);
        } else {
          // If proxy fails, we boot to the manual onboarding interface
          setIsConfigured(false);
        }
      }
    }
    discoverConnection();
  }, []);

  // Set up periodic session refresher once verified configured
  useEffect(() => {
    if (!isConfigured) return;

    const interval = setInterval(async () => {
      try {
        const onlineData = await api.getOnlineUsers();
        const onlineUserMap: Record<string, string> = {};
        const onlineUsersArray = onlineData && Array.isArray(onlineData.usersOnline) 
          ? onlineData.usersOnline 
          : (Array.isArray(onlineData) ? onlineData : []);
        onlineUsersArray.forEach((u: any) => { if (u && u.id) onlineUserMap[u.id] = u.username || u.id; });
        // Merge with existing userMap from state
        if (Array.isArray(users)) {
          users.forEach(u => { if (u && u.id && !onlineUserMap[u.id]) onlineUserMap[u.id] = u.username || u.id; });
        }
        const STALE_THRESHOLD = 10 * 60 * 1000;
        const isRecentlyActive = (s: any) => {
          if (!s) return false;
          if (s.updatedAt) return (Date.now() - s.updatedAt) < STALE_THRESHOLD;
          return (Date.now() - (s.startedAt + (s.timeListening || 0) * 1000)) < STALE_THRESHOLD;
        };
        const openSessionsArray = onlineData && Array.isArray(onlineData.openSessions) ? onlineData.openSessions : [];
        const openSessions = openSessionsArray
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
  }, [isConfigured, users]);

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

  if (isConfigured === null) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <Activity className="animate-spin mb-4 text-indigo-600 mx-auto" size={48} />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Initializing ShelfLife...</h2>
          <p className="text-slate-500 mt-2 text-sm font-medium">Analyzing environment parameters.</p>
        </div>
      </div>
    );
  }

  if (isConfigured === false) {
    return <ConnectionScreen onSuccess={() => {
      setIsConfigured(true);
      fetchData(true);
    }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <Activity className="animate-spin mb-4 text-indigo-600 mx-auto" size={48} />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Synchronizing Dashboard...</h2>
          <p className="text-slate-500 mt-2 text-sm font-medium">Hold on, we're fetching your audiobooks data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-10 text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Connection Blocked</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            {error}
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={async () => {
                await api.disconnect();
                setIsConfigured(false);
                setError(null);
              }}
              className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-md"
            >
              Reconfigure Connection
            </button>
            <button 
              onClick={() => fetchData(true)}
              className="w-full py-3 bg-slate-100 text-slate-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
            >
              Retry Connection
            </button>
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
              onClick={() => fetchData()}
              disabled={refreshing}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCcw size={18} className={cn(refreshing && "animate-spin")} />
            </button>
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
                  sessionsLoading={sessionsLoading}
                />
              )}
              {activeTab === 'users' && (
                <UsersView 
                  users={users}
                  sessions={sessions}
                  userStats={userStats}
                  books={books}
                  sessionsLoading={sessionsLoading}
                />
              )}
              {activeTab === 'library' && (
                <LibraryView 
                  books={books}
                  libraries={libraries}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsView 
                  onDisconnect={async () => {
                    await api.disconnect();
                    setIsConfigured(false);
                    setActiveTab("dashboard");
                  }} 
                  onHeadersSaved={async () => {
                    await fetchData(true);
                  }}
                />
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
