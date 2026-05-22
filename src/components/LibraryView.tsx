import { useState, useEffect, useMemo } from "react";
import { 
  Library as LibraryIcon, Database, RefreshCw, Layers, BookOpen, 
  Search, Filter, MoreVertical, CheckCircle2, AlertCircle, Sparkles,
  ChevronRight, Calendar, User as UserIcon, Tag
} from "lucide-react";
import { Book, Library } from "../types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { BookDetailsModal } from "./BookDetailsModal";
import { AnimatePresence } from "motion/react";
import { CoverImage } from "./CoverImage";

interface LibraryViewProps {
  books: Book[];
  libraries: Library[];
}

export function LibraryView({ books: initialBooks, libraries }: LibraryViewProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("");
  const [isRescanning, setIsRescanning] = useState(false);
  const [matchStatus, setMatchStatus] = useState<Record<string, 'matching' | 'success' | null>>({});
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<Book | null>(null);
  const [initialModalTab, setInitialModalTab] = useState<'details' | 'match' | 'chapters'>('details');
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(15);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    if (libraries.length > 0) {
      setSelectedLibraryId(prev => prev || libraries[0].id);
    }
  }, [libraries]);

  const fetchLibraryBooks = async () => {
    const libId = selectedLibraryId || (libraries.length > 0 ? libraries[0].id : "");
    if (!libId) return;
    setLoading(true);
    try {
      const res = await api.getLibraryItems(libId, { limit: 1000 });
      const items = res.results || res || [];
      const transformed: Book[] = items.map((item: any) => {
        const mediaMeta = item.media?.metadata || item.metadata || { title: "Unknown Title", authorName: "Unknown Author" };
        return {
          id: item.id,
          libraryId: item.libraryId,
          metadata: {
            title: mediaMeta.title,
            authorName: mediaMeta.authorName,
            coverPath: api.getCoverPath(item.id),
          },
          addedAt: item.addedAt || Date.now(),
        };
      });
      setBooks(transformed);
    } catch (err) {
      console.error("Failed to fetch library books:", err);
      setBooks(initialBooks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraryBooks();
  }, [selectedLibraryId]);

  const handleRescan = async () => {
    const libId = selectedLibraryId || (libraries.length > 0 ? libraries[0].id : "");
    if (!libId) return;
    setIsRescanning(true);
    try {
      await api.scanLibrary(libId);
      setTimeout(async () => {
        await fetchLibraryBooks();
        setIsRescanning(false);
      }, 2000);
    } catch (err) {
      console.error("Rescan failed:", err);
      setIsRescanning(false);
    }
  };

  const handleMatchSuccess = (id: string) => {
    setMatchStatus(prev => ({ ...prev, [id]: 'success' }));
    setTimeout(() => {
      setMatchStatus(prev => ({ ...prev, [id]: null }));
      fetchLibraryBooks();
    }, 2000);
  };

  const filteredBooks = useMemo(() => {
    return books
      .filter(book => {
        const title = book.metadata?.title || "";
        const author = book.metadata?.authorName || "";
        const id = book.id || "";
        const query = searchTerm.toLowerCase();
        return title.toLowerCase().includes(query) || 
               author.toLowerCase().includes(query) || 
               id.toLowerCase().includes(query);
      })
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [books, searchTerm]);

  const paginatedBooks = useMemo(() => {
    return filteredBooks.slice(0, visibleCount);
  }, [filteredBooks, visibleCount]);

  return (
    <div className="flex flex-col gap-4">
      {/* Upper Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Repository Management</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Systematic overview of indexed digital assets.</p>
        </div>
        <div className="flex items-center gap-3">
          {libraries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Node:</span>
              <select
                value={selectedLibraryId}
                onChange={(e) => {
                  setSelectedLibraryId(e.target.value);
                  setVisibleCount(15);
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none transition-all cursor-pointer hover:border-slate-300"
              >
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button 
            onClick={handleRescan}
            disabled={isRescanning}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
              isRescanning 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-100"
            )}
          >
            <RefreshCw size={14} className={cn(isRescanning && "animate-spin")} />
            {isRescanning ? "Scanning..." : "Rescan Library"}
          </button>
        </div>
      </div>

      {/* Library Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Indexed", value: books.length, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Storage Volumes", value: libraries.length, icon: Database, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Unique Authors", value: [...new Set(books.map(b => b.metadata?.authorName || "Unknown"))].length, icon: UserIcon, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", stat.bg, stat.color)}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900 leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Repository Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-3 flex-grow max-w-lg">
            <div className="relative flex-grow">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setVisibleCount(15); // Reset visible count on search
                }}
                placeholder="Search volume by title, author, or ID..." 
                className="w-full bg-white border border-slate-200 rounded-xl py-1.5 pl-9 pr-3 text-[11px] font-medium focus:ring-2 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-2">Display:</span>
            <button 
              onClick={() => setViewMode('table')}
              className={cn("p-1 px-2.5 rounded-lg text-[9px] font-bold transition-all", viewMode === 'table' ? "bg-white border border-slate-200 text-indigo-600" : "hover:bg-slate-50 text-slate-400")}
            >
              TABLE
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-1 px-2.5 rounded-lg text-[9px] font-bold transition-all", viewMode === 'grid' ? "bg-white border border-slate-200 text-indigo-600" : "hover:bg-slate-50 text-slate-400")}
            >
              GRID
            </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <th className="px-5 py-3">Title / Author</th>
                  <th className="px-5 py-3">Index Time</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center">
                      <RefreshCw size={20} className="animate-spin text-indigo-600 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Syncing repository contents...</p>
                    </td>
                  </tr>
                ) : paginatedBooks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center">
                      <AlertCircle size={20} className="text-slate-400 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No assets match your search</p>
                    </td>
                  </tr>
                ) : (
                  paginatedBooks.map((book) => (
                    <tr 
                      key={book.id} 
                      onClick={() => {
                        setSelectedBookForDetails(book);
                        setInitialModalTab('details');
                      }}
                      className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 flex items-center justify-center text-slate-300 relative">
                            <CoverImage
                              itemId={book.id}
                              title={book.metadata?.title}
                              className="w-full h-full object-cover aspect-square"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{book.metadata?.title}</p>
                            <p className="text-xs text-slate-500 font-medium">{book.metadata?.authorName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-[11px] font-bold text-slate-700">{formatDistanceToNow(book.addedAt)} ago</p>
                        <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest uppercase">System Index</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBookForDetails(book);
                              setInitialModalTab('match');
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                              matchStatus[book.id] === 'success' ? "bg-emerald-50 text-emerald-600" :
                              "bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white"
                            )}
                          >
                            {matchStatus[book.id] === 'success' ? <CheckCircle2 size={10} /> : <Sparkles size={10} />}
                            {matchStatus[book.id] === 'success' ? "DONE" : "MATCH"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {loading ? (
              <div className="col-span-full py-12 text-center">
                <RefreshCw size={20} className="animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Syncing repository contents...</p>
              </div>
            ) : paginatedBooks.length === 0 ? (
              <div className="col-span-full py-12 text-center">
                <AlertCircle size={20} className="text-slate-400 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No assets match your search</p>
              </div>
            ) : (
              paginatedBooks.map((book) => (
                <div 
                  key={book.id} 
                  onClick={() => {
                    setSelectedBookForDetails(book);
                    setInitialModalTab('details');
                  }}
                  className="group flex flex-col gap-2 cursor-pointer"
                >
                  <div className="w-full aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm group-hover:shadow-md group-hover:border-indigo-200 transition-all relative flex items-center justify-center text-slate-300">
                    <CoverImage
                      itemId={book.id}
                      title={book.metadata?.title}
                      className="w-full h-full object-cover aspect-square"
                    />
                    
                    <div className="absolute top-2 right-2 flex gap-1">
                      {matchStatus[book.id] === 'success' ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                          <CheckCircle2 size={12} />
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBookForDetails(book);
                            setInitialModalTab('match');
                          }}
                          className="w-6 h-6 rounded-full bg-white/90 backdrop-blur text-slate-600 hover:text-indigo-600 hover:bg-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                          title="Match Metadata"
                        >
                          <Sparkles size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors" title={book.metadata?.title}>{book.metadata?.title}</p>
                    <p className="text-xs text-slate-500 font-medium line-clamp-1" title={book.metadata?.authorName}>{book.metadata?.authorName}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {!loading && filteredBooks.length > visibleCount && (
          <div className="p-3 bg-slate-50/50 border-t border-slate-200 flex items-center justify-center">
            <button 
              onClick={() => setVisibleCount(prev => prev + 15)}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest active:scale-95"
            >
              Load More Assets ({filteredBooks.length - visibleCount} remaining)
            </button>
          </div>
        )}
        {!loading && filteredBooks.length <= visibleCount && filteredBooks.length > 0 && (
          <div className="p-3 bg-slate-50/50 border-t border-slate-200 flex items-center justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              All {filteredBooks.length} assets displayed
            </span>
          </div>
        )}
      </div>

      {/* Interactive Metadata & Chapters Details Modal */}
      <AnimatePresence>
        {selectedBookForDetails && (
          <BookDetailsModal
            book={selectedBookForDetails}
            initialTab={initialModalTab}
            onClose={() => setSelectedBookForDetails(null)}
            onMatchSuccess={() => handleMatchSuccess(selectedBookForDetails.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
