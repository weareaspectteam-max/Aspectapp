import * as XLSX from 'xlsx';
import { formatTarih } from './helpers';

export function handleGunExcel(gunDetay: any, gunSecili: string | null) {
  if (!gunDetay || gunDetay.bos) return;
  const d = gunDetay;
  const oz = d.ozet || {};
  const mal = d.maliyet || {};
  const tarihStr = formatTarih(d.tarih || gunSecili || '');
  const wb = XLSX.utils.book_new();

  // Sheet 1: Günlük Özet
  const brutCiro = (oz.toplamCiro || 0) + (oz.toplamIskonto || 0);
  const iskYuzde = brutCiro > 0 ? Math.round((oz.toplamIskonto / brutCiro) * 100) : 0;
  const nakit = (d.odemeler || []).find((o: any) => o.yontem === 'cash')?.ciro || 0;
  const iban = (d.odemeler || []).find((o: any) => o.yontem === 'iban')?.ciro || 0;
  const kredi = (d.odemeler || []).find((o: any) => o.yontem === 'card')?.ciro || 0;
  const s1 = XLSX.utils.aoa_to_sheet([
    ['GÜNLÜK OPERASYON RAPORU'],
    [], ['Tarih', tarihStr],
    ['Mekan Sayısı', `${oz.toplamMekan || 0} (${oz.acilanMekan || 0} açıldı / ${oz.kapananMekan || 0} kapandı)`],
    [], ['Toplam Ciro', oz.toplamCiro || 0],
    ['Brüt Ciro', brutCiro],
    ['İskonto', `${oz.toplamIskonto || 0} (%${iskYuzde})`],
    [], ['Nakit', nakit], ['IBAN', iban], ['Kredi Kartı', kredi],
    [], ['Toplam Kare', oz.toplamKare || 0],
    ['Basılan Fotoğraf', oz.toplamBasilanFotograf || 0],
    ['Satılan Fotoğraf', oz.toplamSatilanFotograf || 0],
    ['İade', oz.toplamIadeFotograf || 0],
    [], ['Baskı Maliyeti', mal.baskiMaliyeti || 0],
    ['Albüm Maliyeti', mal.albumMaliyeti || 0],
    ['Kira Gideri', mal.kiraGideri || 0],
    ['Maaş Gideri', mal.maasGideri || 0],
    ['Hakediş Gideri', mal.primGideri || 0],
    ['Toplam Maliyet', mal.toplamGider || 0],
    [], ['Kar/Zarar', mal.karZarar || 0],
    ['Kar Marjı', `%${mal.karMarji || 0}`],
  ]);
  XLSX.utils.book_append_sheet(wb, s1, 'Günlük Özet');

  // Sheet 2: Mekan Bazlı
  const mekanRows = (d.mekanlar || []).map((m: any) => {
    const mBrut = (m.ciro || 0) + (m.iskonto || 0);
    const mIskYuzde = mBrut > 0 ? Math.round((m.iskonto / mBrut) * 100) : 0;
    return [m.name, m.acilisSaat || '-', m.kapanisSaat || '-', m.ciro, m.satisAdet, m.iskonto, `%${mIskYuzde}`, m.gunlukKira];
  });
  const s2 = XLSX.utils.aoa_to_sheet([
    ['Mekan', 'Açılış', 'Kapanış', 'Ciro', 'Satış', 'İskonto', 'İsk %', 'Kira'],
    ...mekanRows,
  ]);
  XLSX.utils.book_append_sheet(wb, s2, 'Mekan Bazlı');

  // Sheet 3: Personel (Kazanç = Maaş + Hakediş)
  const perRows = (d.personeller || []).map((p: any) => {
    const kazanc = (p.gunlukMaas || 0) + (p.primToplam || 0);
    return [p.ad, (p.mekanlar || []).join(', '), p.ciro, p.kare, p.gunlukMaas, p.primToplam || 0, kazanc];
  });
  const perTopMaas = (d.personeller || []).reduce((s: number, p: any) => s + (p.gunlukMaas || 0), 0);
  const perTopPrim = (d.personeller || []).reduce((s: number, p: any) => s + (p.primToplam || 0), 0);
  const perTopCiro = (d.personeller || []).reduce((s: number, p: any) => s + (p.ciro || 0), 0);
  const perTopKare = (d.personeller || []).reduce((s: number, p: any) => s + (p.kare || 0), 0);
  const perTopKazanc = perTopMaas + perTopPrim;
  perRows.push(['TOPLAM', '', perTopCiro, perTopKare, perTopMaas, perTopPrim, perTopKazanc]);
  const s3 = XLSX.utils.aoa_to_sheet([
    ['Personel', 'Mekan', 'Ciro', 'Kare', 'Maaş', 'Hakediş', 'Kazanç'],
    ...perRows,
  ]);
  XLSX.utils.book_append_sheet(wb, s3, 'Personel');

  // Sheet 4: Baskı Özeti (mekan bazlı)
  const baskiRows = (d.mekanlar || []).filter((m: any) => (m.basilanFotograf || 0) > 0).map((m: any) => [
    m.name, m.basilanFotograf || 0, m.iadeFotograf || 0, m.netSatilanFotograf || 0, m.birimBaskiMaliyeti || 0, m.baskiMaliyeti || 0,
  ]);
  const bTopBasilan = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.basilanFotograf || 0), 0);
  const bTopIade = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.iadeFotograf || 0), 0);
  const bTopNet = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.netSatilanFotograf || 0), 0);
  const bTopMaliyet = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.baskiMaliyeti || 0), 0);
  baskiRows.push(['TOPLAM', bTopBasilan, bTopIade, bTopNet, '', bTopMaliyet]);
  const s4 = XLSX.utils.aoa_to_sheet([
    ['Mekan', 'Basılan', 'İade', 'Net Satılan', 'Birim Maliyet', 'Toplam Maliyet'],
    ...baskiRows,
  ]);
  XLSX.utils.book_append_sheet(wb, s4, 'Baskı Özeti');

  // Sheet 5: Ürün/Albüm Satışları
  const albumRows = (d.albumler || []).map((a: any) => [a.tip, a.adet, a.ciro]);
  const aTopAdet = (d.albumler || []).reduce((s: number, a: any) => s + (a.adet || 0), 0);
  const aTopCiro = (d.albumler || []).reduce((s: number, a: any) => s + (a.ciro || 0), 0);
  albumRows.push(['TOPLAM', aTopAdet, aTopCiro]);
  const s5 = XLSX.utils.aoa_to_sheet([
    ['Ürün', 'Adet', 'Ciro'],
    ...albumRows,
  ]);
  XLSX.utils.book_append_sheet(wb, s5, 'Ürün Satışları');

  // Sheet 6: Ödeme Dağılımı
  const odemeler = d.odemeler || [];
  const odemeToplam = odemeler.reduce((s: number, o: any) => s + (o.ciro || 0), 0);
  const odemeLabel: Record<string, string> = { cash: 'Nakit', iban: 'IBAN', card: 'Kredi Kartı', foreign: 'Döviz' };
  const odemeRows = odemeler.map((o: any) => {
    const oran = odemeToplam > 0 ? Math.round((o.ciro / odemeToplam) * 1000) / 10 : 0;
    return [odemeLabel[o.yontem] || o.yontem, o.ciro, `%${oran}`];
  });
  odemeRows.push(['TOPLAM', odemeToplam, '%100']);
  const s6 = XLSX.utils.aoa_to_sheet([
    ['Ödeme Yöntemi', 'Tutar', 'Oran'],
    ...odemeRows,
  ]);
  XLSX.utils.book_append_sheet(wb, s6, 'Ödeme Dağılımı');

  // Sheet 7: Anomaliler
  const anomaliler = d.anomaliler || [];
  if (anomaliler.length > 0) {
    const tipLabel = (t: string) => t === 'acilis' ? 'Açılış Stok' : t === 'kapanis' ? 'Kapanış Stok' : 'Yazıcı';
    const anomaliRows = anomaliler.map((a: any) => {
      const detayStr = a.detay ? (typeof a.detay === 'object' ? Object.entries(a.detay).map(([k, v]) => `${k}: ${Number(v) > 0 ? '+' : ''}${v}`).join(', ') : String(a.detay)) : '';
      return [a.mekan, tipLabel(a.tip), detayStr];
    });
    const s7 = XLSX.utils.aoa_to_sheet([['Mekan', 'Tip', 'Detay'], ...anomaliRows]);
    XLSX.utils.book_append_sheet(wb, s7, 'Anomaliler');
  }

  XLSX.writeFile(wb, `Gun_Raporu_${d.tarih || gunSecili || 'rapor'}.xlsx`);
}
