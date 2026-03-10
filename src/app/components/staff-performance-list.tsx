import { useState } from 'react';
import { X, Send, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StaffMember {
  id: string;
  name: string;
  project: string;
  sales: number;
  revenue: number;
  discount: string;
}

interface StaffPerformanceListProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (selectedStaff: string[]) => void;
}

export function StaffPerformanceList({ isOpen, onClose, onSendMessage }: StaffPerformanceListProps) {
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [messageInput, setMessageInput] = useState('');

  // Tüm personel listesi
  const allStaff: StaffMember[] = [
    { id: '1', name: 'Ahmet Yılmaz', project: 'ZOKA', sales: 18, revenue: 8400, discount: '10%' },
    { id: '2', name: 'Ayşe Demir', project: 'ZOKA', sales: 15, revenue: 7200, discount: '9%' },
    { id: '3', name: 'Mehmet Kaya', project: 'Balık Hali', sales: 14, revenue: 6800, discount: '12%' },
    { id: '4', name: 'Zeynep Şahin', project: 'Hamdi', sales: 12, revenue: 5600, discount: '15%' },
    { id: '5', name: 'Can Yücel', project: 'Tekne', sales: 11, revenue: 4800, discount: '11%' },
    { id: '6', name: 'Elif Arslan', project: 'ZOKA', sales: 10, revenue: 4500, discount: '8%' },
    { id: '7', name: 'Burak Tekin', project: 'Balık Hali', sales: 9, revenue: 4200, discount: '13%' },
    { id: '8', name: 'Selin Öztürk', project: 'Hamdi', sales: 8, revenue: 3800, discount: '10%' },
    { id: '9', name: 'Emre Çelik', project: 'Tekne', sales: 7, revenue: 3400, discount: '14%' },
    { id: '10', name: 'Deniz Aydın', project: 'ZOKA', sales: 6, revenue: 2800, discount: '9%' },
    { id: '11', name: 'Gizem Koç', project: 'Balık Hali', sales: 5, revenue: 2400, discount: '12%' },
    { id: '12', name: 'Oğuz Yurt', project: 'Hamdi', sales: 4, revenue: 2000, discount: '7%' },
  ];

  const toggleStaff = (staffId: string) => {
    setSelectedStaff((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const handleSendMessage = () => {
    if (selectedStaff.size > 0) {
      onSendMessage(Array.from(selectedStaff));
      setSelectedStaff(new Set());
    }
  };

  const selectAll = () => {
    if (selectedStaff.size === allStaff.length) {
      setSelectedStaff(new Set());
    } else {
      setSelectedStaff(new Set(allStaff.map(s => s.id)));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-12 bottom-24 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50"
          >
            <div className="h-full backdrop-blur-xl bg-gradient-to-b from-[#2a2a3a] to-[#3a3a4e] border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-white/5 to-transparent flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <h2 className="text-xl font-bold text-white">En İyi Performans</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Select All Button */}
              <div className="px-6 py-3 border-b border-white/10 bg-white/5 flex-shrink-0">
                <button
                  onClick={selectAll}
                  className="text-sm font-semibold text-[#9dd9ea] hover:text-[#7ec8dd] transition-colors flex items-center gap-2"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selectedStaff.size === allStaff.length
                      ? 'bg-[#9dd9ea] border-[#9dd9ea]'
                      : 'border-white/30 bg-white/5'
                  }`}>
                    {selectedStaff.size === allStaff.length && (
                      <Check className="w-3.5 h-3.5 text-[#2d3748]" />
                    )}
                  </div>
                  {selectedStaff.size === allStaff.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                </button>
              </div>

              {/* Staff List - WITH FIXED HEIGHT */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {allStaff.map((staff, index) => (
                  <motion.button
                    key={staff.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => toggleStaff(staff.id)}
                    className="w-full"
                  >
                    <div className={`backdrop-blur-xl bg-gradient-to-r from-black/40 to-black/20 border rounded-2xl p-4 transition-all ${
                      selectedStaff.has(staff.id)
                        ? 'border-[#ffd4a3]/60 shadow-lg shadow-[#ffd4a3]/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        {/* Ranking Badge */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] text-[#744210] font-bold flex-shrink-0">
                          {index + 1}
                        </div>

                        {/* Staff Info */}
                        <div className="flex-1 text-left">
                          <div className="font-bold text-white text-base">{staff.name}</div>
                          <div className="text-xs text-[#ffd4a3]">İskonto: {staff.discount}</div>
                        </div>

                        {/* Stats */}
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-[#a8e6cf]">₺{staff.revenue.toLocaleString('tr-TR')}</div>
                          <div className="text-xs text-gray-400">{staff.sales} satış</div>
                        </div>

                        {/* Checkbox */}
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          selectedStaff.has(staff.id)
                            ? 'bg-[#ffd4a3] border-[#ffd4a3]'
                            : 'border-white/30 bg-white/5'
                        }`}>
                          {selectedStaff.has(staff.id) && (
                            <Check className="w-4 h-4 text-[#744210]" />
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Footer - Message Input & Send Button */}
              <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-t from-white/5 to-transparent space-y-3 flex-shrink-0">
                <div className="text-center">
                  <span className="text-xs text-gray-400">
                    {selectedStaff.size} personel seçildi
                  </span>
                </div>
                
                {/* Message Input */}
                {selectedStaff.size > 0 && (
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Mesajınızı yazın..."
                    rows={2}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea] resize-none"
                  />
                )}
                
                <button
                  onClick={handleSendMessage}
                  disabled={selectedStaff.size === 0}
                  className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
                    selectedStaff.size > 0
                      ? 'bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg hover:shadow-xl active:scale-95'
                      : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                  Mesaj Gönder
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}