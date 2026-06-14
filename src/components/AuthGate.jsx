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

  useEffect(() => {
    const user = getVoxManusUser();

    if (isAuthPage) return;

    if (!user) {
      navigate('/', { replace: true });
    }
  }, [isAuthPage, location.pathname, navigate]);

  return children;
}
