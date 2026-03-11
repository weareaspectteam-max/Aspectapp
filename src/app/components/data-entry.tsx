import { useState, useEffect } from 'react';
import { Calendar, DollarSign, Package, TrendingUp, Hash, MapPin, User, Save } from 'lucide-react';

interface DataEntryProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
}

interface Location {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export function DataEntry({ userName }: DataEntryProps) {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedProject, setSelectedProject] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [salesData, setSalesData] = useState({
    project: '',
    staff: userName || '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    albums: {
      '3lu': 0,
      '5li': 0,
      '7li': 0,
      '9lu': 0,
      '11li': 0,
      '13lu': 0,
      '15li': 0,
    },
    damaged: 0,
    printer1Start: 0,
    printer1End: 0,
    printer2Start: 0,
    printer2End: 0,
    ribbonChanges: 0,
  });

  // localStorage kaldırıldı - KV store entegrasyonu yapılacak
  useEffect(() => {
    // Boş başlıyoruz
  }, []);

  const albumTypes = [
    { key: '3lu', label: "3'lü Albüm" },
    { key: '5li', label: "5'li Albüm" },
    { key: '7li', label: "7'li Albüm" },
    { key: '9lu', label: "9'lu Albüm" },
    { key: '11li', label: "11'li Albüm" },
    { key: '13lu', label: "13'lü Albüm" },
    { key: '15li', label: "15'li Albüm" },
  ];

  const handleAlbumChange = (key: string, value: number) => {
    setSalesData({
      ...salesData,
      albums: { ...salesData.albums, [key]: value },
    });
  };

  const handleSubmit = () => {
    console.log('Form submitted:', salesData);
    alert('Rapor başarıyla kaydedildi!');
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-foreground mb-1">Veri Girişi</h1>
        <p className="text-muted-foreground text-sm">Günlük satış ve operasyon verilerini girin</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Basic Info */}
        <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <h3 className="font-semibold text-foreground mb-3">Temel Bilgiler</h3>
          
          <div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />
              Proje
            </label>
            <select
              value={salesData.project}
              onChange={(e) => setSalesData({ ...salesData, project: e.target.value })}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Proje Seçin</option>
              {locations.map((location) => (
                <option key={location.id} value={location.name}>{location.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <User className="w-4 h-4" />
              Personel Adı
            </label>
            <input
              type="text"
              value={salesData.staff}
              onChange={(e) => setSalesData({ ...salesData, staff: e.target.value })}
              placeholder="Personel adını girin"
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                Tarih
              </label>
              <input
                type="date"
                value={salesData.date}
                onChange={(e) => setSalesData({ ...salesData, date: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Saat</label>
              <input
                type="time"
                value={salesData.time}
                onChange={(e) => setSalesData({ ...salesData, time: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Album Sales */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Albüm Satışları</h3>
          <div className="space-y-3">
            {albumTypes.map((album) => (
              <div key={album.key} className="flex items-center justify-between">
                <label className="text-sm text-foreground">{album.label}</label>
                <input
                  type="number"
                  min="0"
                  value={salesData.albums[album.key as keyof typeof salesData.albums]}
                  onChange={(e) => handleAlbumChange(album.key, parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <label className="text-sm text-foreground font-medium">Bozuk Ürün</label>
              <input
                type="number"
                min="0"
                value={salesData.damaged}
                onChange={(e) => setSalesData({ ...salesData, damaged: parseInt(e.target.value) || 0 })}
                className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Printer Data */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-semibold text-foreground mb-4">Yazıcı Verileri</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-3 block">Printer 1</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Başlangıç Sayacı</label>
                  <input
                    type="number"
                    min="0"
                    value={salesData.printer1Start}
                    onChange={(e) => setSalesData({ ...salesData, printer1Start: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Bitiş Sayacı</label>
                  <input
                    type="number"
                    min="0"
                    value={salesData.printer1End}
                    onChange={(e) => setSalesData({ ...salesData, printer1End: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-3 block">Printer 2</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Başlangıç Sayacı</label>
                  <input
                    type="number"
                    min="0"
                    value={salesData.printer2Start}
                    onChange={(e) => setSalesData({ ...salesData, printer2Start: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Bitiş Sayacı</label>
                  <input
                    type="number"
                    min="0"
                    value={salesData.printer2End}
                    onChange={(e) => setSalesData({ ...salesData, printer2End: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Ribbon Değişim Sayısı</label>
              <input
                type="number"
                min="0"
                value={salesData.ribbonChanges}
                onChange={(e) => setSalesData({ ...salesData, ribbonChanges: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full bg-primary hover:bg-opacity-90 text-primary-foreground py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] mb-6"
        >
          <Save className="w-5 h-5" />
          Raporu Kaydet
        </button>
      </div>
    </div>
  );
}