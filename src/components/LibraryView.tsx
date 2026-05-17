import { useState } from "react";
import { 
  Library as LibraryIcon, Database, RefreshCw, Layers, BookOpen, 
  Search, Filter, MoreVertical, CheckCircle2, AlertCircle, Sparkles,
  ChevronRight, Calendar, User as UserIcon, Tag
} from "lucide-react";
import { Book, Library } from "../types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../lib/utils";

interface LibraryViewProps {
  books: Book[];
  libraries: Library[];
}

export function LibraryView({ books, libraries }: LibraryViewProps) {
  const [isRescanning, setIsRescanning] = useState(false);
  const [matchStatus, setMatchStatus] = useState<Record<string, 'matching' | 'success' | null>>({});

  const handleRescan = () => {
    setIsRescanning(true);
    setTimeout(() => setIsRescanning(false), 2000);
  };

  const handleMatch = (id: string) => {
    setMatchStatus(prev => ({ ...prev, [id]: 'matching' }));
    setTimeout(() => {
      setMatchStatus(prev => ({ ...prev, [id]: 'success' }));
      setTimeout(() => setMatchStatus(prev => ({ ...prev, [id]: null })), 2000);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Upper Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Repository Management</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Systematic overview of indexed digital assets.</p>
        </div>
        <div className="flex gap-2">
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
            {isRescanning ? "SCAN_RUNNING" : "FORCE_RESCAN"}
          </button>
        </div>
      </div>

      {/* Library Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Indexed", value: books.length, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Storage Volumes", value: libraries.length, icon: Database, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Unique Authors", value: [...new Set(books.map(b => b.metadata.authorName))].length, icon: UserIcon, color: "text-emerald-600", bg: "bg-emerald-50" },
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
                placeholder="Search volume by title, author, or ID..." 
                className="w-full bg-white border border-slate-200 rounded-xl py-1.5 pl-9 pr-3 text-[11px] font-medium focus:ring-2 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400 outline-none transition-all"
              />
            </div>
            <button className="p-1.5 border border-slate-200 rounded-xl hover:bg-white transition-colors text-slate-500">
              <Filter size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-2">Display:</span>
            <button className="p-1 px-2.5 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-indigo-600">TABLE</button>
            <button className="p-1 px-2.5 hover:bg-slate-50 text-[9px] font-bold text-slate-400">GRID</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Title / Author</th>
                <th className="px-5 py-3">Library Node</th>
                <th className="px-5 py-3">Index Time</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {books.map((book) => (
                <tr key={book.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <CheckCircle2 size={14} />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-12 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 flex items-center justify-center text-slate-300">
                        {book.metadata.coverPath ? (
                          <img 
                            src={book.metadata.coverPath} 
                            alt={book.metadata.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BookOpen size={16} />
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{book.metadata.title}</p>
                        <p className="text-[9px] text-slate-500 font-medium">{book.metadata.authorName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                       <Tag size={10} className="text-slate-400" />
                       <span className="text-[10px] font-semibold text-slate-600">
                        {libraries.find(l => l.id === book.libraryId)?.name}
                       </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-[11px] font-bold text-slate-700">{formatDistanceToNow(book.addedAt)} ago</p>
                    <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest uppercase">System Index</p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleMatch(book.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                          matchStatus[book.id] === 'matching' ? "bg-amber-50 text-amber-600" :
                          matchStatus[book.id] === 'success' ? "bg-emerald-50 text-emerald-600" :
                          "bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white"
                        )}
                      >
                        {matchStatus[book.id] === 'matching' ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        {matchStatus[book.id] === 'matching' ? "SYNC" : matchStatus[book.id] === 'success' ? "DONE" : "MATCH"}
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all">
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 bg-slate-50/50 border-t border-slate-200 flex items-center justify-center">
           <button className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
            Load More Assets
           </button>
        </div>
      </div>
    </div>
  );
}
