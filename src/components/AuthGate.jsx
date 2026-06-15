import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getVoxManusUser } from '../lib/voxmanusUser';

/**
 * Protège les routes : sans profil valide → page d'accueil auth (/).
 * La page / affiche toujours le choix de profil (pas de redirection auto vers l'accueil).
 */
export default function AuthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthPage = location.pathname === '/';
  const isPublicRencontreRoute =
    location.pathname.startsWith('/join/')
    || location.pathname === '/entendant/rencontre'
    || location.pathname.startsWith('/entendant/rencontre/');

  useEffect(() => {
    const user = getVoxManusUser();

    if (isAuthPage || isPublicRencontreRoute) return;

    if (!user) {
      navigate('/', { replace: true });
    }
  }, [isAuthPage, isPublicRencontreRoute, location.pathname, navigate]);

  return children;
}
