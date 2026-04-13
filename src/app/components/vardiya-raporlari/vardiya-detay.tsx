import { useMemo } from 'react';
import {
  ArrowLeft, Users, Printer, TrendingUp, Package, CreditCard,
  Banknote, Wallet, AlertTriangle, Camera, Trophy,
  FileSpreadsheet, FileText, PrinterIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { VardiyaKayit } from './types';
import { tr, trRow, formatTarih, tl } from './helpers';

/* ─────────────────────── VardiyaDetay ─────────────────────── */
export function VardiyaDetay({ v, onBack }: { v: VardiyaKayit; onBack: () => void }) {
  const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px 16px', marginBottom: 10,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
  };
  const valStyle: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 };

  /* ───── Export helpers ───── */
  const dosyaAdi = `${v.mekan.replace(/\s+/g, '_')}_${v.tarih}`;

  function handleExcel() {
    const toplamPrim = v.primBilgi?.toplamPrim || 0;
    const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira + (v.personelMaasGideri || 0);
    const brutKar = v.toplamCiro - toplamMaliyet;

    /* Sayfa 1 — Genel Özet */
    const ozet = [
      ['Alan', 'Değer'],
      ['Mekan', v.mekan],
      ['Tarih', v.tarih],
      ['Açılış', v.acilisSaat],
      ['Kapanış', v.kapanisSaat],
      ['Print Tipi', v.printType === 'yarim' ? 'Yarım Boy' : v.printType === 'tam' ? 'Tam Boy' : '-'],
      [],
      ['CIRO & MALİYET', ''],
      ['Toplam Ciro (₺)', v.toplamCiro],
      ['  Nakit (₺)', v.nakitToplamTL],
      ['  IBAN (₺)', v.ibanToplamTL],
      ['  Kredi (₺)', v.krediToplamTL],
      ['Toplam İskonto (₺)', v.toplamIskonto],
      ['Albüm Maliyeti (₺)', v.albumMaliyeti],
      ['Baskı Maliyeti (₺)', v.baskiMaliyeti],
      ['Hakediş Toplamı (₺)', toplamPrim],
      ['Mekan Kirası (₺)', v.mekanGunlukKira],
      ['Toplam Maliyet (₺)', toplamMaliyet],
      ['Brüt Kâr (₺)', brutKar],
      [],
      ['STOK', ''],
      ['Stok Açılış', v.stokBaslangic],
      ['Stok Kapanış', v.stokBitis],
    ];

    /* Sayfa 2 — Personel */
    const personelBaslik = ['Ad', 'Kare', 'Nakit (₺)', 'IBAN (₺)', 'Kredi (₺)', 'Toplam (₺)', 'İskonto (₺)'];
    const personelRows = v.personeller.map(p => {
      const satirToplam = p.satirlar.reduce((s, sr) => s + sr.toplamTL, 0);
      const iskonto = Math.round(satirToplam - p.toplamTL);
      return [p.ad, p.kare, p.nakitTL, p.ibanTL, p.krediTL, p.toplamTL, iskonto];
    });

    /* Sayfa 3 — Yazıcı */
    const yaziciBaslik = ['Yazıcı', 'Açılış', 'Kapanış', 'Kullanılan Baskı', 'Çıkış Adedi (kare)', 'Ribon Değişimi'];
    const yaziciRows = v.yazicilar.map(y => [y.ad, y.baslangic, y.bitis, y.kullanilanBaski, y.cikisAdedi, y.ribonDegisim]);

    /* Sayfa 4 — Albüm */
    const albumRows = Object.entries(v.albumler).map(([urun, adet]) => [urun, adet]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ozet), 'Ozet');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([personelBaslik, ...personelRows]), 'Personel');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([yaziciBaslik, ...yaziciRows]), 'Yazicilar');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Urun', 'Adet'], ...albumRows]), 'Album');
    XLSX.writeFile(wb, `${dosyaAdi}.xlsx`);
  }

  function handlePDF() {
    const toplamPrim = v.primBilgi?.toplamPrim || 0;
    const personelMaas = v.personelMaasGideri || 0;
    const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira + personelMaas;
    const brutKar = v.toplamCiro - toplamMaliyet;
    const brutCiro = v.toplamCiro + v.toplamIskonto;
    const iskYuzde = brutCiro > 0 ? Math.round((v.toplamIskonto / brutCiro) * 100) : 0;
    const tl2 = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} TL`;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const aksan = [100, 180, 220] as [number, number, number];
    const mor = [120, 80, 200] as [number, number, number];
    const koyu = [15, 8, 35] as [number, number, number];
    const kirmizi = [220, 60, 60] as [number, number, number];
    const yesil = [40, 180, 120] as [number, number, number];
    const headStyle = { fillColor: aksan, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 7, cellPadding: 2 };
    const bodyStyle = { fontSize: 7, textColor: [40, 30, 60] as [number, number, number], cellPadding: 1.5 };
    const altRow = { fillColor: [245, 240, 255] as [number, number, number] };
    const mx = { left: 14, right: 14 };

    const getY = () => (doc as any).lastAutoTable?.finalY || 30;
    const ensureSpace = (needed: number) => { if (getY() + needed > 275) { doc.addPage(); return 12; } return getY(); };

    // Bölüm başlığı helper
    const sectionTitle = (title: string, yPos: number): number => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...koyu);
      doc.text(tr(title), 14, yPos);
      return yPos + 4;
    };

    // ═══ BAŞLIK BANDI ═══
    doc.setFillColor(...koyu);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setFillColor(...aksan);
    doc.rect(0, 32, 210, 1, 'F');
    // Mekan adı
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(tr(v.mekan), 14, 12);
    // Tarih — büyük ve belirgin
    doc.setFontSize(11);
    doc.setTextColor(...aksan);
    doc.setFont('helvetica', 'bold');
    doc.text(tr(formatTarih(v.tarih)), 14, 20);
    // Saat + baskı tipi
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 180);
    doc.setFont('helvetica', 'normal');
    doc.text(tr(`${v.acilisSaat} - ${v.kapanisSaat}  |  ${v.printType === 'yarim' ? 'Yarim Boy' : 'Tam Boy'}  |  Vardiya Raporu`), 14, 27);
    // Sağ üst — Toplam Ciro
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(tl2(v.toplamCiro), 196, 14, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 180);
    doc.text(tr('Toplam Ciro'), 196, 20, { align: 'right' });
    // Brüt kâr sağ alt
    doc.setFontSize(9);
    doc.setTextColor(...(brutKar >= 0 ? [100, 220, 160] as [number, number, number] : kirmizi));
    doc.setFont('helvetica', 'bold');
    doc.text(tr(`Brut Kar: ${brutKar >= 0 ? '' : '-'}${tl2(Math.abs(brutKar))}`), 196, 27, { align: 'right' });

    let y = 38;

    // ═══ ANOMALİLER ═══
    if (v.anomaliler.length > 0) {
      doc.setFillColor(255, 243, 224);
      const anomH = 5 + v.anomaliler.length * 4;
      doc.roundedRect(14, y, 182, anomH, 1.5, 1.5, 'F');
      doc.setDrawColor(240, 180, 100);
      doc.roundedRect(14, y, 182, anomH, 1.5, 1.5, 'S');
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 90, 20);
      v.anomaliler.forEach((a, i) => {
        doc.text(tr(`! ${a.tip === 'stok' ? 'Stok' : 'Yazici'}: ${a.aciklama}`), 18, y + 4 + i * 4);
      });
      y += anomH + 3;
    }

    // ═══ VARDİYA NOTLARI ═══
    const acilisNot = (v as any).acilisNot || '';
    const kapanisNot = (v as any).kapanisNot || '';
    if (acilisNot || kapanisNot) {
      doc.setFillColor(240, 238, 250);
      const notH = 5 + (acilisNot ? 4 : 0) + (kapanisNot ? 4 : 0);
      doc.roundedRect(14, y, 182, notH, 1.5, 1.5, 'F');
      doc.setFontSize(6);
      let ny = y + 4;
      if (acilisNot) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 160);
        doc.text(tr('Acilis: '), 18, ny);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 50, 80);
        doc.text(tr(acilisNot).substring(0, 130), 34, ny);
        ny += 4;
      }
      if (kapanisNot) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 60, 160);
        doc.text(tr('Kapanis: '), 18, ny);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 50, 80);
        doc.text(tr(kapanisNot).substring(0, 130), 37, ny);
      }
      y += notH + 3;
    }

    // ═══ CİRO & ÖDEME + MALİYET — YAN YANA ═══
    y = sectionTitle('Ciro & Odeme Dagilimi', y);
    const ciroStartY = y;
    autoTable(doc, {
      startY: y,
      head: [[tr('Odeme'), tr('Tutar')]],
      body: [
        [tr('Nakit'), tl2(v.nakitToplamTL)],
        [tr('IBAN'), tl2(v.ibanToplamTL)],
        [tr('Kredi Karti'), tl2(v.krediToplamTL)],
        ...(v.toplamIskonto > 0 ? [[tr(`Iskonto (%${iskYuzde})`), `-${tl2(v.toplamIskonto)}`]] : []),
        [{ content: tr('TOPLAM CIRO'), styles: { fontStyle: 'bold' } }, { content: tl2(v.toplamCiro), styles: { fontStyle: 'bold' } }],
      ],
      headStyles: headStyle,
      bodyStyles: bodyStyle,
      alternateRowStyles: altRow,
      margin: { left: 14, right: 110 },
    });

    // Maliyet tablosu sağ tarafta
    const maliyetRows: any[] = [];
    if (v.albumMaliyeti > 0) maliyetRows.push([tr('Album'), `-${tl2(v.albumMaliyeti)}`]);
    if (v.baskiMaliyeti > 0) maliyetRows.push([tr('Baski'), `-${tl2(v.baskiMaliyeti)}`]);
    if (toplamPrim > 0) maliyetRows.push([tr('Hakedis'), `-${tl2(toplamPrim)}`]);
    if (personelMaas > 0) maliyetRows.push([tr('Maas'), `-${tl2(personelMaas)}`]);
    if (v.mekanGunlukKira > 0) maliyetRows.push([tr('Kira'), `-${tl2(v.mekanGunlukKira)}`]);
    maliyetRows.push([{ content: tr('TOPLAM'), styles: { fontStyle: 'bold' } }, { content: `-${tl2(toplamMaliyet)}`, styles: { fontStyle: 'bold', textColor: kirmizi } }]);
    maliyetRows.push([{ content: tr('KAR'), styles: { fontStyle: 'bold' } }, { content: `${brutKar >= 0 ? '' : '-'}${tl2(Math.abs(brutKar))}`, styles: { fontStyle: 'bold', textColor: brutKar >= 0 ? yesil : kirmizi } }]);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...koyu);
    doc.text(tr('Maliyet & Kar/Zarar'), 110, ciroStartY - 4);
    autoTable(doc, {
      startY: ciroStartY,
      head: [[tr('Gider'), tr('Tutar')]],
      body: maliyetRows,
      headStyles: { ...headStyle, fillColor: mor },
      bodyStyles: bodyStyle,
      alternateRowStyles: altRow,
      margin: { left: 110, right: 14 },
    });
    y = getY() + 5;

    // ═══ ALBÜM DÖKÜMÜ (tek satır) ═══
    if (Object.keys(v.albumler).length > 0) {
      const albumStr = Object.entries(v.albumler).map(([u, a]) => `${tr(u)} x${a}`).join('  |  ');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 90, 130);
      doc.text(tr(`Album: ${albumStr}  |  Maliyet: -${tl2(v.albumMaliyeti)}`), 14, y);
      y += 5;
    }

    // ═══ PERSONEL DETAYI ═══
    if (v.personeller.length > 0) {
      y = ensureSpace(18) + 5;
      y = sectionTitle('Personel Detayi', y);
      autoTable(doc, {
        startY: y,
        head: [[tr('Ad'), tr('Kare'), tr('Nakit'), tr('IBAN'), tr('Kredi'), tr('Toplam'), tr('Isk.'), tr('Maas'), tr('Hakedis'), tr('Kazanc')]],
        body: v.personeller.map(p => {
          const st = p.satirlar.reduce((s, sr) => s + sr.toplamTL, 0);
          const isk = Math.round(st - p.toplamTL);
          const prim = p.hakedisDahil === false ? 0 : (v.primBilgi?.topKademePrim || 0);
          const maas = p.gunlukMaas || 0;
          return [
            tr(p.ad), p.kare,
            tl2(p.nakitTL), tl2(p.ibanTL), tl2(p.krediTL), tl2(p.toplamTL),
            isk > 0 ? tl2(isk) : '—',
            maas > 0 ? tl2(maas) : '—',
            prim > 0 ? tl2(prim) : '—',
            (maas + prim) > 0 ? tl2(maas + prim) : '—',
          ];
        }),
        headStyles: { ...headStyle, fillColor: mor },
        bodyStyles: { ...bodyStyle, fontSize: 6 },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        margin: mx,
        tableWidth: 'auto',
      });
      y = getY() + 5;
    }

    // ═══ YAZICI DETAYI ═══
    if (v.yazicilar.length > 0) {
      y = ensureSpace(18) + 5;
      y = sectionTitle('Yazici Detayi', y);
      autoTable(doc, {
        startY: y,
        head: [[tr('Yazici'), tr('Seri No'), tr('Kagit'), tr('Acilis'), tr('Kapanis'), tr('Baski'), tr('Cikis'), tr('Ribon'), tr('Maliyet')]],
        body: v.yazicilar.map(y2 => [
          tr(y2.ad),
          tr((y2 as any).serialNumber || '—'),
          tr(y2.kagitTipiAdi || '—'),
          y2.baslangic,
          y2.bitis,
          y2.kullanilanBaski,
          `${y2.cikisAdedi} kare`,
          y2.ribonDegisim > 0 ? `${y2.ribonDegisim} tk` : '—',
          (y2.yaziciMaliyet || 0) > 0 ? tl2(y2.yaziciMaliyet || 0) : '—',
        ]),
        headStyles: headStyle,
        bodyStyles: { ...bodyStyle, fontSize: 6 },
        alternateRowStyles: { fillColor: [240, 248, 255] },
        margin: mx,
      });
      y = getY() + 5;
    }

    // ═══ HAKEDİŞ ÖZETİ ═══
    if (v.primBilgi || (v.kotaKademeleri || []).length > 0) {
      y = ensureSpace(18) + 5;
      y = sectionTitle('Hakedis Ozeti', y);
      const kkList = v.kotaKademeleri || [];
      const kotaRows = kkList.map((k: any, i: number) => {
        const reached = v.toplamCiro >= k.hedef;
        return [
          `${i + 1}. Kademe`,
          tl2(k.hedef),
          reached ? tr('Asildi') : tr(`${tl2(k.hedef - v.toplamCiro)} eksik`),
        ];
      });
      if (v.primBilgi) {
        kotaRows.push([{ content: tr('TOPLAM HAKEDIS'), styles: { fontStyle: 'bold' } }, '', { content: tl2(v.primBilgi.toplamPrim), styles: { fontStyle: 'bold' } }]);
      }
      autoTable(doc, {
        startY: y,
        head: [[tr('Kademe'), tr('Hedef'), tr('Durum')]],
        body: kotaRows,
        headStyles: { ...headStyle, fillColor: mor },
        bodyStyles: bodyStyle,
        alternateRowStyles: altRow,
        margin: mx,
      });
    }

    // ═══ FOOTER ═══
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 195, 215);
      doc.line(14, 284, 196, 284);
      doc.setFontSize(6);
      doc.setTextColor(150, 140, 170);
      doc.setFont('helvetica', 'normal');
      doc.text(tr(`${v.mekan}  |  ${formatTarih(v.tarih)}  |  Vardiya Raporu`), 14, 289);
      doc.text(`${i} / ${pageCount}`, 196, 289, { align: 'right' });
    }

    doc.save(`${dosyaAdi}.pdf`);
  }

  function handleYazdir() {
    window.print();
  }

  return (
    <div>
      {/* Geri */}
      <button onClick={onBack} className="flex items-center gap-2 mb-4 text-white/60 hover:text-white/90 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Tüm Vardiyalar</span>
      </button>

      {/* Başlık */}
      <div className="flex items-center gap-3 mb-4">
        <div style={{ fontSize: 32, lineHeight: 1 }}>{v.mekanEmoji}</div>
        <div className="flex-1">
          <p className="text-white font-black" style={{ fontSize: 18 }}>{v.mekan}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{formatTarih(v.tarih)}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{v.acilisSaat} – {v.kapanisSaat}</span>
            {v.printType && (
              <>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(var(--app-accent-rgb),0.15)', color: 'var(--app-accent, #a855f7)', fontWeight: 700 }}>
                  {v.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Anomaliler */}
      {v.anomaliler.length > 0 && (
        <div className="mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>
          {v.anomaliler.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#fb923c' }} />
              <div>
                <p style={{ fontSize: 11, color: '#fb923c', fontWeight: 700 }}>
                  {a.tip === 'stok' ? 'Stok Anomalisi' : 'Yazıcı Anomalisi'}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{a.aciklama}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Vardiya Ciro & Kâr/Zarar ── */}
      {(() => {
        const toplamPrim = v.primBilgi?.toplamPrim || 0;
        const personelMaas = v.personelMaasGideri || 0;
        const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira + personelMaas;
        const brutKar = v.toplamCiro - toplamMaliyet;
        return (
          <div style={{ ...sectionStyle, background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.14)' }}>
            <p style={labelStyle}>
              <TrendingUp style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
              Vardiya Ciro & Kâr/Zarar
            </p>

            {/* Nakit / IBAN / Kredi */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Nakit', val: v.nakitToplamTL, color: '#34d399', Icon: Banknote   },
                { label: 'IBAN',  val: v.ibanToplamTL,  color: '#60a5fa', Icon: Wallet     },
                { label: 'Kredi', val: v.krediToplamTL, color: '#f472b6', Icon: CreditCard },
              ].map(t => (
                <div key={t.label} style={{ background: `${t.color}10`, borderRadius: 12, padding: '10px 12px', border: `1px solid ${t.color}20`, textAlign: 'center' }}>
                  <div className="flex items-center justify-center gap-1 mb-1.5">
                    <t.Icon style={{ width: 10, height: 10, color: t.color }} />
                    <span style={{ fontSize: 9, color: t.color, fontWeight: 700 }}>{t.label}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{tl(t.val)}</p>
                </div>
              ))}
            </div>

            {v.toplamIskonto > 0 && (
              <div className="flex items-center justify-between mb-2" style={{ background: 'rgba(251,146,60,0.06)', borderRadius: 10, padding: '6px 12px', border: '1px solid rgba(251,146,60,0.15)' }}>
                <span style={{ fontSize: 11, color: 'rgba(251,146,60,0.7)', fontWeight: 600 }}>Toplam İskonto</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fb923c' }}>
                  -{tl(v.toplamIskonto)} <span style={{ fontSize: 10, opacity: 0.7 }}>%{v.toplamCiro + v.toplamIskonto > 0 ? Math.round((v.toplamIskonto / (v.toplamCiro + v.toplamIskonto)) * 100) : 0}</span>
                </span>
              </div>
            )}

            <div className="flex items-center justify-between" style={{ background: 'rgba(var(--app-accent-rgb),0.1)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(var(--app-accent-rgb),0.25)' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 800 }}>Toplam Ciro</span>
              <span style={{ fontSize: 19, fontWeight: 900, color: 'var(--app-accent, #a855f7)' }}>{tl(v.toplamCiro)}</span>
            </div>

            {/* ── Maliyet & Kâr/Zarar özeti ── */}
            {toplamMaliyet > 0 && (
              <>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0 10px' }} />
                <div className="space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {v.albumMaliyeti > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Albüm Maliyeti</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>-{tl(v.albumMaliyeti)}</span>
                    </div>
                  )}
                  {v.baskiMaliyeti > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Baskı Maliyeti</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>-{tl(v.baskiMaliyeti)}</span>
                    </div>
                  )}
                  {toplamPrim > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Hakediş Gideri</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-accent, #a855f7)' }}>-{tl(toplamPrim)}</span>
                    </div>
                  )}
                  {personelMaas > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Personel Maaşları</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>-{tl(personelMaas)}</span>
                    </div>
                  )}
                  {v.mekanGunlukKira > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Mekan Kirası (günlük)</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>-{tl(v.mekanGunlukKira)}</span>
                    </div>
                  )}
                </div>

                {/* Toplam Maliyet + Brüt Kâr */}
                <div className="space-y-2 mt-3">
                  <div style={{ background: 'rgba(248,113,113,0.06)', borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>Toplam Maliyet</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171' }}>-{tl(toplamMaliyet)}</span>
                  </div>
                  {v.toplamCiro > 0 && (
                    <div style={{ background: brutKar >= 0 ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)', borderRadius: 10, padding: '8px 14px', border: `1px solid ${brutKar >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>Brüt Kâr</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: brutKar >= 0 ? '#34d399' : '#f87171' }}>{tl(brutKar)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Vardiya Notları ── */}
      {((v as any).acilisNot || (v as any).kapanisNot) && (
        <div style={sectionStyle}>
          <p style={labelStyle}>
            <AlertTriangle style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
            Vardiya Notları
          </p>
          {(v as any).acilisNot && (
            <div className="flex gap-2 mb-2" style={{ background: 'rgba(96,165,250,0.06)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(96,165,250,0.15)' }}>
              <span style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700, flexShrink: 0 }}>Açılış:</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{(v as any).acilisNot}</span>
            </div>
          )}
          {(v as any).kapanisNot && (
            <div className="flex gap-2" style={{ background: 'rgba(var(--app-accent-rgb),0.06)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(var(--app-accent-rgb),0.15)' }}>
              <span style={{ fontSize: 9, color: 'var(--app-accent, #a855f7)', fontWeight: 700, flexShrink: 0 }}>Kapanış:</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{(v as any).kapanisNot}</span>
            </div>
          )}
        </div>
      )}

      {/* ── BLOK 1: Albüm ── */}
      <div style={sectionStyle}>
        <div className="flex items-center justify-between mb-1">
          <p style={labelStyle}>
            <Package style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
            Albüm
          </p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            {v.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
          </p>
        </div>

        {Object.keys(v.albumler).length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(v.albumler).map(([urun, adet]) => (
              <div key={urun} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{urun}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>×{adet}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Albüm satışı yok</p>
        )}

        <div style={{ background: 'rgba(248,113,113,0.06)', borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Albüm Maliyeti</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171' }}>-{tl(v.albumMaliyeti)}</span>
        </div>
      </div>

      {/* ── BLOK 2: Baskı Maliyet (Yazıcı Sayaçları + Baskı özeti) ── */}
      <div style={sectionStyle}>
        <div className="flex items-center justify-between mb-1">
          <p style={labelStyle}>
            <Printer style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
            Baskı Maliyet
          </p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            {v.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
            {v.yazicilar.length > 0 && ` · ${v.yazicilar.length} Yazıcı`}
            {(() => {
              const kagitlar = [...new Set(v.yazicilar.map(y => y.kagitTipiAdi).filter(Boolean))];
              if (kagitlar.length === 0) return '';
              if (kagitlar.length === 1) return ` · ${kagitlar[0]}`;
              return ` · ${kagitlar.length} farklı kağıt (${kagitlar.join(', ')})`;
            })()}
          </p>
        </div>
        {(() => {
          const kullanilanBaskiToplam = v.yazicilar.reduce((s, y) => s + y.kullanilanBaski, 0);
          const cikisAdediToplam = v.yazicilar.reduce((s, y) => s + y.cikisAdedi, 0);
          return (
            <>
              {/* Yazıcı sayaç kartları */}
              {v.yazicilar.length > 0 && (
                <div className="space-y-2 mb-3">
                  {v.yazicilar.map((y, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                            {y.ad} - <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Seri No: {(y as any).serialNumber}</span>
                          </p>
                        </div>
                        {y.kagitTipiAdi && (
                          <span style={{ fontSize: 9, color: '#9dd9ea', background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.25)', borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>
                            🗂️ {y.kagitTipiAdi}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p style={labelStyle}>Açılış Sayacı</p>
                          <p style={{ ...valStyle, fontSize: 13 }}>{y.baslangic.toLocaleString('tr-TR')}</p>
                        </div>
                        <div>
                          <p style={labelStyle}>Kapanış Sayacı</p>
                          <p style={{ ...valStyle, fontSize: 13 }}>{y.bitis.toLocaleString('tr-TR')}</p>
                        </div>
                        <div>
                          <p style={labelStyle}>Ribon Değişimi</p>
                          <p style={{ ...valStyle, fontSize: 13, color: y.ribonDegisim > 0 ? '#fbbf24' : 'rgba(255,255,255,0.55)' }}>
                            {y.ribonDegisim > 0 ? `${y.ribonDegisim} takım` : '—'}
                          </p>
                        </div>
                      </div>
                      {/* Basılan fotoğraf + maliyet — tek kutu */}
                      <div style={{ marginTop: 8, background: 'rgba(157,217,234,0.08)', border: '1px solid rgba(157,217,234,0.18)', borderRadius: 8, padding: '7px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, color: 'rgba(157,217,234,0.7)', fontWeight: 700 }}>Basılan Fotoğraf</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#9dd9ea' }}>{y.cikisAdedi.toLocaleString('tr-TR')} kare</span>
                        </div>
                        {y.yaziciMaliyet != null && y.yaziciMaliyet > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(157,217,234,0.12)' }}>
                            <span style={{ fontSize: 10, color: 'rgba(248,113,113,0.7)' }}>Baskı Maliyeti</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#f87171' }}>-₺{Math.round(y.yaziciMaliyet).toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ayırıcı */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />

              {/* Fotoğraf özet grid: Toplam Basılan | Satılan | İade */}
              {(() => {
                const iadeFotografToplam = v.yazicilar.reduce((s, y) => s + ((y as any).iadeFotograf || 0), 0);
                const satilanFotografToplam = Math.max(0, cikisAdediToplam - iadeFotografToplam);
                const personelKareToplam = v.personeller.reduce((s, p) => s + p.kare, 0);
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div style={{ background: 'rgba(157,217,234,0.07)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(157,217,234,0.15)', textAlign: 'center' }}>
                        <p style={{ ...labelStyle, textAlign: 'center' }}>Toplam Basılan</p>
                        <p style={{ ...valStyle, color: '#9dd9ea', fontSize: 16 }}>{cikisAdediToplam.toLocaleString('tr-TR')}</p>
                        <p style={{ fontSize: 9, color: 'rgba(157,217,234,0.5)', marginTop: 2 }}>kare</p>
                      </div>
                      <div style={{ background: 'rgba(74,222,128,0.07)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(74,222,128,0.15)', textAlign: 'center' }}>
                        <p style={{ ...labelStyle, textAlign: 'center' }}>Satılan</p>
                        <p style={{ ...valStyle, color: '#4ade80', fontSize: 16 }}>{satilanFotografToplam.toLocaleString('tr-TR')}</p>
                        <p style={{ fontSize: 9, color: 'rgba(74,222,128,0.5)', marginTop: 2 }}>kare</p>
                      </div>
                      <div style={{ background: 'rgba(248,113,113,0.07)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(248,113,113,0.15)', textAlign: 'center' }}>
                        <p style={{ ...labelStyle, textAlign: 'center' }}>İade</p>
                        <p style={{ ...valStyle, color: '#f87171', fontSize: 16 }}>{iadeFotografToplam.toLocaleString('tr-TR')}</p>
                        <p style={{ fontSize: 9, color: 'rgba(248,113,113,0.5)', marginTop: 2 }}>kare</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div style={{ background: 'rgba(157,217,234,0.07)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(157,217,234,0.15)', textAlign: 'center' }}>
                        <p style={{ ...labelStyle, textAlign: 'center' }}>Kullanılan Baskı</p>
                        <p style={{ ...valStyle, color: '#9dd9ea', fontSize: 16 }}>{kullanilanBaskiToplam.toLocaleString('tr-TR')}</p>
                        <p style={{ fontSize: 9, color: 'rgba(157,217,234,0.5)', marginTop: 2 }}>tam boy baskı</p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                        <p style={{ ...labelStyle, textAlign: 'center' }}>Kağıt Tipi</p>
                        {(() => {
                          const kagitlar = [...new Set(v.yazicilar.map(y => y.kagitTipiAdi).filter(Boolean))];
                          if (kagitlar.length === 0) return <p style={{ ...valStyle, fontSize: 12 }}>—</p>;
                          if (kagitlar.length === 1) return <p style={{ ...valStyle, fontSize: 12 }}>{kagitlar[0]}</p>;
                          return <p style={{ ...valStyle, fontSize: 12 }}>{kagitlar.length} farklı kağıt</p>;
                        })()}
                      </div>
                      <div style={{ background: 'rgba(167,199,231,0.07)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(167,199,231,0.15)', textAlign: 'center' }}>
                        <p style={{ ...labelStyle, textAlign: 'center' }}>Personel Çekimi</p>
                        <p style={{ ...valStyle, color: '#a7c7e7', fontSize: 16 }}>{personelKareToplam.toLocaleString('tr-TR')}</p>
                        <p style={{ fontSize: 9, color: 'rgba(167,199,231,0.5)', marginTop: 2 }}>kare</p>
                      </div>
                    </div>

                    {/* Toplam baskı maliyeti */}
                    <div style={{ background: 'rgba(248,113,113,0.06)', borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Toplam Baskı Maliyeti</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171' }}>-{tl(v.baskiMaliyeti)}</span>
                    </div>
                  </>
                );
              })()}
            </>
          );
        })()}
      </div>

      {/* ── BLOK 3: Hakediş ── */}
      {(v.personeller.length > 0 || (v.kotaKademeleri || []).length > 0) && (() => {
        const KADEME_COLORS = ['#60a5fa', 'var(--app-accent, #a855f7)', '#fbbf24', '#34d399', '#f87171', '#fb923c'];
        const kkList = v.kotaKademeleri || [];
        const pb = v.primBilgi;
        const hasPrim = !!pb;
        const kisiBasiPrim = pb ? pb.topKademePrim : 0;
        const toplamPrim = pb ? pb.toplamPrim : 0;
        const kotaDurumlari = kkList.map((k: any, i: number) => ({
          index: i, hedef: k.hedef,
          reached: v.toplamCiro >= k.hedef,
          color: KADEME_COLORS[Math.min(i, 5)],
        }));
        const ilkKota = kkList[0];
        const ilkFark = ilkKota ? (ilkKota.hedef - v.toplamCiro) : 0;
        return (
          <div style={{
            ...sectionStyle,
            background: hasPrim ? 'rgba(var(--app-accent-rgb),0.07)' : 'rgba(255,255,255,0.04)',
            border: hasPrim ? '1px solid rgba(var(--app-accent-rgb),0.22)' : '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Başlık */}
            <div className="flex items-center gap-2 mb-3">
              <Trophy style={{ width: 10, height: 10, color: hasPrim ? 'var(--app-accent, #a855f7)' : 'rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: hasPrim ? 'var(--app-accent, #a855f7)' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                Hakediş{hasPrim ? ' — 🏆 Kazanıldı!' : ''}
              </span>
            </div>

            {/* Personel listesi — her zaman */}
            {v.personeller.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 10,
              }}>
                <div className="space-y-2">
                  {v.personeller.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{
                          width: 26, height: 26, borderRadius: 8,
                          background: hasPrim ? 'rgba(var(--app-accent-rgb),0.15)' : 'rgba(255,255,255,0.06)',
                          border: hasPrim ? '1px solid rgba(var(--app-accent-rgb),0.28)' : '1px solid rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                        }}>
                          {p.avatar}
                        </div>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{p.ad}</span>
                      </div>
                      {hasPrim
                        ? <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-accent, #a855f7)' }}>{tl(kisiBasiPrim)}</span>
                        : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>—</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hakediş VAR → kota durumları */}
            {hasPrim && kkList.length > 0 && (
              <div className="space-y-1.5" style={{ marginBottom: 10 }}>
                {kotaDurumlari.map(k => (
                  <div key={k.index} className="flex items-center justify-between">
                    {k.reached ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 13, color: k.color, fontWeight: 900 }}>✓</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{k.index + 1}. Kota Aşıldı</span>
                        </div>
                        <span style={{ fontSize: 10, color: k.color, fontWeight: 700 }}>{tl(k.hedef)}</span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: 900 }}>○</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                            {k.index + 1}. Kotaya {tl(k.hedef - v.toplamCiro)} kaldı
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>{tl(k.hedef)}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Hakediş VAR → toplam */}
            {hasPrim && (
              <div style={{ borderTop: '1px solid rgba(var(--app-accent-rgb),0.15)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Toplam Hakediş</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--app-accent, #a855f7)' }}>{tl(toplamPrim)}</span>
              </div>
            )}

            {/* Hakediş YOK → ilk kotaya kalan */}
            {!hasPrim && ilkKota && ilkFark > 0 && (
              <div className="flex items-center gap-2">
                <Trophy style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  1. Hakediş kotasına {tl(ilkFark)} eksik kaldı
                </span>
              </div>
            )}
          </div>
        );
      })()}


      {/* ── Personel Detayı ── */}
      {v.personeller.length > 0 && (
        <div style={sectionStyle}>
          <p style={labelStyle}>
            <Users style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
            Personel Detayı
          </p>
          <div className="space-y-3">
            {v.personeller.map(p => (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span style={{ fontSize: 22 }}>{p.avatar}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p style={{ ...valStyle, fontSize: 14 }}>{p.ad}</p>
                      {(p as any).gecGiris && (
                        <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 99, fontWeight: 700, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
                          ⚠️ Geç giriş {(p as any).gecGirisDk > 0 ? `${(p as any).gecGirisDk} dk` : ''}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                      {p.kare > 0 ? `${p.kare} kare` : 'Kare kaydı yok'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--app-accent, #a855f7)' }}>{tl(p.toplamTL)}</p>
                    {(() => {
                      const satirToplam = p.satirlar.reduce((s, sr) => s + sr.toplamTL, 0);
                      const iskonto = Math.round(satirToplam - p.toplamTL);
                      const isktPct = satirToplam > 0 ? Math.round((iskonto / satirToplam) * 100) : 0;
                      if (iskonto > 0) {
                        return (
                          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 8, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            İskonto -{tl(iskonto)} <span style={{ opacity: 0.6 }}>%{isktPct}</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Ödeme dağılımı */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Nakit', val: p.nakitTL, color: '#34d399', Icon: Banknote   },
                    { label: 'IBAN',  val: p.ibanTL,  color: '#60a5fa', Icon: Wallet     },
                    { label: 'Kredi', val: p.krediTL, color: '#f472b6', Icon: CreditCard },
                  ].map(od => (
                    <div key={od.label} style={{ background: `${od.color}10`, borderRadius: 10, padding: '8px 10px', border: `1px solid ${od.color}20`, textAlign: 'center' }}>
                      <div className="flex items-center justify-center gap-1 mb-1.5">
                        <od.Icon style={{ width: 10, height: 10, color: od.color }} />
                        <span style={{ fontSize: 9, color: od.color, fontWeight: 700 }}>{od.label}</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{tl(od.val)}</p>
                    </div>
                  ))}
                </div>

                {/* Ürün dökümü */}
                {p.satirlar.length > 0 && (
                  <div>
                    <p style={{ ...labelStyle, marginBottom: 6 }}>Satılan Ürünler</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.satirlar.map((s, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: '3px 9px', borderRadius: 20,
                          background: 'rgba(var(--app-accent-rgb),0.1)', border: '1px solid rgba(var(--app-accent-rgb),0.2)',
                          color: 'rgba(255,255,255,0.65)',
                        }}>
                          {s.urun} ×{s.adet}{s.toplamTL > 0 ? ` · ${tl(s.toplamTL)}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performans kutuları */}
                {(p as any).cekimYuzde != null && (
                  <>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div style={{ background: 'rgba(74,222,128,0.08)', border: `1px solid ${(p as any).cekimYuzde >= 100 ? 'rgba(74,222,128,0.25)' : (p as any).cekimYuzde >= 80 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>📸 ÇEKİM PERFORMANSI</p>
                        <p style={{ fontSize: 16, fontWeight: 900, color: (p as any).cekimYuzde >= 100 ? '#4ade80' : (p as any).cekimYuzde >= 80 ? '#fbbf24' : '#f87171' }}>%{(p as any).cekimYuzde}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>{p.kare} / {(p as any).kisiBasiKota} kare <span style={{ color: 'rgba(255,255,255,0.20)' }}>(kota: {(p as any).toplamKota})</span></p>
                      </div>
                      <div style={{ background: 'rgba(157,217,234,0.08)', border: `1px solid ${(p as any).baskiDonusumYuzde >= 70 ? 'rgba(74,222,128,0.25)' : (p as any).baskiDonusumYuzde >= 50 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>🖨️ BASKI DÖNÜŞÜMÜ</p>
                        <p style={{ fontSize: 16, fontWeight: 900, color: (p as any).baskiDonusumYuzde >= 70 ? '#4ade80' : (p as any).baskiDonusumYuzde >= 50 ? '#fbbf24' : '#f87171' }}>%{(p as any).baskiDonusumYuzde || 0}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>basılan / çekilen</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      <div style={{ background: 'rgba(255,212,163,0.06)', border: '1px solid rgba(255,212,163,0.18)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>👥 SORUMLU MÜŞTERİ</p>
                        <p style={{ fontSize: 16, fontWeight: 900, color: '#ffd4a3' }}>{(p as any).musteriSayisi || 0}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>/ {(p as any).toplamMusteri || 0} toplam</p>
                      </div>
                      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>🎯 KİŞİ BAŞI KOTA</p>
                        <p style={{ fontSize: 16, fontWeight: 900, color: '#60a5fa' }}>{(p as any).kisiBasiKota || 0}</p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>/ {(p as any).toplamKota || 0} toplam kota</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Personel katkı ve kazanç */}
                {(() => {
                  const personelKareToplam = v.personeller.reduce((s, pp) => s + pp.kare, 0);
                  const ciroYuzde = v.toplamCiro > 0 ? (p.toplamTL / v.toplamCiro) * 100 : 0;
                  const kareYuzde = personelKareToplam > 0 ? (p.kare / personelKareToplam) * 100 : 0;
                  const mekanKatkisi = ciroYuzde * 0.60 + kareYuzde * 0.40;
                  const prim = p.hakedisDahil === false ? 0 : (v.primBilgi?.topKademePrim || 0);
                  const maas = p.gunlukMaas || 0;
                  const personelKazanc = maas + prim;
                  return (
                    <>
                      {/* Ayırıcı */}
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />

                      {/* 4 blok: Maaş, Hakediş, Ciro Katkısı, Kare Katkısı */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <div style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <p style={{ fontSize: 8, color: 'rgba(251,146,60,0.7)', fontWeight: 600, marginBottom: 2 }}>GÜNLÜK MAAŞ</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#fb923c' }}>{maas > 0 ? tl(maas) : '—'}</p>
                        </div>
                        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <p style={{ fontSize: 8, color: 'rgba(251,191,36,0.7)', fontWeight: 600, marginBottom: 2 }}>HAKEDİŞ</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24' }}>{prim > 0 ? tl(prim) : '—'}</p>
                        </div>
                        <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <p style={{ fontSize: 8, color: 'rgba(52,211,153,0.7)', fontWeight: 600, marginBottom: 2 }}>CİRO KATKISI</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#34d399' }}>%{ciroYuzde.toFixed(0)}</p>
                        </div>
                        <div style={{ background: 'rgba(157,217,234,0.08)', border: '1px solid rgba(157,217,234,0.2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <p style={{ fontSize: 8, color: 'rgba(157,217,234,0.7)', fontWeight: 600, marginBottom: 2 }}>KARE KATKISI</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#9dd9ea' }}>%{kareYuzde.toFixed(0)}</p>
                        </div>
                      </div>

                      {/* 2 blok: Personel Kazanç, Mekan Katkısı */}
                      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        <div style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Personel Kazanç</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#fb923c' }}>{personelKazanc > 0 ? tl(personelKazanc) : '—'}</span>
                        </div>
                        <div style={{ background: 'rgba(157,217,234,0.05)', border: '1px solid rgba(157,217,234,0.15)', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Mekan Katkısı</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#9dd9ea' }}>%{mekanKatkisi.toFixed(0)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Export Butonları ── */}
      <div style={{ marginTop: 6, marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, textAlign: 'center' }}>
          Dışa Aktar
        </p>
        <div className="grid grid-cols-3 gap-3">
          {/* Yazdır */}
          <button
            onClick={handleYazdir}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <PrinterIcon style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.7)' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Yazdır</span>
          </button>

          {/* Excel */}
          <button
            onClick={handleExcel}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.2)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
              <FileSpreadsheet style={{ width: 18, height: 18, color: '#34d399' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>Excel</span>
          </button>

          {/* PDF */}
          <button
            onClick={handlePDF}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
              <FileText style={{ width: 18, height: 18, color: '#f87171' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>PDF</span>
          </button>
        </div>
      </div>

    </div>
  );
}
