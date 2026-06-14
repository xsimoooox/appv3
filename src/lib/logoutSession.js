import { disconnectSocket as disconnectGlobalSocket } from './socket';
import { clearVoxManusUser } from './voxmanusUser';

export function performLogout(navigate, disconnectCallSystem) {
  clearVoxManusUser();
  disconnectGlobalSocket();
  if (typeof disconnectCallSystem === 'function') {
    disconnectCallSystem();
  }
  navigate('/', { replace: true });
}
