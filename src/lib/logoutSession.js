import { disconnectSocket as disconnectGlobalSocket } from './socket';
import { clearWakwakUser } from './wakwakUser';

export function performLogout(navigate, disconnectCallSystem) {
  clearWakwakUser();
  disconnectGlobalSocket();
  if (typeof disconnectCallSystem === 'function') {
    disconnectCallSystem();
  }
  navigate('/', { replace: true });
}
