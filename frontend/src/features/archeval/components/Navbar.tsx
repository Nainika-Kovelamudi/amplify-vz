import React from 'react';
import { ViewState } from '../types';
import type { ViewState as ViewStateType } from '../types';
import { User, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  currentView: ViewStateType;
  changeView: (view: ViewStateType) => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, changeView, isAdmin }) => {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between h-20">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => changeView(ViewState.ASSESSMENT)}>
            <img
              src="/infovision_logo.png"
              alt="InfoVision"
              className="h-12 w-auto object-contain mb-1"
            />
            <span className="text-xl font-bold text-slate-800 tracking-tight">Model Class Evaluation</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => changeView(ViewState.ASSESSMENT)}
              className={`px-4 py-2.5 rounded-lg text-base font-bold transition-colors ${currentView === ViewState.ASSESSMENT || currentView === ViewState.RESULT ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              Assessment
            </button>
            <button 
              onClick={() => changeView(ViewState.RULES)}
              className={`px-4 py-2.5 rounded-lg text-base font-bold transition-colors ${currentView === ViewState.RULES ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              Rules & Logic
            </button>
            
            {isAdmin && (
               <button 
               onClick={() => changeView(ViewState.ADMIN)}
               className={`flex items-center px-4 py-2.5 rounded-lg text-base font-bold transition-colors ${currentView === ViewState.ADMIN ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
             >
               <LayoutDashboard className="w-5 h-5 mr-2"/>
               Dashboard
             </button>
            )}

            <button 
              onClick={() => changeView(isAdmin ? ViewState.ADMIN : ViewState.LOGIN)}
              className="p-2.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              title="Admin Login"
            >
              <User className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};