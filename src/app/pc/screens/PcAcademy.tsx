import { AspectAcademy } from '../../components/aspect-academy';
import type { UserRole } from '../../components/login';

interface Props {
  userName: string;
  userRole: UserRole;
}

export function PcAcademy({ userName, userRole }: Props) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <AspectAcademy
        userName={userName}
        userRole={userRole}
        onLogout={() => {}}
        onNavigate={() => {}}
      />
    </div>
  );
}
