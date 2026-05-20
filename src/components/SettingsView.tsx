import { Power, Radio } from "lucide-react";
import { api } from "../lib/api";

interface SettingsViewProps {
  onDisconnect?: () => void;
}

export function SettingsView({ onDisconnect }: SettingsViewProps) {
  const config = api.getConfig();
  const isDirect = api.isDirectMode();

  return (
    <div className="flex flex-col gap-6 font-sans max-w-4xl">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Configuration</h2>
        <p className="text-xs text-slate-500 font-medium tracking-tight">Manage your instance preferences and system-wide settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Profile Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Node Connection</h4>
              <div className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase flex items-center gap-1.5 ${
                isDirect ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <Radio size={10} className="animate-pulse" />
                {isDirect ? 'Direct' : 'Proxy'}
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Endpoint Address</span>
                <span className="text-xs font-bold text-slate-900 break-all">{config?.url || 'Relative Host'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Routing State</span>
                <span className="text-xs font-bold text-slate-700">{isDirect ? 'Secure Client-to-API' : 'Encapsulated Express Proxy'}</span>
              </div>
            </div>
          </div>

          {onDisconnect && (
            <button 
              onClick={onDisconnect}
              className="w-full py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100/70 border border-rose-100 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-sm mt-4"
            >
              <Power size={12} />
              Disconnect Server
            </button>
          )}
        </div>

        {/* Version Info Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Version Info</h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 text-xs">
              <span className="font-bold text-slate-500">Node ID</span>
              <span className="font-bold text-slate-900">AS-77LX-09</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 text-xs">
              <span className="font-bold text-slate-500">Core</span>
              <span className="font-bold text-slate-900">v2.4.9-STABLE</span>
            </div>
            <div className="flex justify-between items-center py-1.5 text-xs">
              <span className="font-bold text-slate-500">Last Sync</span>
              <span className="font-bold text-slate-900">Active connection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
