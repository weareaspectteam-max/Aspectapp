/**
 * Offline Satış Kuyruğu
 *
 * Satış sırasında internet yoksa satış verisi localStorage'a kaydedilir.
 * İnternet geldiğinde otomatik olarak sunucuya gönderilir.
 *
 * Güvenlik:
 *  - Token ASLA saklanmaz — gönderim anında getToken() ile taze token alınır
 *  - userId ile kullanıcı eşleşmesi kontrol edilir (çoklu kullanıcı senaryosu)
 */

export interface QueuedSale {
  id: string;         // lokal uuid (q_timestamp_random)
  userId: string;     // sahiplik kontrolü için
  projectName: string;
  mekanId: string;
  tarih: string;      // YYYY-MM-DD — kuyruğa alındığı gün
  items: Array<{
    product: string;
    quantity: number;
    unitPrice: number;
    color: string;
  }>;
  totalPrice: number;
  discount: number;
  paymentMethod: 'cash' | 'iban' | 'card';
  currency: string;
  currencyPrice: number | null;
  queuedAt: number;   // Date.now()
}

const QUEUE_KEY = 'aspect_offline_sales_queue';

export function getQueue(): QueuedSale[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedSale[];
  } catch {
    return [];
  }
}

export function getUserQueue(userId: string): QueuedSale[] {
  return getQueue().filter(s => s.userId === userId);
}

export function enqueue(sale: QueuedSale): void {
  try {
    const queue = getQueue();
    queue.push(sale);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offline-queue] enqueue hatası:', err);
  }
}

export function dequeue(id: string): void {
  try {
    const queue = getQueue().filter(s => s.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offline-queue] dequeue hatası:', err);
  }
}

/** Kullanıcı logout yaparken çağrılır — kuyruğu temizler */
export function clearUserQueue(userId: string): void {
  try {
    const queue = getQueue().filter(s => s.userId !== userId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offline-queue] clearUserQueue hatası:', err);
  }
}

export function generateQueueId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── KARE KUYRUĞU ──────────────────────────────────────────────────────────────

export interface QueuedFrame {
  id: string;         // lokal uuid (qf_timestamp_random)
  userId: string;     // sahiplik kontrolü için
  projectName: string;
  mekanId: string;
  tarih: string;      // YYYY-MM-DD
  photographerName: string;
  photographerId: string;
  frameCount: number;
  queuedAt: number;   // Date.now()
}

const FRAME_QUEUE_KEY = 'aspect_offline_frames_queue';

export function getFrameQueue(): QueuedFrame[] {
  try {
    const raw = localStorage.getItem(FRAME_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedFrame[];
  } catch {
    return [];
  }
}

export function getUserFrameQueue(userId: string): QueuedFrame[] {
  return getFrameQueue().filter(f => f.userId === userId);
}

export function enqueueFrame(frame: QueuedFrame): void {
  try {
    const queue = getFrameQueue();
    queue.push(frame);
    localStorage.setItem(FRAME_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offline-queue] enqueueFrame hatası:', err);
  }
}

export function dequeueFrame(id: string): void {
  try {
    const queue = getFrameQueue().filter(f => f.id !== id);
    localStorage.setItem(FRAME_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offline-queue] dequeueFrame hatası:', err);
  }
}

/** Kullanıcı logout yaparken çağrılır — kare kuyruğunu temizler */
export function clearUserFrameQueue(userId: string): void {
  try {
    const queue = getFrameQueue().filter(f => f.userId !== userId);
    localStorage.setItem(FRAME_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offline-queue] clearUserFrameQueue hatası:', err);
  }
}

export function generateFrameQueueId(): string {
  return `qf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}