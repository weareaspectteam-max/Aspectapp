import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { tr, formatTarih } from './helpers';

export function handleGunPDF(gunDetay: any, gunSecili: string | null) {
  if (!gunDetay || gunDetay.bos) return;
  const d = gunDetay;
  const oz = d.ozet || {};
  const mal = d.maliyet || {};
  const tarihStr = formatTarih(d.tarih || gunSecili || '');
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
  const sectionTitle = (title: string, yPos: number): number => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...koyu);
    doc.text(tr(title), 14, yPos);
    return yPos + 4;
  };

  // Ödeme verileri
  const nakit = (d.odemeler || []).find((o: any) => o.yontem === 'cash')?.ciro || 0;
  const iban = (d.odemeler || []).find((o: any) => o.yontem === 'iban')?.ciro || 0;
  const kredi = (d.odemeler || []).find((o: any) => o.yontem === 'card')?.ciro || 0;
  const toplamIsk = oz.toplamIskonto || 0;
  const brutCiro = (oz.toplamCiro || 0) + toplamIsk;
  const iskYuzde = brutCiro > 0 ? Math.round((toplamIsk / brutCiro) * 100) : 0;

  // ═══ BAŞLIK BANDI ═══
  doc.setFillColor(...koyu);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(...aksan);
  doc.rect(0, 32, 210, 1, 'F');
  // Başlık
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(tr('Gunluk Operasyon Raporu'), 14, 12);
  // Tarih — büyük ve belirgin
  doc.setFontSize(11);
  doc.setTextColor(...aksan);
  doc.text(tr(tarihStr), 14, 20);
  // Alt bilgi
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 180);
  doc.setFont('helvetica', 'normal');
  doc.text(tr(`${oz.toplamMekan || 0} mekan (${oz.acilanMekan || 0} acilan / ${oz.kapananMekan || 0} kapanan)  |  ${oz.toplamSatisAdet || 0} satis  |  ${oz.toplamKare || 0} kare`), 14, 27);
  // Sağ üst — Toplam Ciro
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(tl2(oz.toplamCiro || 0), 196, 14, { align: 'right' });
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 180);
  doc.text(tr('Toplam Ciro'), 196, 20, { align: 'right' });
  // Brüt kâr sağ alt
  const karZarar = mal.karZarar || 0;
  doc.setFontSize(9);
  doc.setTextColor(...(karZarar >= 0 ? [100, 220, 160] as [number, number, number] : kirmizi));
  doc.setFont('helvetica', 'bold');
  doc.text(tr(`Brut Kar: ${karZarar >= 0 ? '' : '-'}${tl2(Math.abs(karZarar))}`), 196, 27, { align: 'right' });

  let y = 38;

  // ═══ ANOMALİLER ═══
  const anomaliler = d.anomaliler || [];
  if (anomaliler.length > 0) {
    doc.setFillColor(255, 243, 224);
    const anomH = 5 + anomaliler.length * 4;
    doc.roundedRect(14, y, 182, anomH, 1.5, 1.5, 'F');
    doc.setDrawColor(240, 180, 100);
    doc.roundedRect(14, y, 182, anomH, 1.5, 1.5, 'S');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 90, 20);
    anomaliler.forEach((a: any, i: number) => {
      const tipStr = a.tip === 'acilis' ? 'Stok' : a.tip === 'yazici' ? 'Yazici' : 'Stok';
      const aciklama = a.aciklama || '';
      doc.text(tr(`! ${a.mekan} - ${tipStr}: ${aciklama}`).substring(0, 140), 18, y + 4 + i * 4);
    });
    y += anomH + 3;
  }

  // ═══ CİRO & ÖDEME + MALİYET — YAN YANA ═══
  y = sectionTitle('Ciro & Odeme Dagilimi', y);
  const ciroStartY = y;
  autoTable(doc, {
    startY: y,
    head: [[tr('Odeme'), tr('Tutar')]],
    body: [
      [tr('Nakit'), tl2(nakit)],
      [tr('IBAN'), tl2(iban)],
      [tr('Kredi Karti'), tl2(kredi)],
      ...(toplamIsk > 0 ? [[tr(`Iskonto (%${iskYuzde})`), `-${tl2(toplamIsk)}`]] : []),
      [{ content: tr('TOPLAM CIRO'), styles: { fontStyle: 'bold' } }, { content: tl2(oz.toplamCiro || 0), styles: { fontStyle: 'bold' } }],
    ],
    headStyles: headStyle,
    bodyStyles: bodyStyle,
    alternateRowStyles: altRow,
    margin: { left: 14, right: 110 },
  });

  // Maliyet tablosu sağ tarafta
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...koyu);
  doc.text(tr('Maliyet & Kar/Zarar'), 110, ciroStartY - 4);
  const maliyetRows: any[] = [];
  if ((mal.albumMaliyeti || 0) > 0) maliyetRows.push([tr('Album'), `-${tl2(mal.albumMaliyeti)}`]);
  if ((mal.baskiMaliyeti || 0) > 0) maliyetRows.push([tr('Baski'), `-${tl2(mal.baskiMaliyeti)}`]);
  if ((mal.primGideri || 0) > 0) maliyetRows.push([tr('Hakedis'), `-${tl2(mal.primGideri)}`]);
  if ((mal.maasGideri || 0) > 0) maliyetRows.push([tr('Maas'), `-${tl2(mal.maasGideri)}`]);
  if ((mal.kiraGideri || 0) > 0) maliyetRows.push([tr('Kira'), `-${tl2(mal.kiraGideri)}`]);
  maliyetRows.push([{ content: tr('TOPLAM'), styles: { fontStyle: 'bold' } }, { content: `-${tl2(mal.toplamGider || 0)}`, styles: { fontStyle: 'bold', textColor: kirmizi } }]);
  maliyetRows.push([{ content: tr('KAR'), styles: { fontStyle: 'bold' } }, { content: `${karZarar >= 0 ? '' : '-'}${tl2(Math.abs(karZarar))}`, styles: { fontStyle: 'bold', textColor: karZarar >= 0 ? yesil : kirmizi } }]);
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

  // ═══ BASKI ÖZETİ ═══
  if ((oz.toplamBasilanFotograf || 0) > 0) {
    y = ensureSpace(15) + 5;
    y = sectionTitle('Baski Ozeti', y);
    const baskiMekanlar = (d.mekanlar || []).filter((m: any) => (m.basilanFotograf || 0) > 0);
    autoTable(doc, {
      startY: y,
      head: [[tr('Mekan'), tr('Boy'), tr('Basilan'), tr('Satilan'), tr('Iade'), tr('Birim'), tr('Maliyet')]],
      body: [
        ...baskiMekanlar.map((m: any) => [
          tr(m.name),
          tr((m.printType || 'yarim') === 'tam' ? 'Tam' : 'Yarim'),
          m.basilanFotograf || 0,
          m.netSatilanFotograf || 0,
          m.iadeFotograf || 0,
          `${(m.birimBaskiMaliyeti || 0).toFixed(2)} TL`,
          tl2(m.baskiMaliyeti || 0),
        ]),
        [{ content: tr('TOPLAM'), styles: { fontStyle: 'bold' } }, '',
          oz.toplamBasilanFotograf || 0,
          oz.toplamSatilanFotograf || 0,
          oz.toplamIadeFotograf || 0,
          '', { content: tl2(mal.baskiMaliyeti || 0), styles: { fontStyle: 'bold' } }],
      ],
      headStyles: headStyle,
      bodyStyles: { ...bodyStyle, fontSize: 6 },
      alternateRowStyles: { fillColor: [240, 248, 255] },
      margin: mx,
    });
    y = getY() + 5;
  }

  // ═══ ALBÜM DÖKÜMÜ ═══
  if ((d.albumler || []).length > 0) {
    const albumStr = (d.albumler || []).map((a: any) => `${tr(a.tip)} x${a.adet}`).join('  |  ');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 90, 130);
    doc.text(tr(`Album: ${albumStr}  |  Maliyet: -${tl2(mal.albumMaliyeti || 0)}`), 14, y);
    y += 5;
  }

  // ═══ MEKAN SIRALAMASI ═══
  if ((d.mekanlar || []).length > 0) {
    y = ensureSpace(18) + 5;
    y = sectionTitle('Mekan Siralamasi', y);
    autoTable(doc, {
      startY: y,
      head: [[tr('Mekan'), tr('Acilis'), tr('Kapanis'), tr('Ciro'), tr('Satis'), tr('Iskonto'), tr('Kare'), tr('Kira')]],
      body: (d.mekanlar || []).map((m: any) => [
        tr(m.name),
        m.acilisSaat || '-',
        m.kapanisSaat || '-',
        tl2(m.ciro || 0),
        m.satisAdet || 0,
        tl2(m.iskonto || 0),
        m.kare || 0,
        tl2(m.gunlukKira || 0),
      ]),
      headStyles: { ...headStyle, fillColor: mor },
      bodyStyles: { ...bodyStyle, fontSize: 6 },
      alternateRowStyles: altRow,
      margin: mx,
    });
    y = getY() + 5;
  }

  // ═══ PERSONEL DETAYI ═══
  if ((d.personeller || []).length > 0) {
    y = ensureSpace(18) + 5;
    y = sectionTitle('Personel Detayi', y);
    autoTable(doc, {
      startY: y,
      head: [[tr('Ad'), tr('Mekan'), tr('Ciro'), tr('Kare'), tr('Satis'), tr('Maas'), tr('Hakedis'), tr('Kazanc')]],
      body: [
        ...(d.personeller || []).map((p: any) => {
          const kazanc = (p.gunlukMaas || 0) + (p.primToplam || 0);
          return [
            tr(p.ad),
            tr((p.mekanlar || []).join(', ')),
            tl2(p.ciro || 0),
            p.kare || 0,
            p.satisAdet || 0,
            p.gunlukMaas > 0 ? tl2(p.gunlukMaas) : '\u2014',
            p.primToplam > 0 ? tl2(p.primToplam) : '\u2014',
            kazanc > 0 ? tl2(kazanc) : '\u2014',
          ];
        }),
        (() => {
          const tC = (d.personeller || []).reduce((s: number, p: any) => s + (p.ciro || 0), 0);
          const tK = (d.personeller || []).reduce((s: number, p: any) => s + (p.kare || 0), 0);
          const tS = (d.personeller || []).reduce((s: number, p: any) => s + (p.satisAdet || 0), 0);
          const tM = (d.personeller || []).reduce((s: number, p: any) => s + (p.gunlukMaas || 0), 0);
          const tP = (d.personeller || []).reduce((s: number, p: any) => s + (p.primToplam || 0), 0);
          return [{ content: tr('TOPLAM'), styles: { fontStyle: 'bold' } }, '', tl2(tC), tK, tS, tl2(tM), tl2(tP), tl2(tM + tP)];
        })(),
      ],
      headStyles: { ...headStyle, fillColor: mor, fontSize: 6 },
      bodyStyles: { ...bodyStyle, fontSize: 6 },
      alternateRowStyles: { fillColor: [248, 245, 255] },
      margin: mx,
    });
    y = getY() + 5;
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
    doc.text(tr(`Gunluk Rapor  |  ${tarihStr}`), 14, 289);
    doc.text(`${i} / ${pageCount}`, 196, 289, { align: 'right' });
  }

  doc.save(`Gun_Raporu_${d.tarih || gunSecili || 'rapor'}.pdf`);
}
