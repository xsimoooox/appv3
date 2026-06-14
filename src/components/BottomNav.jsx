import { NavLink, useLocation } from 'react-router-dom';
import { Home, Users, QrCode, Shield, Clock, Settings } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const isHearing = location.pathname.startsWith('/entendant/');

  const deafNavItems = [
    { name: 'ACCUEIL', path: '/accueil', icon: Home },
    { name: 'CONTACTS', path: '/contacts', icon: Users },
    { name: 'RENCONTRE', path: '/rencontre', icon: QrCode },
    { name: 'URGENCE', path: '/urgence', icon: Shield },
    { name: 'HISTORIQUE', path: '/historique', icon: Clock },
    { name: 'PARAMETRES', path: '/parametres', icon: Settings },
  ];

  const hearingNavItems = [
    { name: 'Accueil', path: '/entendant/accueil', icon: Home },
    { name: 'Contacts', path: '/entendant/contacts', icon: Users },
    { name: 'Rencontre', path: '/entendant/rencontre', icon: QrCode },
    { name: 'Historique', path: '/entendant/historique', icon: Clock },
    { name: 'Réglages', path: '/entendant/parametres', icon: Settings },
  ];

  const navItems = isHearing ? hearingNavItems : deafNavItems;

  return (
    <nav className="vox-bottom-nav fixed bottom-0 left-0 right-0 h-[65px] bg-[#0000B4] border-t border-[#000096] shadow-[0_-4px_16px_rgba(0,0,150,0.12)] z-[9999] flex items-center justify-between px-1 select-none">
      <div className={`w-full max-w-5xl mx-auto grid ${isHearing ? 'grid-cols-5' : 'grid-cols-6'} h-full`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-full transition-all duration-150 ${
                  isActive
                    ? 'text-white scale-105 font-semibold'
                    : 'text-white/70 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    className={`transition-all duration-150 ${
                      isActive
                        ? 'scale-110 stroke-[2.25px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]'
                        : 'stroke-[1.75px]'
                    }`}
                  />
                  <span className="text-[10px] mt-1 tracking-tight leading-none text-center">
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
