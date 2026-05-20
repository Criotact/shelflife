import React, { useState, useEffect } from "react";
import { 
  X, Search, Sparkles, BookOpen, AlertCircle, 
  CheckCircle2, ChevronRight, Info, RefreshCw, HelpCircle,
  User as UserIcon, Calendar, Building, Globe, Hash, Clock, 
  Play, Tag, Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Book, MatchCandidate } from "../types";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface BookDetailsModalProps {
  book: Book;
  initialTab?: "details" | "match" | "chapters";
  onClose: () => void;
  onMatchSuccess: () => void;
}

const PROVIDERS = [
  { id: "audible", name: "Audible" },
  { id: "google", name: "Google Books" },
  { id: "openlibrary", name: "Open Library" },
  { id: "itunes", name: "iTunes" },
  { id: "audnexus", name: "Audnexus" }
];

// Helper to format duration in seconds to hh:mm:ss or mm:ss
function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const parts = [];
  if (h > 0) {
    parts.push(h.toString().padStart(2, "0"));
  }
  parts.push(m.toString().padStart(2, "0"));
  parts.push(s.toString().padStart(2, "0"));
  
  return parts.join(":");
}

export function BookDetailsModal({ book, initialTab = "details", onClose, onMatchSuccess }: BookDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "match" | "chapters">(initialTab);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [fullItem, setFullItem] = useState<any>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Match tab specific state
  const [provider, setProvider] = useState("audible");
  const [searchTitle, setSearchTitle] = useState(book.metadata?.title || "");
  const [searchAuthor, setSearchAuthor] = useState(book.metadata?.authorName || "");
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchCandidate[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchSearched, setMatchSearched] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [matchSuccess, setMatchSuccess] = useState(false);

  // Fetch full item details (metadata + chapters)
  const fetchFullDetails = async () => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const data = await api.getItemDetails(book.id);
      setFullItem(data);
    } catch (err: any) {
      console.error("Failed to fetch full audiobook details:", err);
      setDetailsError("Failed to retrieve detailed audiobook metadata.");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Chapters lookup specific state
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupAsin, setLookupAsin] = useState("");
  const [lookupRegion, setLookupRegion] = useState("us");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResults, setLookupResults] = useState<any[] | null>(null);
  const [applyingChapters, setApplyingChapters] = useState(false);

  useEffect(() => {
    fetchFullDetails();
  }, [book.id]);

  // Sync the ASIN from the most recently fetched/matched metadata
  useEffect(() => {
    const asin = fullItem?.media?.metadata?.asin;
    if (asin) {
      setLookupAsin(asin.trim().toUpperCase());
    }
  }, [fullItem]);

  // Perform chapter lookup from Audnexus
  const AUDNEXUS_REGIONS = [
    { value: "us", label: "🇺🇸 US" },
    { value: "uk", label: "🇬🇧 UK" },
    { value: "au", label: "🇦🇺 AU" },
    { value: "de", label: "🇩🇪 DE" },
    { value: "fr", label: "🇫🇷 FR" },
    { value: "jp", label: "🇯🇵 JP" },
    { value: "it", label: "🇮🇹 IT" },
    { value: "es", label: "🇪🇸 ES" },
  ];

  const performChaptersLookup = async (asin: string, region?: string) => {
    const cleanAsin = asin?.trim()?.toUpperCase();
    if (!cleanAsin) {
      setLookupError("Audible ASIN is required for lookup.");
      return;
    }

    const effectiveRegion = region || lookupRegion || "us";
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults(null);

    try {
      const data = await api.lookupChapters(cleanAsin, effectiveRegion);
      if (!data || !data.chapters || data.chapters.length === 0) {
        setLookupError("No chapters found for this ASIN on Audnexus. The book may not be in their database, or try a different region.");
      } else {
        const mapped = data.chapters.map((ch: any, idx: number) => ({
          id: idx,
          start: ch.startOffsetMs / 1000,
          end: (ch.startOffsetMs + ch.lengthMs) / 1000,
          title: ch.title || `Chapter ${idx + 1}`
        }));
        setLookupResults(mapped);
      }
    } catch (err: any) {
      console.error("Chapters lookup error:", err);
      const errMsg = err.response?.data?.error || err.message || "";
      const is404 = err.response?.status === 404 || errMsg.toLowerCase().includes("not found");
      setLookupError(
        is404
          ? "This ASIN was not found in the Audnexus database. Audnexus only indexes Audible-specific ASINs. Try a different region, or check that the ASIN is from an Audible product page (not Amazon)."
          : errMsg || "Failed to retrieve chapter information from Audnexus."
      );
    } finally {
      setLookupLoading(false);
    }
  };

  // Save the lookup chapters to the Audiobookshelf backend
  const handleSaveChapters = async () => {
    if (!lookupResults) return;

    setApplyingChapters(true);
    setLookupError(null);

    try {
      await api.updateChapters(book.id, lookupResults);
      // Success! Fetch updated details to re-render in timeline
      await fetchFullDetails();
      setIsLookingUp(false);
      setLookupResults(null);
    } catch (err: any) {
      console.error("Save chapters error:", err);
      setLookupError(
        err.response?.data?.error || 
        "Failed to write chapters to media asset."
      );
    } finally {
      setApplyingChapters(false);
    }
  };

  // Perform match search
  const handleMatchSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTitle.trim()) {
      setMatchError("A title is required to search for matches.");
      return;
    }

    setMatchLoading(true);
    setMatchError(null);
    setMatchResults([]);
    setMatchSearched(true);
    setSelectedCandidate(null);

    try {
      const data = await api.searchMatches(book.id, provider, searchTitle.trim(), searchAuthor.trim() || undefined);
      setMatchResults(data || []);
      if (data && data.length === 0) {
        setMatchError("No match results found. Try refining parameters or changing providers.");
      }
    } catch (err: any) {
      console.error("Match search error:", err);
      setMatchError(
        err.response?.data?.error || 
        "Failed to query external metadata provider."
      );
    } finally {
      setMatchLoading(false);
    }
  };

  // Perform direct match association
  const handleConfirmMatch = async () => {
    if (!selectedCandidate) return;

    setConfirming(true);
    setMatchError(null);

    try {
      await api.matchLibraryItem(book.id, selectedCandidate);
      setMatchSuccess(true);
      setTimeout(async () => {
        onMatchSuccess();
        // Re-fetch details to show matched info in other tabs
        await fetchFullDetails();
        setConfirming(false);
        setMatchSuccess(false);
        setSelectedCandidate(null);
        setActiveTab("details");
      }, 1500);
    } catch (err: any) {
      console.error("Apply match error:", err);
      setMatchError(
        err.response?.data?.error || 
        "Failed to apply metadata updates. Please try again."
      );
      setConfirming(false);
    }
  };

  // Extract meta variables for display
  const media = fullItem?.media || {};
  const metadata = media.metadata || {};
  
  const displayTitle = metadata.title || book.metadata?.title || "Unknown Title";
  const displaySubtitle = metadata.subtitle || "";
  const displayAuthor = metadata.authorName || book.metadata?.authorName || "Unknown Author";
  const displayNarrator = metadata.narratorName || "";
  const displayPublisher = metadata.publisher || "";
  const displayPublishDate = metadata.publishedDate || metadata.publishedYear || "";
  const displaySeries = metadata.series || "";
  const displaySeriesSeq = metadata.seriesSequence || "";
  const displayGenres = metadata.genres || [];
  const displayTags = metadata.tags || [];
  const displayDescription = metadata.description || "";
  const displayLanguage = metadata.language || "";
  const chapters = media.chapters || [];
  const duration = media.duration || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden relative"
      >
        {/* Visual background accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -z-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-50 rounded-tr-full -z-10" />

        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                <BookOpen size={16} />
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight truncate max-w-[280px] sm:max-w-md">
                {displayTitle}
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              By {displayAuthor}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dynamic Tab Bar */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-5 py-1 gap-1">
          {[
            { id: "details", label: "Details", icon: Info },
            { id: "match", label: "Match", icon: Sparkles },
            { id: "chapters", label: "Chapters", icon: Clock }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setMatchError(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded-xl relative",
                  isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100/50"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="modalActiveTabIndicator" 
                    className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon size={13} />
                {tab.label}
                {tab.id === "chapters" && chapters.length > 0 && (
                  <span className={cn(
                    "ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-500"
                  )}>
                    {chapters.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-6 flex flex-col min-h-[300px]">
          {detailsLoading && activeTab !== "match" ? (
            <div className="flex-grow flex flex-col items-center justify-center py-16">
              <RefreshCw size={28} className="animate-spin text-indigo-600 mb-3" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Fetching audiobook details...
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === "details" && (
                <motion.div
                  key="details-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6"
                >
                  {/* Left Column - Cover and Pills */}
                  <div className="md:col-span-4 flex flex-col gap-4">
                    <div className="aspect-square bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-md flex items-center justify-center text-slate-300 relative group hover:scale-[1.01] transition-transform">
                      <img
                        src={api.getCoverPath(book.id)}
                        alt={displayTitle}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover aspect-square"
                        onError={(e) => {
                          // Fallback: hide broken image, show icon
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.removeAttribute("hidden");
                        }}
                      />
                      <BookOpen size={48} hidden />
                    </div>

                    {/* Quick Stats Pill */}
                    {duration > 0 && (
                      <div className="bg-indigo-50 border border-indigo-100/50 rounded-2xl p-3 flex items-center gap-3">
                        <Clock size={16} className="text-indigo-600" />
                        <div>
                          <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Total Duration</p>
                          <p className="text-xs font-bold text-indigo-900 mt-1">{formatDuration(duration)}</p>
                        </div>
                      </div>
                    )}

                    {/* Genres Badges */}
                    {displayGenres.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Tag size={10} /> Genres
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {displayGenres.map((genre: string, i: number) => (
                            <span 
                              key={i} 
                              className="bg-indigo-50/70 border border-indigo-100/30 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-lg"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Rich Metadata Fields */}
                  <div className="md:col-span-8 space-y-5">
                    <div>
                      <h4 className="text-lg font-black text-slate-900 tracking-tight leading-snug">{displayTitle}</h4>
                      {displaySubtitle && (
                        <p className="text-xs text-slate-500 font-medium tracking-tight mt-1">{displaySubtitle}</p>
                      )}
                      
                      {displaySeries && (
                        <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-lg mt-2 shadow-sm">
                          <Award size={10} />
                          <span>{displaySeries} {displaySeriesSeq && `#${displaySeriesSeq}`}</span>
                        </div>
                      )}
                    </div>

                    <hr className="border-slate-100" />

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <UserIcon size={14} className="text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Author</p>
                          <p className="font-bold text-slate-700 truncate">{displayAuthor}</p>
                        </div>
                      </div>
                      
                      {displayNarrator && (
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Narrator</p>
                            <p className="font-bold text-slate-700 truncate">{displayNarrator}</p>
                          </div>
                        </div>
                      )}

                      {displayPublisher && (
                        <div className="flex items-center gap-2">
                          <Building size={14} className="text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Publisher</p>
                            <p className="font-bold text-slate-700 truncate">{displayPublisher}</p>
                          </div>
                        </div>
                      )}

                      {displayPublishDate && (
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Release Date</p>
                            <p className="font-bold text-slate-700 truncate">{displayPublishDate}</p>
                          </div>
                        </div>
                      )}

                      {displayLanguage && (
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Language</p>
                            <p className="font-bold text-slate-700 truncate">{displayLanguage}</p>
                          </div>
                        </div>
                      )}

                      {(metadata.isbn || metadata.asin) && (
                        <div className="flex items-center gap-2">
                          <Hash size={14} className="text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Catalog Code</p>
                            <p className="font-bold text-slate-700 truncate uppercase">
                              {metadata.asin ? `ASIN: ${metadata.asin}` : `ISBN: ${metadata.isbn}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <hr className="border-slate-100" />

                    {/* Book Description */}
                    {displayDescription ? (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Description</span>
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs text-slate-600 font-medium leading-relaxed max-h-[180px] overflow-y-auto shadow-inner">
                          {displayDescription}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 p-6 rounded-2xl text-center text-slate-400 text-xs font-semibold">
                        No description cataloged for this asset.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "match" && (
                <motion.div
                  key="match-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4 flex-grow"
                >
                  {/* Search Fields Form */}
                  {!selectedCandidate && (
                    <form onSubmit={handleMatchSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                      <div className="md:col-span-1 space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Provider</label>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none transition-all cursor-pointer hover:border-slate-300"
                        >
                          {PROVIDERS.map((prov) => (
                            <option key={prov.id} value={prov.id}>
                              {prov.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-1.5 space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Search Title</label>
                        <input
                          type="text"
                          placeholder="Title"
                          value={searchTitle}
                          onChange={(e) => setSearchTitle(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                          required
                        />
                      </div>

                      <div className="md:col-span-1.5 space-y-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Search Author</label>
                        <input
                          type="text"
                          placeholder="Author (Optional)"
                          value={searchAuthor}
                          onChange={(e) => setSearchAuthor(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                        />
                      </div>

                      <div className="md:col-span-4 flex justify-end">
                        <button
                          type="submit"
                          disabled={matchLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-5 py-2 rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-100 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {matchLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                          {matchLoading ? "SEARCHING..." : "SEARCH MATCHES"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Results lists & Selection steps */}
                  <div className="flex-grow flex flex-col min-h-[220px]">
                    {/* Error notification */}
                    {matchError && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-start gap-2.5 text-xs font-semibold mb-4 animate-shake">
                        <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                        <div>{matchError}</div>
                      </div>
                    )}

                    {/* Searching Loader */}
                    {matchLoading && (
                      <div className="flex-grow flex flex-col items-center justify-center py-12 text-center">
                        <RefreshCw size={24} className="animate-spin text-indigo-600 mb-3" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying database for matches...</p>
                        <p className="text-xs text-slate-400 font-medium mt-1">Connecting to {PROVIDERS.find(p => p.id === provider)?.name}</p>
                      </div>
                    )}

                    {/* Display candidates list */}
                    {!matchLoading && !selectedCandidate && matchSearched && matchResults.length > 0 && (
                      <div className="space-y-3 flex-grow">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Info size={11} /> {matchResults.length} Candidates Found
                        </h4>
                        <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
                          {matchResults.map((candidate, idx) => (
                            <motion.div
                              key={candidate.id || idx}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              onClick={() => setSelectedCandidate(candidate)}
                              className="group border border-slate-100 rounded-2xl p-3 flex gap-4 bg-white hover:bg-slate-50/50 hover:border-slate-300 transition-all cursor-pointer items-start"
                            >
                              <div className="w-12 h-18 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-slate-300 group-hover:shadow-sm transition-shadow">
                                {candidate.coverUrl ? (
                                  <img
                                    src={candidate.coverUrl}
                                    alt={candidate.title}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <BookOpen size={20} />
                                )}
                              </div>

                              <div className="flex-grow min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[11px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight truncate">
                                    {candidate.title}
                                  </p>
                                  <span className="bg-indigo-50 text-indigo-700 text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                    {candidate.provider}
                                  </span>
                                </div>
                                {candidate.subtitle && (
                                  <p className="text-[9px] text-slate-400 font-semibold leading-tight mt-0.5 truncate">{candidate.subtitle}</p>
                                )}
                                <p className="text-[9px] text-slate-600 font-bold mt-1">By {candidate.author || "Unknown Author"}</p>
                                
                                <div className="flex items-center gap-3 mt-2 text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                                  {candidate.publisher && <span className="truncate max-w-[150px]">{candidate.publisher}</span>}
                                  {candidate.publishDate && <span>({candidate.publishDate.slice(0, 4)})</span>}
                                  {candidate.asin && <span>ASIN: {candidate.asin}</span>}
                                  {candidate.isbn && <span>ISBN: {candidate.isbn}</span>}
                                </div>
                              </div>

                              <div className="self-center p-1 border border-slate-100 bg-white group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-lg transition-colors">
                                <ChevronRight size={14} />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unsearched placeholder */}
                    {!matchLoading && !matchSearched && (
                      <div className="flex-grow flex flex-col items-center justify-center py-12 text-center">
                        <HelpCircle size={32} className="text-slate-300 mb-3" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting search initiation</p>
                        <p className="text-xs text-slate-400 font-medium max-w-sm mt-1">
                          Adjust metadata search parameters above and click Search to query online catalog providers.
                        </p>
                      </div>
                    )}

                    {/* Side-by-Side Confirmation Step */}
                    {selectedCandidate && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Confirm Match Association</h4>
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(null)}
                            className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest"
                          >
                            Back to Candidates
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl relative overflow-hidden">
                          {confirming && (
                            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
                              {matchSuccess ? (
                                <div className="text-center">
                                  <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2 animate-bounce" />
                                  <p className="text-xs font-bold text-slate-800">Match confirmed!</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">Syncing new library assets...</p>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto mb-2" />
                                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Writing metadata update...</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="space-y-2.5">
                            <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest block">Proposed Metadata</p>
                            <div className="flex gap-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                              <div className="w-12 h-18 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-slate-300">
                                {selectedCandidate.coverUrl ? (
                                  <img
                                    src={selectedCandidate.coverUrl}
                                    alt={selectedCandidate.title}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <BookOpen size={16} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-900 leading-snug truncate">{selectedCandidate.title}</p>
                                <p className="text-[9px] text-slate-500 font-bold mt-0.5 leading-snug truncate">By {selectedCandidate.author}</p>
                                
                                <div className="mt-2 text-[8px] text-slate-400 font-semibold space-y-0.5">
                                  {selectedCandidate.publisher && <p className="truncate">Pub: {selectedCandidate.publisher}</p>}
                                  {selectedCandidate.publishDate && <p>Date: {selectedCandidate.publishDate}</p>}
                                  {selectedCandidate.id && <p className="truncate uppercase">ID: {selectedCandidate.id}</p>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {selectedCandidate.description && (
                            <div className="space-y-2.5">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Description Preview</p>
                              <div className="bg-white p-3 rounded-xl border border-slate-100 text-[10px] text-slate-500 font-medium leading-relaxed max-h-[110px] overflow-y-auto shadow-sm">
                                {selectedCandidate.description}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(null)}
                            disabled={confirming}
                            className="px-4 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-xl text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50"
                          >
                            CANCEL
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmMatch}
                            disabled={confirming}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all active:scale-95 shadow-md shadow-indigo-100 flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />
                            CONFIRM MATCH & SYNC
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "chapters" && (
                <motion.div
                  key="chapters-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col flex-grow min-h-0"
                >
                  {isLookingUp ? (
                    // Lookup flow active
                    <div className="flex-grow flex flex-col min-h-0">
                      {lookupLoading ? (
                        <div className="flex-grow flex flex-col items-center justify-center py-12 text-center">
                          <RefreshCw size={28} className="animate-spin text-indigo-600 mb-3" />
                          <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">
                            Connecting to Audnexus...
                          </p>
                          <p className="text-xs text-slate-400 font-medium mt-1">
                            Searching for chapters: ASIN <span className="font-bold text-slate-600">{lookupAsin}</span> · Region <span className="font-bold text-slate-600 uppercase">{lookupRegion}</span>
                          </p>
                        </div>
                      ) : lookupResults ? (
                        // Results Preview
                        <div className="space-y-4 flex-grow flex flex-col min-h-0">
                          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl flex items-start gap-2.5 text-xs font-medium shrink-0">
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Fetched {lookupResults.length} chapters successfully!</p>
                              <p className="text-[10px] text-emerald-700 mt-0.5">Please review the chapter structure below and click "Apply" to save them to the audiobook.</p>
                            </div>
                          </div>

                          {/* Preview List */}
                          <div className="space-y-2 overflow-y-auto pr-1 flex-grow border border-slate-100 p-3 rounded-2xl bg-slate-50/30 max-h-[220px]">
                            {lookupResults.map((chapter: any, index: number) => {
                              const chapDuration = (chapter.end - chapter.start);
                              return (
                                <div key={index} className="flex items-center justify-between text-[11px] p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[9px] font-black text-slate-400 font-mono w-5">
                                      {(index + 1).toString().padStart(2, "0")}
                                    </span>
                                    <p className="font-bold text-slate-700 truncate">{chapter.title}</p>
                                  </div>
                                  <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 font-mono shrink-0">
                                    <span className="bg-slate-50 px-1.5 py-0.5 rounded text-slate-500 border border-slate-100">
                                      {formatDuration(chapter.start)} - {formatDuration(chapter.end)}
                                    </span>
                                    <span className="text-slate-500 font-semibold w-12 text-right">{formatDuration(chapDuration)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {lookupError && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex items-start gap-2 text-[11px] font-semibold shrink-0">
                              <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                              <div>{lookupError}</div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-100 mt-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setLookupResults(null);
                                setLookupError(null);
                                if (!metadata.asin) {
                                  // Keep ASIN input form open
                                } else {
                                  setIsLookingUp(false);
                                }
                              }}
                              className="px-4 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveChapters}
                              disabled={applyingChapters}
                              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-100 flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {applyingChapters ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  APPLYING...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={12} />
                                  CONFIRM & APPLY
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Form / Input step
                        <div className="space-y-4 p-4 border border-indigo-100 bg-indigo-50/10 rounded-2xl flex-grow flex flex-col justify-center">
                          <div className="text-center max-w-md mx-auto space-y-2">
                            <Sparkles className="mx-auto text-indigo-500 mb-1" size={24} />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Chapter Lookup via Audnexus</h4>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                              Audnexus indexes chapter data from Audible. Enter the book's Audible ASIN and select your regional storefront to find chapters.
                            </p>
                          </div>

                          {lookupError && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex items-start gap-2 text-[11px] font-semibold max-w-md mx-auto w-full">
                              <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                              <div>{lookupError}</div>
                            </div>
                          )}

                          <div className="max-w-md mx-auto w-full space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Audible Region</label>
                              <div className="grid grid-cols-4 gap-1.5">
                                {AUDNEXUS_REGIONS.map((r) => (
                                  <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => setLookupRegion(r.value)}
                                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                      lookupRegion === r.value
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
                                    }`}
                                  >
                                    {r.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Audible ASIN</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={lookupAsin}
                                  onChange={(e) => {
                                    setLookupAsin(e.target.value.trim().toUpperCase());
                                    setLookupError(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && lookupAsin) performChaptersLookup(lookupAsin);
                                  }}
                                  placeholder="e.g. B08G9PRS1K"
                                  className="flex-grow bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-100 text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                                />
                                <button
                                  type="button"
                                  onClick={() => performChaptersLookup(lookupAsin)}
                                  disabled={!lookupAsin}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-5 py-2 rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-100 disabled:opacity-50"
                                >
                                  Lookup
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                Find the ASIN in the Audible product URL: <span className="font-bold text-slate-500">audible.com/pd/Title/<span className="text-indigo-500">B08G9PRS1K</span></span>. Must be an <strong>Audible</strong> ASIN, not a general Amazon product ID.
                              </p>
                            </div>

                            <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsLookingUp(false);
                                  setLookupError(null);
                                }}
                                className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>

                      )}
                    </div>
                  ) : (
                    // Regular Timeline View
                    <div className="flex-grow flex flex-col min-h-0">
                      {chapters.length > 0 ? (
                        <div className="flex flex-col flex-grow min-h-0">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2 shrink-0">
                            <span>Chapter Title / Index</span>
                            <div className="flex items-center gap-6">
                              <span>Timeline</span>
                              <span>Duration</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsLookingUp(true);
                                  setLookupAsin(metadata.asin || "");
                                  setLookupError(null);
                                  if (metadata.asin) {
                                    performChaptersLookup(metadata.asin);
                                  }
                                }}
                                className="ml-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg transition-all flex items-center gap-1 font-bold text-[9px] shrink-0"
                              >
                                <Sparkles size={9} />
                                Lookup
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5 relative border-l-2 border-indigo-50 pl-4 ml-2 overflow-y-auto pr-1 flex-grow max-h-[300px]">
                            {chapters.map((chapter: any, index: number) => {
                              const chapDuration = (chapter.end - chapter.start);
                              return (
                                <div 
                                  key={chapter.id || index}
                                  className="group hover:bg-slate-50 border border-transparent hover:border-slate-100 p-2.5 rounded-xl transition-all flex items-center justify-between text-xs relative"
                                >
                                  {/* Timeline indicator bullet */}
                                  <div className="absolute w-2.5 h-2.5 rounded-full bg-slate-300 group-hover:bg-indigo-600 border border-white left-[-21.5px] top-1/2 -translate-y-1/2 transition-colors" />

                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-[10px] font-black text-slate-400 font-mono w-5">
                                      {(index + 1).toString().padStart(2, "0")}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">
                                        {chapter.title || `Chapter ${index + 1}`}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase font-mono shrink-0">
                                    <span className="bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded text-slate-600 font-semibold font-sans text-[9px]">
                                      {formatDuration(chapter.start)} - {formatDuration(chapter.end)}
                                    </span>
                                    <span className="text-slate-500 font-semibold min-w-[50px] text-right">
                                      {formatDuration(chapDuration)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-grow flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                          <Clock size={32} className="text-slate-300 mb-3" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            No chapters cataloged
                          </p>
                          <p className="text-xs text-slate-400 font-medium max-w-xs mt-1">
                            This digital asset does not contain internal chapter divisions or timestamps.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsLookingUp(true);
                              setLookupAsin(metadata.asin || "");
                              setLookupError(null);
                              if (metadata.asin) {
                                performChaptersLookup(metadata.asin);
                              }
                            }}
                            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-100 flex items-center gap-1.5"
                          >
                            <Sparkles size={12} />
                            Lookup Chapters from Provider
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Details tab network error display */}
          {detailsError && activeTab !== "match" && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-start gap-2.5 text-xs font-semibold mt-4">
              <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <div>{detailsError}</div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
