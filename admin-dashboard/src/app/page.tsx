export default function AdminHome() {
  return (
    <main className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 p-6 space-y-8 bg-slate-950/50">
        <h1 className="text-xl font-black text-blue-500 uppercase tracking-tighter">Zenvy</h1>
        
        <nav className="space-y-2">
          <div className="sidebar-active p-3 rounded-lg text-sm font-bold cursor-pointer transition-all">Dashboard</div>
          <div className="hover:bg-white/5 p-3 rounded-lg text-sm font-medium text-gray-400 cursor-pointer transition-all">Restaurants</div>
          <div className="hover:bg-white/5 p-3 rounded-lg text-sm font-medium text-gray-400 cursor-pointer transition-all">Menu Editor</div>
          <div className="hover:bg-white/5 p-3 rounded-lg text-sm font-medium text-gray-400 cursor-pointer transition-all">Rider Stats</div>
          <div className="hover:bg-white/5 p-3 rounded-lg text-sm font-medium text-gray-400 cursor-pointer transition-all">Batch Settings</div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-10 overflow-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold">Business Overview</h2>
            <p className="text-gray-400">SRM University AP Campus Analytics</p>
          </div>
          <button className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            Create Export
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total Revenue', value: '₹145,280', growth: '+12.5%' },
            { label: 'Orders (24h)', value: '342', growth: '+24.1%' },
            { label: 'Active Riders', value: '18', growth: '4 Idle' },
            { label: 'Wait Time (Avg)', value: '28m', growth: '-2m' },
          ].map((stat, i) => (
            <div key={i} className="glass p-6 rounded-3xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[40px]" />
               <p className="text-gray-500 text-xs font-bold uppercase mb-2 tracking-wider">{stat.label}</p>
               <h4 className="text-2xl font-black mb-1">{stat.value}</h4>
               <span className={`text-[10px] font-bold ${stat.growth.startsWith('+') ? 'text-emerald-500' : 'text-gray-400'}`}>
                 {stat.growth}
               </span>
            </div>
          ))}
        </div>

        {/* Live Order Monitor Container */}
        <div className="glass rounded-[40px] p-8">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-bold">Live Campus Feed</h3>
              <div className="flex space-x-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold text-gray-400 uppercase">12 Orders Active</span>
              </div>
           </div>

           <div className="space-y-4">
              {[1024, 1025, 1026].map((id) => (
                <div key={id} className="p-4 border border-white/5 rounded-2xl flex items-center justify-between bg-white/5">
                   <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-xs text-blue-400 font-bold">
                        #{id}
                      </div>
                      <div>
                         <p className="font-bold text-sm">Customer: Shanmukh</p>
                         <p className="text-[10px] text-gray-500 tracking-wide uppercase">Hostel A • Preparing</p>
                      </div>
                   </div>
                   <div className="flex items-center space-x-10">
                      <div className="text-right">
                         <p className="font-bold text-sm">₹245.00</p>
                         <p className="text-[10px] text-blue-500 font-bold">BATCH #3</p>
                      </div>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-500">
                         •••
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </main>
  );
}
