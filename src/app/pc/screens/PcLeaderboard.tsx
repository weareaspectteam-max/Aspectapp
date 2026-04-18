import { Leaderboard } from '../../components/leaderboard';
import type { UserRole } from '../../components/login';

interface Props {
  userName: string;
  userId: string;
  userRole: UserRole;
  accessToken: string;
}

export function PcLeaderboard({ userName, userId, userRole, accessToken }: Props) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <Leaderboard
        userName={userName}
        userId={userId}
        userRole={userRole}
        accessToken={accessToken}
        onLogout={() => {}}
        onNavigate={() => {}}
      />
    </div>
  );
}
