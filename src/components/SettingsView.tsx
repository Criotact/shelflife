import { Power, ShieldCheck, Sun, Moon } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import packageJson from "../../package.json";

interface SettingsViewProps {
  onDisconnect?: () => void;
  onHeadersSaved?: () => void;
  darkMode?: boolean;
  setDarkMode?: (dark: boolean) => void;
}

export function SettingsView({ onDisconnect, darkMode = false, setDarkMode }: SettingsViewProps) {
  const config = api.getConfig();
  const isDirect = api.isDirectMode();

  const currentExtraHeaders = config?.extraHeaders ?? {};
  const hasExtraHeaders = Object.keys(currentExtraHeaders).length > 0;

  return (
    <div className="flex flex-col gap-6 font-sans max-w-4xl">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System Configuration</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-tight">Manage your instance preferences and system-wide settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Profile Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Node Connection</h4>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Endpoint Address</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 break-all">{config?.url || 'Relative Host'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Routing State</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{isDirect ? 'Secure Client-to-API' : 'Encapsulated Express Proxy'}</span>
              </div>
              
              {hasExtraHeaders && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Active Auth Headers</span>
                    <div className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[8px] font-extrabold uppercase flex items-center gap-0.5">
                      <ShieldCheck size={8} />
                      Active
                    </div>
                  </div>
                  <div className="space-y-1.5 mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3">
                    {Object.entries(currentExtraHeaders).map(([key]) => (
                      <div key={key} className="flex items-center justify-between text-[11px] font-medium font-sans">
                        <span className="font-semibold text-slate-600 dark:text-slate-400 font-mono break-all pr-2">{key}</span>
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-[9px] shrink-0">••••••••</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {onDisconnect && (
            <button 
              onClick={onDisconnect}
              className="w-full py-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-500 border border-rose-100 dark:border-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/20 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm mt-4 cursor-pointer active:scale-98"
            >
              <Power size={12} />
              Disconnect Server
            </button>
          )}
        </div>

        {/* Theme Settings Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Interface Theme</h4>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-6">
              Customize the visual look and feel of your audiobookshelf dashboard interface.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setDarkMode?.(false)}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer gap-2",
                  !darkMode 
                    ? "border-indigo-600 bg-indigo-50/30 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm shadow-indigo-100/30" 
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                )}
              >
                <div className={cn("p-2 rounded-lg", !darkMode ? "bg-indigo-100/80 text-indigo-600" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                  <Sun size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-none">Light</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-medium">Clean and radiant layout</span>
                </div>
              </button>

              <button 
                onClick={() => setDarkMode?.(true)}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer gap-2",
                  darkMode 
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm" 
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                )}
              >
                <div className={cn("p-2 rounded-lg", darkMode ? "bg-indigo-950 text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                  <Moon size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-none">Dark</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-medium font-sans">Immersive slate system</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Version Info Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between min-h-[120px] md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Version Info</h4>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Application Version</span>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{packageJson.version}</span>
            </div>
          </div>
        </div>
        </div>
      </div>
  );
}
