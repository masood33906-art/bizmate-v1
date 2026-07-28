import React, { useState, useEffect } from 'react';
import { Store, Cpu, ShieldCheck, Sparkles, Database } from 'lucide-react';

interface SplashScreenProps {
  onFinished?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Connecting local storage engine...');

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 12;
        if (next > 30 && next < 60) {
          setStatusText('Retrieving saved JSON database...');
        } else if (next >= 60 && next < 90) {
          setStatusText('Restoring exact app state & tabs...');
        } else if (next >= 90) {
          setStatusText('Session restored! Opening BizMate POS...');
        }
        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100 && onFinished) {
      const timer = setTimeout(() => {
        onFinished();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [progress, onFinished]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white flex flex-col items-center justify-between p-8 select-none font-sans overflow-hidden">
      
      {/* Top Header Badge */}
      <div className="w-full flex items-center justify-between opacity-80 pt-2">
        <div className="flex items-center gap-1.5 bg-blue-900/40 border border-blue-700/50 px-3 py-1 rounded-full text-[11px] font-bold text-blue-300 backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Local Persistence Active</span>
        </div>
        <div className="text-[11px] font-extrabold tracking-widest text-slate-400 uppercase">
          v2.4 PRO
        </div>
      </div>

      {/* Main Center Logo & Title */}
      <div className="flex flex-col items-center text-center max-w-sm my-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Animated Glowing Logo Frame */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur-xl opacity-50 animate-pulse" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 rounded-3xl flex items-center justify-center shadow-2xl border border-blue-400/30">
            <Store className="w-12 h-12 text-white drop-shadow-md" />
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-amber-500 rounded-xl flex items-center justify-center border-2 border-slate-950 shadow-md">
              <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
            </div>
          </div>
        </div>

        {/* Company & Product Name */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-md border border-blue-800/60 inline-block">
            BIZMATE TECHNOLOGIES
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-sm">
            BizMate <span className="text-blue-400">POS</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-xs">
            Smart POS & Business Management Suite
          </p>
        </div>

        {/* Progress & Status */}
        <div className="w-full space-y-2.5 pt-4">
          <div className="w-full bg-slate-900/90 border border-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-150 ease-out shadow-[0_0_12px_#3b82f6]"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
            <span className="flex items-center gap-1.5 text-blue-300">
              <Database className="w-3 h-3 text-blue-400 animate-spin" />
              {statusText}
            </span>
            <span className="font-mono font-bold text-emerald-400">{Math.min(progress, 100)}%</span>
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="text-center text-[10px] text-slate-500 font-medium pb-2 flex items-center gap-2">
        <Cpu className="w-3 h-3 text-slate-600" />
        <span>Powered by BizMate Technologies Engine &bull; Auto-Sync Local JSON Storage</span>
      </div>

    </div>
  );
};
