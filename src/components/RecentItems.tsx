import { Book } from "../types";
import { BookOpen, Calendar, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecentItemsProps {
  items: Book[];
}

export function RecentItems({ items }: RecentItemsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[11px] font-bold text-slate-800 dark:text-white uppercase tracking-tight">Digital Archive</h2>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Recently indexed items</p>
          </div>
          <Calendar size={14} className="text-slate-400" />
        </div>
        
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-[10px] italic">
              No recent items found in repository.
            </div>
          ) : (
            items.slice(0, 5).map((book) => (
              <div key={book.id} className="flex gap-3 p-1.5 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer group">
                <div className="w-10 h-14 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                  {book.metadata?.coverPath ? (
                    <img 
                      src={book.metadata.coverPath} 
                      alt={book.metadata.title || "Book cover"} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <BookOpen size={16} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <span className="text-[11px] font-bold truncate text-slate-900 dark:text-white mb-0.5">
                    {book.metadata?.title || "Unknown Title"}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium truncate mb-1">
                    {book.metadata?.authorName || "Unknown Author"}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-tighter">
                      {book.addedAt ? `Added ${formatDistanceToNow(book.addedAt)} ago` : 'Date unknown'}
                    </span>
                    <ChevronRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {items.length > 5 && (
          <button className="w-full mt-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-all">
            View All Collections
          </button>
        )}
      </div>
    </div>
  );
}
