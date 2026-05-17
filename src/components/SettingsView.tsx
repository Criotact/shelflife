import { Monitor, Bell, Shield, Database, Globe } from "lucide-react";
export function SettingsView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Configuration</h2>
        <p className="text-xs text-slate-500 font-medium tracking-tight">Manage your instance preferences and system-wide settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Appearance Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Appearance</h3>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Interface & Theme preferences</p>
              </div>
              <Monitor size={16} className="text-slate-400" />
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { label: 'System Font', value: 'Inter Variable', icon: Globe },
                   { label: 'Density', value: 'Compact', icon: Database },
                 ].map((opt) => (
                   <div key={opt.label} className="p-3 rounded-2xl border border-slate-200 flex flex-col gap-1">
                     <div className="flex items-center gap-1.5 text-slate-400">
                        <opt.icon size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">{opt.label}</span>
                     </div>
                     <p className="text-xs font-bold text-slate-900">{opt.value}</p>
                   </div>
                 ))}
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden opacity-60">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Communication</h3>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Alerts & System Messaging</p>
              </div>
              <Bell size={16} className="text-slate-400" />
            </div>
            <div className="p-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
              Module pending integration...
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100 flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <Shield size={32} className="relative z-10 opacity-80" />
            <div className="relative z-10">
              <h4 className="text-base font-bold tracking-tight mb-1 uppercase">Root Access</h4>
              <p className="text-xs text-indigo-100 font-medium mb-4">System Administrator privileges verified.</p>
              <button className="w-full py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-50 transition-colors shadow-md">
                Audit Logs
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Version Info</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-bold text-slate-500">Node ID</span>
                <span className="font-bold text-slate-900">AS-77LX-09</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-bold text-slate-500">Core</span>
                <span className="font-bold text-slate-900">v2.4.9-STABLE</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-bold text-slate-500">Last Sync</span>
                <span className="font-bold text-slate-900">6 mins ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
