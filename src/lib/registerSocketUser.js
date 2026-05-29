import { getWakwakUser } from './wakwakUser';
import { initSocket } from './socket';

/** Enregistre l'utilisateur sur le serveur d'appels (connexion persistante). */
export function registerSocketUser(userOrPhone) {
  const user =
    userOrPhone && typeof userOrPhone === 'object' && userOrPhone.id
      ? userOrPhone
      : getWakwakUser();

  if (!user?.id) {
    return Promise.resolve(null);
  }

  initSocket(user);
  return Promise.resolve(initSocket(user));
}
