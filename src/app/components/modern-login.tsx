import { useState } from 'react';
import { User, Lock, Shield, Users, Zap } from 'lucide-react';

interface ModernLoginProps {
  onLogin: (role: 'admin' | 'staff', name: string) => void;
}

export function ModernLogin({ onLogin }: ModernLoginProps) {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!selectedRole || !name) {
      alert('Lütfen rol seçin ve adınızı girin');
      return;
    }
    onLogin(selectedRole, name);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fafbfc] via-white to-[#f0f8ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-[#b8d4f1] to-[#9dd9ea] mb-4 shadow-2xl shadow-[#b8d4f1]/30">
            <Zap className="w-12 h-12 text-[#2d3748]" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#b8d4f1] to-[#9dd9ea] bg-clip-text text-transparent mb-2">
            Aspect Operations
          </h1>
          <p className="text-muted-foreground">Yaz sezonunun en iyi satış uygulaması</p>
        </div>

        {/* Role Selection */}
        <div className="mb-6">
          <label className="text-sm font-semibold text-foreground mb-3 block">Rol Seçin</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedRole('admin')}
              className={`group relative p-6 rounded-3xl border-2 transition-all ${
                selectedRole === 'admin'
                  ? 'border-primary bg-gradient-to-br from-primary/5 to-primary/10 shadow-xl shadow-primary/10'
                  : 'border-border bg-white hover:border-primary/50 hover:shadow-lg'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-all ${
                selectedRole === 'admin' 
                  ? 'bg-gradient-to-br from-[#b8d4f1] to-[#a7c7e7] shadow-lg' 
                  : 'bg-muted group-hover:bg-[#b8d4f1]/10'
              }`}>
                <Shield className={`w-7 h-7 ${selectedRole === 'admin' ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <div className={`font-bold mb-1 ${selectedRole === 'admin' ? 'text-primary' : 'text-foreground'}`}>
                Yönetici
              </div>
              <div className="text-xs text-muted-foreground">Tam Erişim</div>
            </button>

            <button
              onClick={() => setSelectedRole('staff')}
              className={`group relative p-6 rounded-3xl border-2 transition-all ${
                selectedRole === 'staff'
                  ? 'border-[#9dd9ea] bg-gradient-to-br from-[#9dd9ea]/5 to-[#9dd9ea]/10 shadow-xl shadow-[#9dd9ea]/10'
                  : 'border-border bg-white hover:border-[#9dd9ea]/50 hover:shadow-lg'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-all ${
                selectedRole === 'staff' 
                  ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] shadow-lg' 
                  : 'bg-muted group-hover:bg-[#9dd9ea]/10'
              }`}>
                <Users className={`w-7 h-7 ${selectedRole === 'staff' ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <div className={`font-bold mb-1 ${selectedRole === 'staff' ? 'text-[#7ec8dd]' : 'text-foreground'}`}>
                Personel
              </div>
              <div className="text-xs text-muted-foreground">Personel</div>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl p-6 border-2 border-border shadow-xl space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <User className="w-4 h-4" />
              Ad Soyad
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Adınızı girin"
              className="w-full px-4 py-4 bg-muted border-2 border-transparent rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Lock className="w-4 h-4" />
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifrenizi girin"
              className="w-full px-4 py-4 bg-muted border-2 border-transparent rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-[#b8d4f1] to-[#9dd9ea] hover:shadow-2xl hover:shadow-[#b8d4f1]/30 text-[#2d3748] py-4 rounded-2xl font-bold transition-all active:scale-[0.98] mt-6"
          >
            Giriş Yap
          </button>
        </div>

        {/* Demo Info */}
        <div className="mt-6 p-4 bg-white/50 backdrop-blur rounded-2xl border border-border">
          <p className="text-xs text-muted-foreground text-center">
            🌞 Demo Mod - Herhangi bir bilgi ile giriş yapabilirsiniz
          </p>
        </div>
      </div>
    </div>
  );
}