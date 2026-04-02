import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Camera, TrendingUp, Award, ChevronRight, ChevronDown, Play, CheckCircle,
  Plus, Trash2, Edit3, Video, FileText, Image, Link as LinkIcon, HelpCircle, Loader2,
  ArrowLeft, ExternalLink, X, GripVertical, Save
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { authHeaders, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ── Tipler ──
interface Category { id: string; name: string; emoji: string; order: number; }
interface ContentItem {
  id: string; categoryId: string; type: 'video' | 'text' | 'pdf' | 'gallery' | 'quiz' | 'link';
  title: string; description: string; data: any; order: number;
  createdAt: string; updatedAt: string; createdBy: string;
}
interface QuizQuestion { question: string; options: string[]; correctIndex: number; }
interface Progress { [contentId: string]: { watched: boolean; date: string } }

const TYPE_META: Record<string, { icon: any; label: string; color: string }> = {
  video:   { icon: Video,      label: 'Video',    color: '#ef4444' },
  text:    { icon: FileText,   label: 'Yazı',     color: '#3b82f6' },
  pdf:     { icon: FileText,   label: 'PDF',      color: '#f59e0b' },
  gallery: { icon: Image,      label: 'Galeri',   color: '#10b981' },
  quiz:    { icon: HelpCircle, label: 'Quiz',     color: '#8b5cf6' },
  link:    { icon: LinkIcon,   label: 'Link',     color: '#06b6d4' },
};

// ── YouTube ID çıkar ──
function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Props ──
interface AspectAcademyProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function AspectAcademy({ userName, userRole, onLogout, onNavigate }: AspectAcademyProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState<{ message: string; updatedAt: string; updatedBy: string } | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  // UI state
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Admin state
  const isAdmin = ['yonetici', 'ust-mudur'].includes(userRole);
  const [showCatForm, setShowCatForm] = useState(false);
  const [showContentForm, setShowContentForm] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [catForm, setCatForm] = useState({ name: '', emoji: '📚' });
  const [contentForm, setContentForm] = useState({
    type: 'video' as ContentItem['type'],
    title: '', description: '',
    youtubeUrl: '', textContent: '', pdfUrl: '', linkUrl: '', linkLabel: '',
    galleryUrls: [''],
    questions: [{ question: '', options: ['', '', '', ''], correctIndex: 0 }] as QuizQuestion[],
  });

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(appendGhostParam(`${API_BASE}/academy`), { headers: await authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Hata');
      setCategories(d.categories || []);
      setContents(d.contents || []);
      setProgress(d.progress || {});
      setAnnouncement(d.announcement || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Kategori ekle ──
  const saveCategory = async () => {
    if (!catForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/academy/category`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ name: catForm.name, emoji: catForm.emoji }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCatForm({ name: '', emoji: '📁' });
      setShowCatForm(false);
      fetchData();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  // ── Kategori sil ──
  const deleteCategory = async (id: string) => {
    if (!confirm('Bu kategori ve tüm içerikleri silinecek. Emin misiniz?')) return;
    try {
      await fetch(appendGhostParam(`${API_BASE}/academy/category/${id}`), {
        method: 'DELETE', headers: await authHeaders(),
      });
      if (selectedCat === id) setSelectedCat(null);
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  // ── İçerik kaydet ──
  const saveContent = async () => {
    if (!contentForm.title.trim() || !selectedCat) return;
    setSaving(true);
    try {
      let data: any = {};
      switch (contentForm.type) {
        case 'video': {
          const yid = extractYoutubeId(contentForm.youtubeUrl);
          if (!yid) { setError('Geçerli bir YouTube linki girin.'); setSaving(false); return; }
          data = { youtubeId: yid };
          break;
        }
        case 'text': data = { content: contentForm.textContent }; break;
        case 'pdf': data = { url: contentForm.pdfUrl }; break;
        case 'link': data = { url: contentForm.linkUrl, label: contentForm.linkLabel }; break;
        case 'gallery': data = { images: contentForm.galleryUrls.filter(u => u.trim()) }; break;
        case 'quiz': data = { questions: contentForm.questions }; break;
      }

      const catContents = contents.filter(c => c.categoryId === selectedCat);
      const body: any = {
        categoryId: selectedCat, type: contentForm.type,
        title: contentForm.title, description: contentForm.description,
        data, order: editItem ? editItem.order : catContents.length,
      };
      if (editItem) body.id = editItem.id;

      const res = await fetch(appendGhostParam(`${API_BASE}/academy/content`), {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      resetContentForm();
      fetchData();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  // ── İçerik sil ──
  const deleteContent = async (id: string) => {
    if (!confirm('Bu içerik silinecek. Emin misiniz?')) return;
    try {
      await fetch(appendGhostParam(`${API_BASE}/academy/content/${id}`), {
        method: 'DELETE', headers: await authHeaders(),
      });
      if (selectedContent?.id === id) setSelectedContent(null);
      fetchData();
    } catch (e: any) { setError(e.message); }
  };

  // ── İlerleme kaydet ──
  const markProgress = async (contentId: string, watched: boolean) => {
    setProgress(p => ({ ...p, [contentId]: { watched, date: new Date().toISOString() } }));
    try {
      await fetch(appendGhostParam(`${API_BASE}/academy/progress`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ contentId, watched }),
      });
    } catch {}
  };

  // ── Duyuru kaydet ──
  const saveAnnouncement = async () => {
    if (!announcementText.trim()) return;
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/academy/announcement`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ message: announcementText }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const d = await res.json();
      setAnnouncement(d.announcement);
      setEditingAnnouncement(false);
    } catch (e: any) { setError(e.message); }
  };

  // ── Duyuru sil ──
  const deleteAnnouncement = async () => {
    try {
      await fetch(appendGhostParam(`${API_BASE}/academy/announcement`), {
        method: 'DELETE', headers: await authHeaders(),
      });
      setAnnouncement(null);
      setAnnouncementText('');
      setEditingAnnouncement(false);
    } catch (e: any) { setError(e.message); }
  };

  const resetContentForm = () => {
    setShowContentForm(false);
    setEditItem(null);
    setContentForm({
      type: 'video', title: '', description: '', youtubeUrl: '', textContent: '',
      pdfUrl: '', linkUrl: '', linkLabel: '', galleryUrls: [''],
      questions: [{ question: '', options: ['', '', '', ''], correctIndex: 0 }],
    });
  };

  const startEdit = (item: ContentItem) => {
    setEditItem(item);
    setSelectedCat(item.categoryId);
    setContentForm({
      type: item.type, title: item.title, description: item.description,
      youtubeUrl: item.data?.youtubeId ? `https://youtube.com/watch?v=${item.data.youtubeId}` : '',
      textContent: item.data?.content || '',
      pdfUrl: item.data?.url || '',
      linkUrl: item.data?.url || '',
      linkLabel: item.data?.label || '',
      galleryUrls: item.data?.images?.length ? item.data.images : [''],
      questions: item.data?.questions?.length ? item.data.questions : [{ question: '', options: ['', '', '', ''], correctIndex: 0 }],
    });
    setShowContentForm(true);
  };

  // ── Hesaplamalar ──
  const catContents = selectedCat ? contents.filter(c => c.categoryId === selectedCat) : [];
  const totalContents = contents.length;
  const completedCount = Object.values(progress).filter(p => p.watched).length;
  const selectedCatObj = categories.find(c => c.id === selectedCat);

  // ── İçerik Görüntüleme ──
  const renderContentView = (item: ContentItem) => {
    const meta = TYPE_META[item.type];
    const Icon = meta.icon;
    const isWatched = progress[item.id]?.watched;

    return (
      <div className="min-h-screen pb-24" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-black/60 border-b border-white/8 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setSelectedContent(null); setQuizAnswers({}); setQuizSubmitted(false); }}
            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{item.title}</p>
            <p className="text-[10px] text-white/40 flex items-center gap-1">
              <Icon className="w-3 h-3" style={{ color: meta.color }} /> {meta.label}
            </p>
          </div>
          <button
            onClick={() => markProgress(item.id, !isWatched)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: isWatched ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)',
              border: isWatched ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.15)',
              color: isWatched ? '#34d399' : 'rgba(255,255,255,0.6)',
            }}
          >
            <CheckCircle className="w-3.5 h-3.5 inline mr-1" style={{ verticalAlign: -2 }} />
            {isWatched ? 'Tamamlandı' : 'Tamamla'}
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Video */}
          {item.type === 'video' && item.data?.youtubeId && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
              <iframe
                width="100%" height="220"
                src={`https://www.youtube.com/embed/${item.data.youtubeId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none', display: 'block' }}
              />
            </div>
          )}

          {/* Yazı */}
          {item.type === 'text' && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {item.data?.content}
              </div>
            </div>
          )}

          {/* PDF */}
          {item.type === 'pdf' && item.data?.url && (
            <a href={item.data.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                <FileText className="w-6 h-6" style={{ color: meta.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">PDF Dosyayı Aç</p>
                <p className="text-[10px] text-white/40">Yeni sekmede açılır</p>
              </div>
              <ExternalLink className="w-4 h-4 text-white/30" />
            </a>
          )}

          {/* Galeri */}
          {item.type === 'gallery' && item.data?.images?.length > 0 && (
            <div className="space-y-3">
              {item.data.images.map((url: string, i: number) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-white/10">
                  <img src={url} alt={`${i + 1}`} className="w-full" style={{ display: 'block' }} />
                </div>
              ))}
            </div>
          )}

          {/* Quiz */}
          {item.type === 'quiz' && item.data?.questions?.length > 0 && (
            <div className="space-y-4">
              {item.data.questions.map((q: QuizQuestion, qi: number) => (
                <div key={qi} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-sm font-bold text-white mb-3">
                    <span className="text-ta mr-1.5">{qi + 1}.</span>{q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const selected = quizAnswers[qi] === oi;
                      const isCorrect = q.correctIndex === oi;
                      const showResult = quizSubmitted;
                      return (
                        <button key={oi}
                          onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [qi]: oi }))}
                          className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                          style={{
                            background: showResult && isCorrect ? 'rgba(16,185,129,0.15)'
                              : showResult && selected && !isCorrect ? 'rgba(239,68,68,0.15)'
                              : selected ? 'rgba(var(--app-accent-rgb),0.15)' : 'rgba(255,255,255,0.05)',
                            border: showResult && isCorrect ? '1px solid rgba(16,185,129,0.4)'
                              : showResult && selected && !isCorrect ? '1px solid rgba(239,68,68,0.4)'
                              : selected ? '1px solid rgba(var(--app-accent-rgb),0.4)' : '1px solid rgba(255,255,255,0.1)',
                            color: showResult && isCorrect ? '#34d399'
                              : showResult && selected && !isCorrect ? '#f87171'
                              : selected ? 'var(--app-accent, #a855f7)' : 'rgba(255,255,255,0.7)',
                          }}
                        >
                          <span className="font-bold mr-2">{String.fromCharCode(65 + oi)})</span>{opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!quizSubmitted ? (
                <button
                  onClick={() => {
                    setQuizSubmitted(true);
                    const total = item.data.questions.length;
                    const correct = item.data.questions.filter((_: any, i: number) => quizAnswers[i] === item.data.questions[i].correctIndex).length;
                    if (correct === total) markProgress(item.id, true);
                  }}
                  disabled={Object.keys(quizAnswers).length < item.data.questions.length}
                  className="w-full py-3 rounded-xl bg-ta text-white font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-all"
                >
                  Cevapları Kontrol Et
                </button>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-lg font-black text-white">
                    {item.data.questions.filter((_: any, i: number) => quizAnswers[i] === item.data.questions[i].correctIndex).length}
                    /{item.data.questions.length} Doğru
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Link */}
          {item.type === 'link' && item.data?.url && (
            <a href={item.data.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
                <LinkIcon className="w-6 h-6" style={{ color: meta.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{item.data.label || 'Bağlantıyı Aç'}</p>
                <p className="text-[10px] text-white/40 truncate">{item.data.url}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-white/30" />
            </a>
          )}

          {/* Açıklama */}
          {item.description && (
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
              <p className="text-xs text-white/50 leading-relaxed">{item.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── İçerik Formu ──
  const renderContentForm = () => (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto" onClick={() => resetContentForm()}>
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-sm font-bold text-white">{editItem ? 'İçerik Düzenle' : 'Yeni İçerik'}</h3>
          <button onClick={resetContentForm} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="p-4 pb-20 space-y-4">
          {/* Tip seçimi */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TYPE_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const active = contentForm.type === key;
              return (
                <button key={key} onClick={() => setContentForm(f => ({ ...f, type: key as any }))}
                  className="p-2.5 rounded-xl text-center transition-all"
                  style={{
                    background: active ? `${meta.color}20` : 'rgba(255,255,255,0.04)',
                    border: active ? `1px solid ${meta.color}50` : '1px solid rgba(255,255,255,0.1)',
                  }}>
                  <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: active ? meta.color : 'rgba(255,255,255,0.4)' }} />
                  <span className="text-[10px] font-bold" style={{ color: active ? meta.color : 'rgba(255,255,255,0.4)' }}>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Başlık */}
          <input
            value={contentForm.title}
            onChange={e => setContentForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Başlık"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20"
          />

          {/* Açıklama */}
          <textarea
            value={contentForm.description}
            onChange={e => setContentForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Açıklama (opsiyonel)"
            rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20 resize-none"
          />

          {/* Tipe özel alanlar */}
          {contentForm.type === 'video' && (
            <input
              value={contentForm.youtubeUrl}
              onChange={e => setContentForm(f => ({ ...f, youtubeUrl: e.target.value }))}
              placeholder="YouTube linki yapıştır"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20"
            />
          )}

          {contentForm.type === 'text' && (
            <textarea
              value={contentForm.textContent}
              onChange={e => setContentForm(f => ({ ...f, textContent: e.target.value }))}
              placeholder="İçerik metni..."
              rows={8}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20 resize-none"
            />
          )}

          {contentForm.type === 'pdf' && (
            <input
              value={contentForm.pdfUrl}
              onChange={e => setContentForm(f => ({ ...f, pdfUrl: e.target.value }))}
              placeholder="PDF dosya URL'si"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20"
            />
          )}

          {contentForm.type === 'link' && (
            <>
              <input
                value={contentForm.linkUrl}
                onChange={e => setContentForm(f => ({ ...f, linkUrl: e.target.value }))}
                placeholder="URL"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20"
              />
              <input
                value={contentForm.linkLabel}
                onChange={e => setContentForm(f => ({ ...f, linkLabel: e.target.value }))}
                placeholder="Bağlantı etiketi (opsiyonel)"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20"
              />
            </>
          )}

          {contentForm.type === 'gallery' && (
            <div className="space-y-2">
              {contentForm.galleryUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={url}
                    onChange={e => {
                      const urls = [...contentForm.galleryUrls];
                      urls[i] = e.target.value;
                      setContentForm(f => ({ ...f, galleryUrls: urls }));
                    }}
                    placeholder={`Resim URL ${i + 1}`}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-ta/50 placeholder-white/20"
                  />
                  {contentForm.galleryUrls.length > 1 && (
                    <button onClick={() => setContentForm(f => ({ ...f, galleryUrls: f.galleryUrls.filter((_, j) => j !== i) }))}
                      className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setContentForm(f => ({ ...f, galleryUrls: [...f.galleryUrls, ''] }))}
                className="text-xs text-ta font-bold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Resim ekle
              </button>
            </div>
          )}

          {contentForm.type === 'quiz' && (
            <div className="space-y-4">
              {contentForm.questions.map((q, qi) => (
                <div key={qi} className="bg-white/4 border border-white/8 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/50">Soru {qi + 1}</span>
                    {contentForm.questions.length > 1 && (
                      <button onClick={() => setContentForm(f => ({ ...f, questions: f.questions.filter((_, j) => j !== qi) }))}
                        className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <input
                    value={q.question}
                    onChange={e => {
                      const qs = [...contentForm.questions];
                      qs[qi] = { ...qs[qi], question: e.target.value };
                      setContentForm(f => ({ ...f, questions: qs }));
                    }}
                    placeholder="Soru metni"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs outline-none placeholder-white/20"
                  />
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const qs = [...contentForm.questions];
                          qs[qi] = { ...qs[qi], correctIndex: oi };
                          setContentForm(f => ({ ...f, questions: qs }));
                        }}
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{
                          borderColor: q.correctIndex === oi ? '#10b981' : 'rgba(255,255,255,0.2)',
                          background: q.correctIndex === oi ? 'rgba(16,185,129,0.2)' : 'transparent',
                        }}
                      >
                        {q.correctIndex === oi && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                      <input
                        value={opt}
                        onChange={e => {
                          const qs = [...contentForm.questions];
                          const opts = [...qs[qi].options];
                          opts[oi] = e.target.value;
                          qs[qi] = { ...qs[qi], options: opts };
                          setContentForm(f => ({ ...f, questions: qs }));
                        }}
                        placeholder={`Seçenek ${String.fromCharCode(65 + oi)}`}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs outline-none placeholder-white/20"
                      />
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={() => setContentForm(f => ({ ...f, questions: [...f.questions, { question: '', options: ['', '', '', ''], correctIndex: 0 }] }))}
                className="text-xs text-ta font-bold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Soru ekle
              </button>
            </div>
          )}

          {/* Kaydet */}
          <button onClick={saveContent} disabled={saving || !contentForm.title.trim()}
            className="w-full py-3 rounded-xl bg-ta text-white font-bold text-sm disabled:opacity-30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editItem ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </motion.div>
    </div>
  );

  // ── İçerik detayı açıksa ──
  if (selectedContent) {
    return renderContentView(selectedContent);
  }

  // ── Helpers ──
  const companyName = typeof window !== 'undefined' ? localStorage.getItem('aspect_company_name') || 'Aspect' : 'Aspect';

  // Son tamamlanmamış içerik — "Devam et" hero için
  const lastUnfinished = contents.find(c => !progress[c.id]?.watched);
  const lastUnfinishedCat = lastUnfinished ? categories.find(cat => cat.id === lastUnfinished.categoryId) : null;

  // ── Ana sayfa ──
  return (
    <div className="pb-20 min-h-screen" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>

      {!selectedCat ? (
        <>
          {/* ── Hero Header ── */}
          <div className="relative px-4 pt-4 pb-5 mb-1 overflow-hidden">
            {/* Arka plan glow'ları */}
            <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full opacity-15" style={{ background: 'var(--app-accent)', filter: 'blur(60px)' }} />
            <div className="absolute -bottom-10 -right-10 w-36 h-36 rounded-full opacity-10" style={{ background: '#22d3ee', filter: 'blur(50px)' }} />

            <div className="relative">
              {/* Üst satır: Logo + Admin */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(var(--app-accent-rgb),0.15)', border: '1px solid rgba(var(--app-accent-rgb),0.25)' }}>
                    🎓
                  </div>
                  <div>
                    <h1 className="text-[16px] font-black text-white tracking-tight">{companyName} Akademi</h1>
                    <p className="text-[10px] text-white/30 -mt-0.5">Eğitim & Gelişim</p>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => setShowCatForm(true)}
                    className="h-8 px-3 rounded-xl bg-ta/15 border border-ta/30 flex items-center gap-1.5 active:scale-95 transition-all">
                    <Plus className="w-3.5 h-3.5 text-ta" />
                    <span className="text-[10px] font-bold text-ta">Kategori</span>
                  </button>
                )}
              </div>

              {/* İlerleme çubuğu + istatistikler */}
              {totalContents > 0 && (
                <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold text-white/40">İLERLEME</span>
                    <span className="text-[11px] font-black text-ta">{Math.round((completedCount / totalContents) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedCount / totalContents) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--app-accent), #22d3ee)' }}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-ta" />
                      <span className="text-[10px] text-white/50"><b className="text-white">{completedCount}</b> tamamlandı</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                      <span className="text-[10px] text-white/50"><b className="text-white">{totalContents - completedCount}</b> kalan</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Yönetici Duyuru Mesajı ── */}
          {(announcement || (isAdmin && editingAnnouncement)) && (
            <div className="px-4 mb-3">
              {editingAnnouncement ? (
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                  <textarea
                    value={announcementText}
                    onChange={e => setAnnouncementText(e.target.value)}
                    placeholder="Personele mesajınızı yazın..."
                    rows={2}
                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-white text-xs outline-none placeholder-white/25 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingAnnouncement(false); setAnnouncementText(announcement?.message || ''); }}
                      className="flex-1 py-1.5 rounded-lg bg-white/8 text-white/50 text-[10px] font-semibold">İptal</button>
                    <button onClick={saveAnnouncement} disabled={!announcementText.trim()}
                      className="flex-1 py-1.5 rounded-lg bg-orange-500/20 text-orange-300 text-[10px] font-bold disabled:opacity-30">Kaydet</button>
                  </div>
                </div>
              ) : announcement ? (
                <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                  <span className="text-sm mt-0.5">📢</span>
                  <p className="flex-1 text-[11px] text-orange-200/80 leading-relaxed">{announcement.message}</p>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setAnnouncementText(announcement.message); setEditingAnnouncement(true); }}
                        className="w-6 h-6 rounded-md bg-white/6 flex items-center justify-center">
                        <Edit3 className="w-3 h-3 text-white/40" />
                      </button>
                      <button onClick={deleteAnnouncement}
                        className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center">
                        <Trash2 className="w-3 h-3 text-red-400/60" />
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Admin: Duyuru yaz butonu (duyuru yoksa) */}
          {isAdmin && !announcement && !editingAnnouncement && (
            <div className="px-4 mb-3">
              <button onClick={() => setEditingAnnouncement(true)}
                className="w-full py-2 rounded-xl border border-dashed border-orange-500/20 flex items-center justify-center gap-1.5 text-[10px] text-orange-400/60 font-semibold active:scale-[0.98] transition-all"
                style={{ background: 'rgba(251,146,60,0.03)' }}>
                <Edit3 className="w-3 h-3" /> Duyuru mesajı ekle
              </button>
            </div>
          )}

          {/* ── Motivasyon Mesajı ── */}
          {totalContents > 0 && (
            <div className="px-4 mb-4">
              <p className="text-[11px] text-white/25 text-center italic">
                {(() => {
                  const pct = Math.round((completedCount / totalContents) * 100);
                  if (pct === 0) return '🚀 Eğitimlere başlayarak kendinizi geliştirin!';
                  if (pct <= 30) return '💪 Harika bir başlangıç! Devam edin.';
                  if (pct <= 60) return '📈 Yarıdan fazlasını tamamladınız!';
                  if (pct < 100) return '🔥 Az kaldı! Tamamlamak üzeresiniz.';
                  return '🏆 Tebrikler! Tüm eğitimleri tamamladınız.';
                })()}
              </p>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-ta animate-spin" />
              <p className="text-xs text-white/30">Yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="mx-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={() => { setError(''); fetchData(); }} className="text-xs text-red-400 mt-2 underline">Tekrar dene</button>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-white/15" />
              </div>
              <p className="text-sm font-semibold text-white/30">Henüz içerik eklenmemiş</p>
              {isAdmin && <p className="text-xs text-white/20 mt-1">+ butonuyla kategori ekleyin</p>}
            </div>
          ) : (
            /* ── Kategoriler + Yatay İçerikler ── */
            <div className="space-y-5">
              {categories.map((cat, catIdx) => {
                const catItems = contents.filter(c => c.categoryId === cat.id);
                const catDone = catItems.filter(c => progress[c.id]?.watched).length;
                if (catItems.length === 0 && !isAdmin) return null;

                return (
                  <div key={cat.id}>
                    {/* Kategori başlık */}
                    <div className="px-4 flex items-center gap-2 mb-2.5">
                      <span className="text-base">{cat.emoji}</span>
                      <span className="text-[13px] font-bold text-white flex-1">{cat.name}</span>
                      {catItems.length > 0 && (
                        <span className="text-[10px] font-bold text-white/25">{catDone}/{catItems.length}</span>
                      )}
                      {isAdmin && (
                        <button onClick={() => { setSelectedCat(cat.id); setShowContentForm(true); }}
                          className="w-6 h-6 rounded-md bg-white/6 border border-white/10 flex items-center justify-center">
                          <Plus className="w-3 h-3 text-white/30" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteCategory(cat.id)}
                          className="w-6 h-6 rounded-md bg-red-500/8 border border-red-500/15 flex items-center justify-center">
                          <Trash2 className="w-3 h-3 text-red-400/50" />
                        </button>
                      )}
                    </div>

                    {/* İçerikler yatay scroll */}
                    {catItems.length === 0 ? (
                      <div className="mx-4 h-20 rounded-xl border border-dashed border-white/8 flex items-center justify-center">
                        <span className="text-[10px] text-white/15">İçerik ekleyin</span>
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pl-4 pr-4 pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                        {catItems.map(item => {
                          const meta = TYPE_META[item.type];
                          const Icon = meta.icon;
                          const isWatched = progress[item.id]?.watched;

                          return (
                            <motion.button key={item.id} whileTap={{ scale: 0.96 }}
                              onClick={() => setSelectedContent(item)}
                              className="shrink-0 w-[180px] rounded-xl overflow-hidden text-left relative group/card"
                              style={{
                                background: isWatched ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)',
                                border: isWatched ? '1px solid rgba(16,185,129,0.12)' : '1px solid rgba(255,255,255,0.07)',
                              }}
                            >
                              {/* Üst kısım — thumbnail veya ikon */}
                              {item.type === 'video' && item.data?.youtubeId ? (
                                <div className="relative w-full h-[100px] bg-black/30">
                                  <img src={`https://img.youtube.com/vi/${item.data.youtubeId}/mqdefault.jpg`}
                                    alt="" className="w-full h-full object-cover" style={{ opacity: isWatched ? 0.5 : 0.85 }} />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 flex items-center justify-center">
                                      <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
                                    </div>
                                  </div>
                                  {isWatched && (
                                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-emerald-500/90 flex items-center gap-0.5">
                                      <CheckCircle className="w-2.5 h-2.5 text-white" />
                                      <span className="text-[7px] font-bold text-white">İzlendi</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="relative w-full h-[72px] flex items-center justify-center"
                                  style={{ background: `linear-gradient(135deg, ${meta.color}10, ${meta.color}05)` }}>
                                  <Icon className="w-7 h-7" style={{ color: `${meta.color}50` }} />
                                  <span className="absolute top-1.5 left-1.5 text-[7px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: `${meta.color}20`, color: `${meta.color}cc` }}>{meta.label}</span>
                                  {isWatched && (
                                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-emerald-500/90 flex items-center gap-0.5">
                                      <CheckCircle className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Alt bilgi */}
                              <div className="p-2.5">
                                <p className="text-[11px] font-semibold text-white leading-tight" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</p>
                              </div>

                              {/* Admin overlay */}
                              {isAdmin && (
                                <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-active/card:opacity-100 transition-opacity z-10">
                                  <button onClick={e => { e.stopPropagation(); startEdit(item); }}
                                    className="w-5 h-5 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                    <Edit3 className="w-2.5 h-2.5 text-white/80" />
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); deleteContent(item.id); }}
                                    className="w-5 h-5 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                    <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                  </button>
                                </div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── Kategori İçi Detay ── */
        <>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setSelectedCat(null)}
                className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-95 transition-all">
                <ArrowLeft className="w-4 h-4 text-white/70" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="text-lg">{selectedCatObj?.emoji}</span>
                  {selectedCatObj?.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-ta rounded-full transition-all"
                      style={{ width: `${catContents.length > 0 ? (catContents.filter(c => progress[c.id]?.watched).length / catContents.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] text-white/40 font-bold">
                    {catContents.filter(c => progress[c.id]?.watched).length}/{catContents.length}
                  </span>
                </div>
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => setShowContentForm(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-ta/30 flex items-center justify-center gap-2 text-ta text-xs font-bold active:scale-[0.98] transition-all"
                style={{ background: 'rgba(var(--app-accent-rgb),0.05)' }}>
                <Plus className="w-4 h-4" /> İçerik Ekle
              </button>
            )}
          </div>

          {/* ── İçerik Listesi ── */}
        <div className="px-4 space-y-2.5">
          {catContents.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-white/15" />
              </div>
              <p className="text-sm font-semibold text-white/30">Bu kategoride henüz içerik yok</p>
              {isAdmin && <p className="text-xs text-white/20 mt-1">Yukarıdaki butonla içerik ekleyin</p>}
            </div>
          ) : catContents.map((item, idx) => {
            const meta = TYPE_META[item.type];
            const Icon = meta.icon;
            const isWatched = progress[item.id]?.watched;

            return (
              <motion.div key={item.id} whileTap={{ scale: 0.98 }}>
                <button
                  onClick={() => setSelectedContent(item)}
                  className="w-full rounded-2xl overflow-hidden text-left transition-all"
                  style={{
                    background: isWatched ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.04)',
                    border: isWatched ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {/* Video thumbnail */}
                  {item.type === 'video' && item.data?.youtubeId && (
                    <div className="relative w-full h-36 bg-black/40">
                      <img
                        src={`https://img.youtube.com/vi/${item.data.youtubeId}/mqdefault.jpg`}
                        alt={item.title}
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                        </div>
                      </div>
                      {isWatched && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-emerald-500/80 backdrop-blur-sm flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-white" />
                          <span className="text-[9px] font-bold text-white">İzlendi</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm"
                          style={{ background: `${meta.color}90`, color: '#fff' }}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 flex items-center gap-3">
                    {/* Tip ikonu (video hariç — thumbnail var) */}
                    {item.type !== 'video' && (
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: isWatched ? 'rgba(16,185,129,0.12)' : `${meta.color}12`,
                          border: isWatched ? '1px solid rgba(16,185,129,0.25)' : `1px solid ${meta.color}25`,
                        }}>
                        {isWatched
                          ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                          : <Icon className="w-5 h-5" style={{ color: meta.color }} />
                        }
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-white truncate">{item.title}</p>
                        {item.type !== 'video' && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: `${meta.color}15`, color: meta.color }}>
                            {meta.label}
                          </span>
                        )}
                      </div>
                      {item.description && <p className="text-[10px] text-white/35 truncate mt-0.5">{item.description}</p>}
                    </div>
                    {/* Admin butonları */}
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={e => { e.stopPropagation(); startEdit(item); }}
                          className="w-7 h-7 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center">
                          <Edit3 className="w-3 h-3 text-white/40" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteContent(item.id); }}
                          className="w-7 h-7 rounded-lg bg-red-500/8 border border-red-500/15 flex items-center justify-center">
                          <Trash2 className="w-3 h-3 text-red-400/70" />
                        </button>
                      </div>
                    )}
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
        </>
      )}

      {/* Kategori ekleme formu */}
      <AnimatePresence>
        {showCatForm && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => setShowCatForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#1a1a2e] border border-white/10 rounded-2xl p-5 space-y-4"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-white">Yeni Kategori</h3>
              {/* Emoji seçimi */}
              <div className="flex flex-wrap gap-2">
                {['📸', '💰', '📱', '🎯', '📚', '🎨', '🎬', '💡', '🔧', '🏆', '🎓', '📊', '🗣️', '🤝', '⚡', '🌟'].map(e => (
                  <button key={e} onClick={() => setCatForm(f => ({ ...f, emoji: e }))}
                    className="w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all"
                    style={{
                      background: catForm.emoji === e ? 'rgba(var(--app-accent-rgb),0.2)' : 'rgba(255,255,255,0.05)',
                      border: catForm.emoji === e ? '1.5px solid rgba(var(--app-accent-rgb),0.5)' : '1px solid rgba(255,255,255,0.1)',
                      transform: catForm.emoji === e ? 'scale(1.1)' : 'scale(1)',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
              <input
                value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Kategori adı"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none placeholder-white/20 focus:border-ta/50"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowCatForm(false)} className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/60 text-sm font-semibold">
                  İptal
                </button>
                <button onClick={saveCategory} disabled={saving || !catForm.name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-ta text-white text-sm font-bold disabled:opacity-30 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Ekle
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* İçerik ekleme/düzenleme formu */}
      <AnimatePresence>
        {showContentForm && renderContentForm()}
      </AnimatePresence>

      {/* TEMP: Vardiya içerik ekle */}
      {isAdmin && categories.length > 0 && (
        <button onClick={async () => {
          const cat = categories.find(c => c.name.toLowerCase().includes('uygulama'));
          if (!cat) { alert('Uygulama Kullanımı kategorisi bulunamadı'); return; }
          try {
            const res = await fetch(appendGhostParam(`${API_BASE}/academy/seed-content`), {
              method: 'POST', headers: await authHeaders(),
              body: JSON.stringify({
                categoryId: cat.id,
                items: [
                  {
                    type: 'text',
                    title: 'Vardiya Açılış — Adım Adım Rehber',
                    description: 'Vardiya açılışı nasıl yapılır, personel fotoğrafı, yazıcı sayaçları',
                    data: { content: `📋 VARDİYA AÇILIŞ REHBERİ

1️⃣ MEKANA GİRİŞ
• Operasyon Paneli'ni aç
• Mekan seçimi yapılır (rotasyonda atandığın mekan otomatik gelir)
• Eğer rotasyonda atanmamışsan açılış yapamazsın

2️⃣ PERSONEL FOTOĞRAFI
• Ön kamera açılır — selfie çek
• Bu fotoğraf Telegram grubuna otomatik gönderilir
• Fotoğraf çekmeden açılış yapılamaz

3️⃣ STOK SAYIMI
• Mevcut albüm stoğunu say (3'lü, 5'li, 7'li... 15'li)
• Paspartu sayısını gir
• Ribon sayısını gir (yazıcı bazlı)
• Önceki günün kapanış sayısı öneri olarak gösterilir
• Fark varsa anomali olarak kaydedilir

4️⃣ YAZICI SAYAÇLARI
• Her yazıcı için başlangıç sayacını gir
• Önceki günün kapanış sayacı öneri olarak gösterilir
• Sayaç uyuşmazlığı varsa anomali kaydedilir

5️⃣ AÇILIŞ NOTU (Opsiyonel)
• Vardiya ile ilgili not ekleyebilirsin
• Önceki personelden devir bilgisi varsa buraya yaz

6️⃣ AÇILIŞI TAMAMLA
• "Açılışı Kaydet" butonuna bas
• Telegram grubuna bildirim gider: mekan adı + saat + personel adı + fotoğraf
• Açılış yapıldıktan sonra satış girişine geçilir

⚠️ ÖNEMLİ NOTLAR:
• Açılış günde bir kez yapılır
• Saat 08:00 öncesi açılış bir önceki güne sayılır
• Anomali varsa sebep yazmanız istenir
• Yanlış açılış yapıldıysa yönetici sıfırlayabilir` }
                  },
                  {
                    type: 'text',
                    title: 'Vardiya Kapanış — Adım Adım Rehber',
                    description: 'Vardiya kapanışı, yazıcı sayaçları, stok sayımı, mekan fotoğrafı',
                    data: { content: `📋 VARDİYA KAPANIŞ REHBERİ

1️⃣ KAPANIŞA HAZIRLIK
• Tüm satışların girildiğinden emin ol
• İade varsa iade fotoğraf sayısını not al
• Reyon sayımı yap (varsa)

2️⃣ YAZICI KAPANIŞ SAYAÇLARI
Her yazıcı için:
• Kapanış sayacını gir
• Ribon değişimi yaptıysan kaç takim değiştiğini gir
• İade fotoğraf sayısını gir

Sistem otomatik hesaplar:
• Kullanılan baskı = Açılış + (Ribon değişim × Kapasite) - Kapanış
• Çıkış adedi = Kullanılan baskı × Çarpan (yarım=2, tam=1)
• Satılan fotoğraf = Çıkış - İade

3️⃣ STOK SAYIMI
• Kapanış albüm stoğunu say
• Paspartu sayısını gir
• Ribon sayısını gir
• Sistem açılış ile karşılaştırır — fark = satılan/eklenen

4️⃣ MEKAN FOTOĞRAFI
• Arka kamera açılır — mekanın son halini çek
• Bu fotoğraf Telegram grubuna gönderilir
• Fotoğraf çekmeden kapanış yapılamaz

5️⃣ KAPANIŞ NOTU (Opsiyonel)
• Gün sonu notlarını yaz
• Sonraki personel için bilgi bırak

6️⃣ KAPANIŞI TAMAMLA
• "Kapanışı Kaydet" butonuna bas
• Telegram grubuna bildirim gider: mekan + saat + personel + fotoğraf
• Vardiya raporlarında görünür hale gelir
• Kasa'da "bekleyen devir" olarak ciro görünür

⚠️ ÖNEMLİ NOTLAR:
• Kapanış sayacı açılış sayacından küçük olamaz
• ±2 fotoğraf toleransı var (yazıcı anomali)
• Anomali tespit edilirse uyarı çıkar — neden yazmanız istenir
• Kapanış yapılmadan vardiya raporlarında görünmez` }
                  },
                  {
                    type: 'text',
                    title: 'Satış Girişi — Nasıl Yapılır',
                    description: 'Ürün seçimi, ödeme yöntemi, iskonto, kare kaydı',
                    data: { content: `📋 SATIŞ GİRİŞİ REHBERİ

1️⃣ ÜRÜN SEÇİMİ
• Açılış yapıldıktan sonra satış paneli aktif olur
• Ürün kartlarından birini seç:
  - 1 Fotoğraf, 3'lü, 5'li, 7'li, 9'lu, 11'li, 13'lü, 15'li
  - Paspartu
• Adet seçimi yap (varsayılan 1)

2️⃣ ÖDEME YÖNTEMİ
• Nakit 💵
• Kredi Kartı 💳
• IBAN / Havale 🏦
• Ödeme yöntemi raporlarda ayrı gösterilir

3️⃣ FİYAT & İSKONTO
• Birim fiyat mekan ayarından gelir
• İskonto yapılabilir — farkı otomatik hesaplanır
• İskonto raporlarda gösterilir

4️⃣ KARE KAYDI
• Satış yapan fotoğrafçı seçilir
• Fotoğraf karesi kaydedilir
• Liderlik tablosuna yansır

5️⃣ SATIŞ ONAYI
• "Satışı Kaydet" butonuna bas
• Satış anlık olarak kaydedilir
• Canlı Feed'de görünür (yönetici)

⚠️ İPTAL
• Son satışı iptal edebilirsin
• İptal edilen satış raporlarda "iptal" olarak işaretlenir
• Ciroya dahil edilmez` }
                  },
                  {
                    type: 'quiz',
                    title: 'Vardiya Bilgi Testi',
                    description: 'Açılış ve kapanış sürecini ne kadar biliyorsun?',
                    data: { questions: [
                      { question: 'Vardiya açılışında ilk ne yapılır?', options: ['Satış girilir', 'Personel fotoğrafı çekilir', 'Stok sayılır', 'Yazıcı açılır'], correctIndex: 1 },
                      { question: 'Kapanışta mekan fotoğrafı hangi kamerayla çekilir?', options: ['Ön kamera', 'Arka kamera', 'Fark etmez', 'Fotoğraf gerekmez'], correctIndex: 1 },
                      { question: 'Anomali nedir?', options: ['Satış hatası', 'Stok farkı', 'Yazılım hatası', 'Kamera arızası'], correctIndex: 1 },
                      { question: 'Saat 07:00\'da yapılan açılış hangi güne sayılır?', options: ['Bugün', 'Dün', 'Yarın', 'Fark etmez'], correctIndex: 1 },
                      { question: 'Kapanış yapılmadan ne olmaz?', options: ['Satış girilmez', 'Vardiya raporunda görünmez', 'Kasa açılmaz', 'Mesaj gönderilmez'], correctIndex: 1 },
                    ]}
                  }
                ]
              })
            });
            const data = await res.json();
            alert(`${data.count} içerik eklendi!`);
            fetchData();
          } catch { alert('Hata'); }
        }} className="mx-4 mb-4 py-2 rounded-xl text-[10px] font-bold text-emerald-400/40 border border-emerald-500/15 w-[calc(100%-2rem)] text-center">
          📚 İçerik Ekle (Seed)
        </button>
      )}

      {/* Bottom Navigation */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <NewBottomNav activeTab="profile" onTabChange={onNavigate} userRole={userRole} />
      )}
    </div>
  );
}

export default AspectAcademy;
