import { getVoxManusUser } from './voxmanusUser';
import { initSocket } from './socket';

/** Enregistre l'utilisateur sur le serveur d'appels (connexion persistante). */
export function registerSocketUser(userOrPhone) {
  const user =
    userOrPhone && typeof userOrPhone === 'object' && userOrPhone.id
      ? userOrPhone
      : getVoxManusUser();

  if (!user?.id) {
    return Promise.resolve(null);
  }

  initSocket(user);
  return Promise.resolve(initSocket(user));
}
