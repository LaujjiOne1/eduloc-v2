import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { Logo } from '../ui/Logo';
import { NAV, type NavSection } from './nav';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  /** Nombre d'éléments en attente par section (pastille rouge). */
  badges: Partial<Record<NavSection, number>>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentSection, onSelectSection, badges, isOpenMobile, onCloseMobile }) => {
  const { admin, logout } = useAuth();

  return (
    <>
      {isOpenMobile && <div onClick={onCloseMobile} className="fixed inset-0 z-40 bg-scrim backdrop-blur-xs lg:hidden" />}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-surface border-r border-line text-ink flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-6 flex items-center border-b border-line shrink-0">
          <Logo size={40} suffix="Admin" />
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {NAV.map((group, gi) => (
            <div key={group.label ?? gi} className="space-y-1">
              {group.label && (
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint">{group.label}</div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentSection === item.id;
                const badge = badges[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => { onSelectSection(item.id); onCloseMobile(); }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'bg-primary-tint text-brand' : 'text-ink-soft hover:text-ink hover:bg-paper-alt'
                    }`}
                  >
                    <span className="flex items-center space-x-3 min-w-0">
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-brand' : 'opacity-80'}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badge ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-error text-white">{badge}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-line bg-paper shrink-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-violet flex items-center justify-center text-xs font-bold text-white shrink-0">
                {admin?.firstName?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-ink truncate">{admin ? `${admin.firstName} ${admin.lastName}` : 'Administrateur'}</p>
                <p className="text-[10px] text-ink-soft">Administrateur EduLoc</p>
              </div>
            </div>
            <button
              onClick={() => void logout()}
              className="p-1.5 text-ink-soft hover:text-error hover:bg-paper-alt rounded-lg transition-colors shrink-0"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
