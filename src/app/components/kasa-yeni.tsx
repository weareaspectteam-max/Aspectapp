import { useState, useEffect, useCallback, useRef } from 'react';
import { projectId } from '../lib/supabase-info';
import { authHeaders, appendGhostParam } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface KasaYeniProps {
  userName: string;
  userRole: string;
  userId: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

const AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const AYLAR_TAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
// İş günü tarih aritmetiği (YYYY-MM-DD) — UTC bazlı, saat kaymasından etkilenmez
const gunEkle = (tarih: string, delta: number) => {
  const [y, m, d] = tarih.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
};
const gunAdi = (tarih: string, bugunTarih: string) => {
  if (!tarih) return '';
  if (tarih === bugunTarih) return 'Bugün';
  if (tarih === gunEkle(bugunTarih, -1)) return 'Dün';
  const [y, m, d] = tarih.split('-').map(Number);
  return `${d} ${AYLAR_TAM[m - 1]}`;
};
const KATEGORILER = [
  { k: 'yakit', l: 'Yakıt' }, { k: 'market', l: 'Market' }, { k: 'malzeme', l: 'Albüm' },
  { k: 'ekipman', l: 'Ekipman' }, { k: 'ribon', l: 'Ribon' }, { k: 'avans', l: 'Avans' },
  { k: 'hakedis', l: 'Hakediş' }, { k: 'kira', l: 'Mekan kirası' }, { k: 'fatura', l: 'Faturalar' },
  { k: 'lojman', l: 'Lojman' }, { k: 'maas', l: 'Maaş' },
  // duzeltme: sayım/bakiye düzeltmesi — kasadan düşer ama İGD kâr/zararına GİRMEZ
  { k: 'duzeltme', l: 'Düzeltme (sayım)' }, { k: 'diger', l: 'Diğer' },
];
// Chip'ler alfabetik (tr sıralama); "Diğer" catch-all olarak en sonda sabit
const KATEGORILER_SIRALI = [...KATEGORILER].sort((a, b) =>
  a.k === 'diger' ? 1 : b.k === 'diger' ? -1 : a.l.localeCompare(b.l, 'tr'));

const fmt = (n: number) => Math.round(n || 0).toLocaleString('tr-TR');
// Türkçe sayı girişi: nokta = BİNLİK ayıracı (kuruş değil). Tam TL girilir.
const parseNum = (s: string) => parseInt(String(s).replace(/\D/g, '') || '0', 10);
const fmtIn = (s: string) => { const d = String(s).replace(/\D/g, ''); return d ? Number(d).toLocaleString('tr-TR') : ''; };

// Ekran klavyesi (numpad): tam TL, binlik ayraçlı biçimli metin döner. Cihaz klavyesi kullanılmaz.
const padApply = (cur: string, k: string) => {
  const d = String(cur).replace(/\D/g, '');
  let nd: string;
  if (k === 'C') nd = '';
  else if (k === '⌫') nd = d.slice(0, -1);
  else { if (d.length >= 9) return cur; nd = d + k; }
  return nd ? Number(nd).toLocaleString('tr-TR') : '';
};
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
function Numpad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="k2pad">
      {PAD_KEYS.map((k) => (
        <button key={k} type="button" className={`pk ${k === 'C' ? 'clr' : k === '⌫' ? 'bsp' : ''}`} onClick={() => onKey(k)}>{k}</button>
      ))}
    </div>
  );
}

const CSS = `
.k2{--bg:#0d0a1a;--bg2:#150f2c;--surface:#191331;--surface2:#140e29;--line:rgba(167,139,250,.15);--line2:rgba(167,139,250,.08);--ink:#f3f0fb;--mut:#a79ecf;--mut2:#6f6796;--brand:#9a7cff;--brand2:#d05fe0;--pos:#39dc98;--posBg:rgba(57,220,152,.13);--neg:#ff6a83;--negBg:rgba(255,106,131,.13);--bank:#6aa0ff;--bankBg:rgba(106,160,255,.14);--amber:#f5b544;--shadow:0 1px 0 rgba(255,255,255,.03),0 26px 48px -28px rgba(0,0,0,.72);--sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  min-height:100vh;color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;line-height:1.45;
  background:radial-gradient(105% 55% at 50% -6%,rgba(154,124,255,.12),transparent 58%),radial-gradient(80% 44% at 100% 2%,rgba(208,95,224,.08),transparent 55%),linear-gradient(180deg,var(--bg2),var(--bg) 42%);background-attachment:fixed;}
.k2 *{box-sizing:border-box}
.k2 .tnum{font-variant-numeric:tabular-nums}
.k2 .cap{font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;font-weight:650;color:var(--mut2)}
.k2 .wrap{display:flex;flex-direction:column;align-items:center;padding:20px 15px 60px;gap:13px}
.k2 .app{width:100%;max-width:412px;display:flex;flex-direction:column;gap:13px}
.k2 .top{display:flex;align-items:center;gap:11px}
.k2 .mark{font-weight:800;font-size:12px;letter-spacing:.34em;text-indent:.34em;background:linear-gradient(90deg,var(--brand),var(--brand2));-webkit-background-clip:text;background-clip:text;color:transparent}
.k2 .who{margin-left:auto;display:flex;align-items:center;gap:9px}
.k2 .who .nm{text-align:right;font-size:12px;line-height:1.2}.k2 .who .nm b{font-weight:650}.k2 .who .nm span{color:var(--mut2);font-size:11px}
.k2 .avatar{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font-weight:700;font-size:12.5px;background:rgba(154,124,255,.14);color:#c9b8ff;border:1px solid var(--line)}
.k2 .titlerow{display:flex;align-items:baseline;gap:10px}
.k2 .titlerow h1{margin:0;font-size:23px;font-weight:750;letter-spacing:-.02em}
.k2 .day{margin-left:auto;font-size:12px;color:var(--mut)}
.k2 .live{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--pos);font-weight:600}
.k2 .live::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--pos);box-shadow:0 0 7px var(--pos)}
.k2 .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}
.k2 .hero{padding:18px 18px 8px}
.k2 .big{font-size:42px;font-weight:800;letter-spacing:-.035em;line-height:1;margin:7px 0 0}
.k2 .big .u{font-size:19px;font-weight:600;color:var(--mut);margin-left:3px}
.k2 .delta{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:650;padding:5px 9px;border-radius:8px;margin-top:9px}
.k2 .delta.pos{color:var(--pos);background:var(--posBg)}.k2 .delta.neg{color:var(--neg);background:var(--negBg)}
.k2 .spark{margin-top:10px;width:100%;height:56px;display:block;overflow:visible}
.k2 .dot{cursor:pointer}
.k2 .metrikbar{display:flex;gap:6px;margin-top:6px}
.k2 .mtab{font-size:11.5px;font-weight:650;padding:5px 12px;border-radius:8px;background:var(--surface2);border:1px solid var(--line);color:var(--mut);cursor:pointer;font-family:inherit}
.k2 .mtab.on{background:rgba(154,124,255,.16);border-color:var(--brand);color:#c9b8ff}
.k2 .months{display:flex;justify-content:space-between;font-size:9.5px;color:var(--mut2);margin-top:1px;padding-bottom:12px;font-weight:600}
.k2 .hr{height:1px;background:var(--line);margin:0 -18px}
.k2 .flow{display:grid;grid-template-columns:1fr 1fr;padding-top:12px}
.k2 .flow .fc{padding:2px 4px 12px}
.k2 .flow .fc+.fc{border-left:1px solid var(--line);padding-left:16px}
.k2 .flow .v{font-size:17px;font-weight:750;margin-top:5px}.k2 .flow .v.pos{color:var(--pos)}.k2 .flow .v.neg{color:var(--neg)}
.k2 .daynav{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 2px 1px}
.k2 .daynav .dnlabel{font-size:12.5px;font-weight:650;color:var(--ink);text-align:center;flex:1;font-variant-numeric:tabular-nums}
.k2 .daynav .dnlabel small{display:block;font-size:10px;font-weight:600;color:var(--mut2);letter-spacing:.04em;margin-top:1px}
.k2 .daynav .dnav{width:30px;height:30px;flex:0 0 auto;border-radius:9px;border:1px solid var(--line);background:var(--surface2);color:var(--mut);font-size:17px;line-height:1;cursor:pointer;display:grid;place-items:center;font-family:inherit;-webkit-tap-highlight-color:transparent}
.k2 .daynav .dnav:disabled{opacity:.28;cursor:default}
.k2 .daynav .dnav:not(:disabled):active{transform:scale(.92)}
.k2 .daynav .dnav:not(:disabled):hover{color:#c9b8ff;border-color:var(--brand)}
.k2 .mevcut{padding:14px 16px 15px;position:relative;overflow:hidden;margin-bottom:11px}
.k2 .mevcut .key{position:absolute;left:0;top:14px;bottom:14px;width:2.5px;border-radius:2px;background:linear-gradient(var(--brand),var(--brand2))}
.k2 .mevcut .lab{font-size:12px;color:var(--mut);font-weight:600;padding-left:9px;display:flex;align-items:center;gap:7px}
.k2 .mevcut .amt{font-size:27px;font-weight:800;letter-spacing:-.025em;margin-top:6px;padding-left:9px}
.k2 .mevcut .amt .u{font-size:14px;color:var(--mut2);font-weight:600}
.k2 .mevcut .sub{font-size:11.5px;color:var(--mut2);margin-top:4px;padding-left:9px;font-variant-numeric:tabular-nums}
.k2 .pots{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.k2 .pot{padding:14px 15px 15px;position:relative;overflow:hidden}
.k2 .pot .key{position:absolute;left:0;top:14px;bottom:14px;width:2.5px;border-radius:2px}
.k2 .pot.nk .key{background:var(--pos)}.k2 .pot.bk .key{background:var(--bank)}
.k2 .pot .lab{font-size:12px;color:var(--mut);font-weight:600;padding-left:9px}
.k2 .pot .amt{font-size:22px;font-weight:750;margin-top:9px;padding-left:9px}.k2 .pot .amt .u{font-size:13px;color:var(--mut2);font-weight:600}
.k2 .pot .sub{font-size:11px;color:var(--mut2);margin-top:3px;padding-left:9px}
.k2 .acts{display:grid;grid-template-columns:1.15fr .85fr;gap:11px}
.k2 .btn{display:flex;align-items:center;justify-content:center;gap:9px;padding:15px;border-radius:13px;font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer;border:1px solid transparent;color:var(--ink)}
.k2 .btn.primary{background:linear-gradient(120deg,var(--brand),var(--brand2));color:#fff;box-shadow:0 8px 20px -10px rgba(154,124,255,.6)}
.k2 .btn.ghost{background:var(--surface2);border-color:var(--line)}
.k2 .btn:active{transform:translateY(1px)}
.k2 .lhead{display:flex;align-items:baseline;justify-content:space-between;margin:8px 3px 1px}
.k2 .lhead h2{margin:0;font-size:13px;font-weight:700}.k2 .lhead .n{font-size:11.5px;color:var(--mut2)}
.k2 .item{display:flex;align-items:center;gap:13px;padding:13px 15px;position:relative}
.k2 .item+.item{border-top:1px solid var(--line2)}
.k2 .item .k{position:absolute;left:0;top:12px;bottom:12px;width:2.5px;border-radius:2px}
.k2 .item.in .k{background:var(--pos)}.k2 .item.out .k{background:var(--neg)}
.k2 .item .body{min-width:0;flex:1}
.k2 .item .t{font-size:14px;font-weight:650;display:flex;align-items:center;gap:8px}
.k2 .vtag{font-size:10px;font-weight:700;color:var(--bank);background:var(--bankBg);padding:1px 7px;border-radius:5px}
.k2 .item .m{font-size:11.5px;color:var(--mut2);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.k2 .item .m .mono{font-family:var(--mono);font-size:11px}
.k2 .amt2{font-size:15px;font-weight:750;text-align:right;white-space:nowrap}.k2 .amt2.pos{color:var(--pos)}.k2 .amt2.neg{color:var(--neg)}
.k2 .potpill{font-size:10px;padding:2px 7px;border-radius:5px;font-weight:600;border:1px solid var(--line)}
.k2 .potpill.nk{color:var(--pos)}.k2 .potpill.bk{color:var(--bank)}
.k2 .geri{font-size:10.5px;color:var(--mut2);border:1px solid var(--line);background:transparent;border-radius:7px;padding:4px 8px;cursor:pointer;font-family:inherit;margin-left:8px}
.k2 .geri:hover{color:var(--neg);border-color:var(--neg)}
.k2 .empty{text-align:center;color:var(--mut2);font-size:12.5px;padding:26px 10px}
/* setup */
.k2 .setup{padding:22px 20px;display:flex;flex-direction:column;gap:16px}
.k2 .setup h2{margin:0;font-size:19px;font-weight:750}
.k2 .setup p{margin:0;font-size:13px;color:var(--mut);line-height:1.5}
.k2 .in{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:13px 15px;color:var(--ink);font-family:inherit;font-size:18px;font-weight:700}
.k2 .in::placeholder{color:var(--mut2);font-weight:400}
.k2 .in:focus{outline:none;border-color:var(--brand)}
.k2 .totalbox{display:flex;justify-content:space-between;align-items:baseline;padding:12px 15px;background:rgba(154,124,255,.08);border-radius:12px}
/* numpad + tutar kutusu (cihaz klavyesi yok) */
.k2sheet .amt{display:flex;align-items:center;justify-content:flex-end;gap:8px;width:100%;min-height:54px;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:12px 15px;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;transition:border-color .15s,box-shadow .15s}
.k2sheet .amt.on{border-color:var(--brand);box-shadow:0 0 0 3px rgba(154,124,255,.13)}
.k2sheet .amt .lab{margin-right:auto;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;font-weight:650;color:var(--mut2)}
.k2sheet .amt .val{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ink);line-height:1}
.k2sheet .amt .val.z{color:var(--mut2)}
.k2sheet .amt .cur{font-size:15px;font-weight:700;color:var(--mut2)}
.k2sheet .amtrow{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.k2sheet .amtrow .amt{padding:10px 12px;flex-wrap:wrap}
.k2sheet .amtrow .amt .val{font-size:21px}
.k2 .k2pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:9px}
.k2 .k2pad .pk{padding:14px 0;border-radius:12px;border:1px solid var(--line);background:var(--surface2);color:var(--ink);font-family:inherit;font-size:20px;font-weight:750;cursor:pointer;font-variant-numeric:tabular-nums;-webkit-tap-highlight-color:transparent;transition:transform .06s ease,background .15s}
.k2 .k2pad .pk:active{transform:scale(.95);background:rgba(154,124,255,.15)}
.k2 .k2pad .pk.clr{color:var(--neg);font-size:17px}
.k2 .k2pad .pk.bsp{color:var(--amber);font-size:18px}
/* aya tıklayınca açılan kırılım (HERO içi) */
.k2 .aydetay{margin-top:12px;background:var(--surface2);border:1px solid var(--line2);border-radius:12px;padding:10px 12px;max-height:240px;overflow-y:auto}
.k2 .aydetay .adh{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;font-weight:650;color:var(--mut2);margin-bottom:6px}
.k2 .aydetay .adrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line2)}
.k2 .aydetay .adrow:first-of-type{border-top:none}
.k2 .aydetay .adk{display:flex;flex-direction:column;min-width:0;gap:1px}
.k2 .aydetay .adk b{font-size:13px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k2 .aydetay .adsub{font-size:10.5px;color:var(--mut2);font-variant-numeric:tabular-nums}
.k2 .aydetay .adv{font-size:13.5px;font-weight:750;font-variant-numeric:tabular-nums;white-space:nowrap}
.k2 .aydetay .adv.pos{color:var(--pos)}.k2 .aydetay .adv.neg{color:var(--neg)}
.k2 .aydetay .adbos{font-size:12px;color:var(--mut2);padding:6px 2px}
.k2 .aydetay .adkar{display:flex;flex-direction:column;gap:7px}
.k2 .aydetay .adkar>div{display:flex;justify-content:space-between;align-items:baseline}
.k2 .aydetay .adkar span{font-size:12px;color:var(--mut)}
.k2 .aydetay .adkar b{font-size:14.5px;font-weight:750;font-variant-numeric:tabular-nums}
.k2 .aydetay .adkar b.pos{color:var(--pos)}.k2 .aydetay .adkar b.neg{color:var(--neg)}
/* modal */
.k2mod{position:fixed;inset:0;background:rgba(6,4,14,.6);display:flex;align-items:flex-end;justify-content:center;z-index:60;padding:12px}
.k2sheet{width:100%;max-width:412px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:18px 18px 20px;box-shadow:0 -14px 48px rgba(0,0,0,.5)}
.k2sheet .sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}
.k2sheet h3{margin:0;font-size:17px;font-weight:750}
.k2sheet .close{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--surface2);color:var(--mut);cursor:pointer;font-size:16px}
.k2sheet .fld{margin-bottom:14px}
.k2sheet .fld>.cap{display:block;margin-bottom:8px}
.k2sheet .chips{display:flex;flex-wrap:wrap;gap:7px}
.k2sheet .ch{font-size:12.5px;padding:8px 13px;border-radius:9px;background:var(--surface2);border:1px solid var(--line);color:var(--mut);cursor:pointer;font-family:inherit}
.k2sheet .ch.on{background:rgba(154,124,255,.16);border-color:var(--brand);color:#c9b8ff;font-weight:600}
.k2sheet .seg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}
.k2sheet .s{text-align:center;font-size:13px;font-weight:600;padding:11px 6px;border-radius:9px;background:var(--surface2);border:1px solid var(--line);color:var(--mut);cursor:pointer;font-family:inherit}
.k2sheet .s.on{background:var(--bankBg);border-color:var(--bank);color:var(--bank)}
.k2sheet .split{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}
.k2sheet .save{width:100%;margin-top:6px;padding:14px;border-radius:13px;border:none;cursor:pointer;font-family:inherit;font-size:14.5px;font-weight:750;color:#fff;background:linear-gradient(120deg,var(--brand),var(--brand2))}
.k2sheet .save:disabled{opacity:.5}
.k2 .err{background:var(--negBg);border:1px solid rgba(255,106,131,.3);color:var(--neg);padding:12px 15px;border-radius:12px;font-size:12.5px}
.k2 .subacts{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.k2 .subbtn{display:flex;align-items:center;justify-content:center;gap:7px;padding:12px;border-radius:12px;font-family:inherit;font-size:12.5px;font-weight:650;cursor:pointer;background:var(--surface2);border:1px solid var(--line);color:var(--mut)}
.k2 .subbtn:hover{filter:brightness(1.12)}
.k2 .subbtn.yon{color:#c9b8ff;border-color:rgba(154,124,255,.35);background:rgba(154,124,255,.08)}
.k2 .partner{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--line2)}
.k2 .pa{width:34px;height:34px;border-radius:10px;flex:0 0 auto;display:grid;place-items:center;font-weight:700;font-size:12px;background:rgba(154,124,255,.14);color:#c9b8ff;border:1px solid var(--line)}
.k2 .pct{font-size:10px;font-weight:700;color:#c9b8ff;background:rgba(154,124,255,.14);border:1px solid var(--line);padding:1px 6px;border-radius:5px}
.k2 .ode{margin-left:8px;font-family:inherit;font-size:12px;font-weight:700;padding:7px 14px;border-radius:9px;cursor:pointer;color:#fff;border:none;background:linear-gradient(120deg,var(--brand),var(--brand2))}
.k2 .ode:hover{filter:brightness(1.08)}
`;

function buildSpark(aylar: any[], key: string) {
  const W = 380, H = 56, padX = 14;
  const xFor = (i: number) => padX + (i * (W - 2 * padX)) / 11;
  const elapsed = aylar.map((a, i) => ({ i, v: a[key] })).filter((p) => p.v !== null && p.v !== undefined);
  if (elapsed.length === 0) return null;
  const vals = elapsed.map((p) => p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const yFor = (v: number) => (H - 8) - ((v - min) / (max - min)) * (H - 16);
  const pts = elapsed.map((p) => ({ i: p.i, x: xFor(p.i), y: yFor(p.v), v: p.v }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const first = pts[0];
  const area = `${line} L${last.x.toFixed(1)},${H} L${first.x.toFixed(1)},${H} Z`;
  return { line, area, endX: last.x, endY: last.y, dashX2: xFor(11), points: pts };
}

export function KasaYeni({ userName, userRole, userId, onNavigate }: KasaYeniProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isYonetici = userRole === 'yonetici';
  const [selAy, setSelAy] = useState<number | null>(null);
  const [metrik, setMetrik] = useState<'ciro' | 'gider' | 'kar'>('ciro');
  const [selGun, setSelGun] = useState<string | null>(null); // null = bugün (canlı takip); tarih = geçmiş gün
  const [gecmisGunSayisi, setGecmisGunSayisi] = useState(1); // İşlem geçmişinde açık gün sayısı (+1 gün ile artar)
  const selGunRef = useRef<string | null>(null);
  selGunRef.current = selGun;

  // setup form
  const [suNakit, setSuNakit] = useState('');
  const [suBanka, setSuBanka] = useState('');
  const [saving, setSaving] = useState(false);

  // gider modal
  const [showGider, setShowGider] = useState(false);
  const [gTutar, setGTutar] = useState('');
  const [gKat, setGKat] = useState('yakit');
  const [gOdeme, setGOdeme] = useState<'nakit' | 'banka' | 'karisik'>('nakit');
  const [gNakit, setGNakit] = useState('');
  const [gBanka, setGBanka] = useState('');
  const [gNot, setGNot] = useState('');
  const [gPersonel, setGPersonel] = useState<{ id: string; isim: string } | null>(null);
  const [gMekan, setGMekan] = useState<{ id: string; isim: string } | null>(null);
  const [gField, setGField] = useState<'tutar' | 'nakit' | 'banka'>('tutar'); // numpad hedefi

  // gelir modal
  const [showGelir, setShowGelir] = useState(false);
  const [glTutar, setGlTutar] = useState('');
  const [glPot, setGlPot] = useState<'nakit' | 'banka'>('nakit');
  const [glNot, setGlNot] = useState('');

  // ortaklar panel
  const [showOrtak, setShowOrtak] = useState(false);
  const [ortakData, setOrtakData] = useState<any>(null);
  const [payTutar, setPayTutar] = useState('');
  const [payPot, setPayPot] = useState<'nakit' | 'banka'>('banka');
  // Dağıtım önizlemesi (backend'den gelir): borçlunun payı borca mahsup, satır satır döküm
  const [payPlan, setPayPlan] = useState<any>(null);
  const [ohOrtak, setOhOrtak] = useState('');
  const [ohYon, setOhYon] = useState<'cikis' | 'giris'>('cikis');
  const [ohTutar, setOhTutar] = useState('');
  const [ohPot, setOhPot] = useState<'nakit' | 'banka'>('banka');
  const [ohKasa, setOhKasa] = useState(true); // kasaya yansıt (varsayılan açık); kapalı = geçmiş, kasayı etkilemez
  // borç/alacak panel
  const [showBorc, setShowBorc] = useState(false);
  const [borcData, setBorcData] = useState<any>(null);
  const [bKisi, setBKisi] = useState('');
  const [bYon, setBYon] = useState<'alacak' | 'verecek'>('alacak');
  const [bTutar, setBTutar] = useState('');
  const [bAciklama, setBAciklama] = useState('');
  const [odemeFor, setOdemeFor] = useState<any>(null);
  const [odemeTutar, setOdemeTutar] = useState('');
  const [odemePot, setOdemePot] = useState<'nakit' | 'banka'>('nakit');
  // ödemeler (maaş/kira) panel
  const [showOdeme, setShowOdeme] = useState(false);
  const [odemeData, setOdemeData] = useState<any>(null);
  const [odemeItem, setOdemeItem] = useState<any>(null);
  const [odemeItemPot, setOdemeItemPot] = useState<'nakit' | 'banka'>('banka');
  const [odemeTutarStr, setOdemeTutarStr] = useState(''); // ödemeden önce düzenlenebilir tutar (kesinti/fazla)
  // görünürlük (kimler görebilir)
  const [showGorunur, setShowGorunur] = useState(false);
  const [gorunurList, setGorunurList] = useState<any[] | null>(null);
  const [gorunurSet, setGorunurSet] = useState<Set<string>>(new Set());
  const [ortakSet, setOrtakSet] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const hdrs = await authHeaders();
      const q = selGunRef.current ? `?gun=${selGunRef.current}` : '';
      const res = await fetch(appendGhostParam(`${API_BASE}/kasa2${q}`), { headers: hdrs });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) { setError(e.message || 'Veri alınamadı'); }
    finally { if (!opts?.silent) setLoading(false); }
  }, []);

  // Gün değişince (sol/sağ ok) yeniden çek
  useEffect(() => { fetchData(); }, [fetchData, selGun]);

  // Otomatik tazeleme: bugünü izlerken (canlı satış) + sabah 7'de iş günü dönünce ekran kendiliğinden sıfırlanır
  const fetchRef = useRef(fetchData);
  fetchRef.current = fetchData;
  const busyRef = useRef(false);
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (selGunRef.current) return;   // geçmiş gün görünümü sabit kalsın
      if (busyRef.current) return;     // modal/işlem açıkken dokunma
      fetchRef.current({ silent: true });
    };
    const id = setInterval(tick, 45000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);

  // Sol/sağ ok: bir gün geri / ileri (bugüne dönünce null = canlı takip)
  const stepGun = (delta: number) => {
    if (!data) return;
    const cur = data.gun || data.bugunTarih;
    if (!cur) return;
    const nx = gunEkle(cur, delta);
    if (delta > 0) { setSelGun(nx >= data.bugunTarih ? null : nx); return; }
    if (data.milat && nx < data.milat) return;
    setSelGun(nx);
  };

  const kurKasa = async () => {
    setSaving(true);
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/kasa2/acilis`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ nakit: parseNum(suNakit), banka: parseNum(suBanka) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Hata'); }
      await fetchData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  // numpad → aktif tutar alanına yaz (tek tutar veya karışık nakit/banka)
  const giderKey = (k: string) => {
    const setter = gField === 'nakit' ? setGNakit : gField === 'banka' ? setGBanka : setGTutar;
    setter((prev) => padApply(prev, k));
  };

  const kaydetGider = async () => {
    setSaving(true);
    try {
      const odeme = gOdeme === 'karisik'
        ? { tip: 'karisik', nakit: parseNum(gNakit), banka: parseNum(gBanka) }
        : { tip: gOdeme };
      const tutar = gOdeme === 'karisik' ? undefined : parseNum(gTutar);
      const res = await fetch(appendGhostParam(`${API_BASE}/kasa2/gider`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({
          tutar, kategori: gKat, aciklama: gNot, odeme,
          ...(gKat === 'avans' && gPersonel ? { personelId: gPersonel.id, personelAdi: gPersonel.isim } : {}),
          ...(gKat === 'kira' && gMekan ? { mekanId: gMekan.id, mekanAdi: gMekan.isim } : {}),
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Hata'); }
      setShowGider(false); setGTutar(''); setGNakit(''); setGBanka(''); setGNot(''); setGOdeme('nakit'); setGKat('yakit'); setGPersonel(null); setGMekan(null); setGField('tutar');
      await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const kaydetGelir = async () => {
    setSaving(true);
    try {
      const res = await fetch(appendGhostParam(`${API_BASE}/kasa2/gelir`), {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ tutar: parseNum(glTutar), pot: glPot, aciklama: glNot }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Hata'); }
      setShowGelir(false); setGlTutar(''); setGlNot(''); setGlPot('nakit');
      await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const geriAl = async (id: string) => {
    if (!confirm('Bu hareketi geri almak istiyor musun?')) return;
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa2/geri-al`), {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ id }),
      });
      await fetchData();
    } catch {}
  };

  // ── Ortaklar ──
  const reloadOrtak = async () => { try { const r = await fetch(appendGhostParam(`${API_BASE}/kasa2/ortaklar`), { headers: await authHeaders() }); if (r.ok) setOrtakData(await r.json()); } catch {} };
  const openOrtak = async () => { setShowOrtak(true); setOrtakData(null); setPayPlan(null); await reloadOrtak(); };
  // 1. adım: backend'den dağıtım planını al (hiçbir şey yazılmaz) → döküm göster
  const payOnizle = async () => {
    const t = parseNum(payTutar); if (t <= 0) return;
    setSaving(true);
    try {
      const r = await fetch(appendGhostParam(`${API_BASE}/kasa2/pay-dagit`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ toplam: t, pot: payPot, onizle: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Hata');
      setPayPlan(d);
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  // 2. adım: kullanıcı dökümü gördü, onayladı → gerçek dağıtım
  const payDagit = async () => {
    const t = parseNum(payTutar); if (t <= 0 || !payPlan) return;
    setSaving(true);
    try {
      const r = await fetch(appendGhostParam(`${API_BASE}/kasa2/pay-dagit`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ toplam: t, pot: payPot }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Hata'); }
      setPayTutar(''); setPayPlan(null); await reloadOrtak(); await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  const ortakHareket = async () => {
    const t = parseNum(ohTutar); if (!ohOrtak || t <= 0) return;
    setSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa2/ortak-hareket`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ ortak_id: ohOrtak, yon: ohYon, tutar: t, pot: ohPot, kasaEtkile: ohKasa }) });
      setOhTutar(''); setOhOrtak(''); setOhKasa(true); await reloadOrtak(); await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  const ortakSifirla = async () => {
    if (!confirm('Tüm ortak hareketlerini (pay dağıtımı + çekim/koyma) sıfırlamak istiyor musun? Kasadan çıkan paralar bakiyeye geri döner. Geri alınamaz.')) return;
    setSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa2/ortak-sifirla`), { method: 'POST', headers: await authHeaders() });
      await reloadOrtak(); await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  const ortakGeriAl = async (id: string) => {
    if (!confirm('Bu ortak işlemini geri almak istiyor musun?')) return;
    setSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa2/geri-al`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ id }) });
      await reloadOrtak(); await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  // ── Borç / Alacak ──
  const reloadBorc = async () => { try { const r = await fetch(appendGhostParam(`${API_BASE}/kasa2/borclar`), { headers: await authHeaders() }); if (r.ok) setBorcData(await r.json()); } catch {} };
  const openBorc = async () => { setShowBorc(true); setBorcData(null); await reloadBorc(); };
  const borcEkle = async () => {
    const t = parseNum(bTutar); if (!bKisi || t <= 0) return;
    setSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa2/borclar`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ kisi: bKisi, yon: bYon, tutar: t, aciklama: bAciklama }) });
      setBKisi(''); setBTutar(''); setBAciklama(''); await reloadBorc();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  const borcOdeme = async () => {
    if (!odemeFor) return; const t = parseNum(odemeTutar); if (t <= 0) return;
    setSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa2/borclar/${odemeFor.id}/odeme`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ tutar: t, pot: odemePot }) });
      setOdemeFor(null); setOdemeTutar(''); await reloadBorc(); await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  const borcSil = async (id: string) => {
    if (!confirm('Bu kaydı silmek istiyor musun?')) return;
    try { await fetch(appendGhostParam(`${API_BASE}/kasa2/borclar/${id}`), { method: 'DELETE', headers: await authHeaders() }); await reloadBorc(); } catch {}
  };

  // ── Ödemeler (maaş/kira) ──
  const reloadOdeme = async () => { try { const r = await fetch(appendGhostParam(`${API_BASE}/kasa2/odemeler`), { headers: await authHeaders() }); if (r.ok) setOdemeData(await r.json()); } catch {} };
  const openOdeme = async () => { setShowOdeme(true); setOdemeData(null); await reloadOdeme(); };
  const odemeYap = async () => {
    if (!odemeItem) return;
    setSaving(true);
    try {
      const r = await fetch(appendGhostParam(`${API_BASE}/kasa2/odeme-yap`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ key: odemeItem.key, tutar: parseNum(odemeTutarStr), pot: odemeItemPot, baslik: odemeItem.baslik, tip: odemeItem.tip, keys: odemeItem.keys }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Hata'); }
      setOdemeItem(null); await reloadOdeme(); await fetchData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };
  // Hakediş sil (iptal) — kota kalemlerini prim_silindi_ işaretler; Hakediş Takip'le senkron, kasadan düşmez
  const hakedisSil = async (it: any) => {
    const keys = (it.keys || []).map((k: any) => k.key).filter(Boolean);
    if (!keys.length) return;
    if (!confirm(`${it.personelAdi || it.baslik} için bekleyen ${fmt(it.tutar)} ₺ hakediş silinsin mi? Bu hakediş ödenmeyecek (Hakediş Takip'ten geri alınabilir).`)) return;
    setSaving(true);
    try {
      const r = await fetch(appendGhostParam(`${API_BASE}/primler/sil`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ odemeKeys: keys }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Hata'); }
      await reloadOdeme();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  // ── Görünürlük ──
  const openGorunur = async () => {
    setShowGorunur(true); setGorunurList(null);
    try {
      const r = await fetch(appendGhostParam(`${API_BASE}/kasa2/gorunurluk`), { headers: await authHeaders() });
      if (r.ok) { const d = await r.json(); const ku = d.kullanicilar || []; setGorunurList(ku); setGorunurSet(new Set(ku.filter((u: any) => u.izinli).map((u: any) => u.id))); setOrtakSet(new Set(ku.filter((u: any) => u.ortakIzinli).map((u: any) => u.id))); }
      else setGorunurList([]);
    } catch { setGorunurList([]); }
  };
  const toggleGorunur = (id: string) => { setGorunurSet(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const toggleOrtak = (id: string) => { setOrtakSet(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const saveGorunur = async () => {
    setSaving(true);
    try {
      await fetch(appendGhostParam(`${API_BASE}/kasa2/gorunurluk`), { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ gorunur: Array.from(gorunurSet), ortakGorunur: Array.from(ortakSet) }) });
      setShowGorunur(false);
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  // Otomatik tazeleme sırasında modal/işlem açıksa dokunma
  busyRef.current = showGider || showGelir || showOrtak || showBorc || showOdeme || !!odemeFor || !!odemeItem || showGorunur || saving;

  if (loading && !data) return (<div className="k2"><style>{CSS}</style><div className="wrap"><div className="empty" style={{ paddingTop: 80 }}>Yükleniyor…</div></div></div>);

  // ── Setup screen (kasa kurulmadı) ──
  if (data?.kurulmadi) {
    const toplam = parseNum(suNakit) + parseNum(suBanka);
    return (
      <div className="k2"><style>{CSS}</style>
        <div className="wrap"><div className="app">
          <div className="top"><span className="mark">ASPECT</span>
            <div className="who"><div className="nm"><b>{userName}</b><br /><span>Yönetici</span></div></div>
          </div>
          <div className="titlerow"><h1>Kasa</h1></div>
          {error && <div className="err">{error}</div>}
          <div className="card setup">
            <h2>Kasayı kur</h2>
            <p>Bugün itibarıyla elindeki gerçek parayı bir kez gir. Buradan temiz devam edeceğiz — bir daha sorulmaz.</p>
            <div>
              <span className="cap" style={{ display: 'block', marginBottom: 7 }}>💵 Nakit Kasa (cepteki)</span>
              <input className="in tnum" inputMode="numeric" placeholder="0" value={suNakit} onChange={(e) => setSuNakit(fmtIn(e.target.value))} />
            </div>
            <div>
              <span className="cap" style={{ display: 'block', marginBottom: 7 }}>🏦 Banka (kart/İban)</span>
              <input className="in tnum" inputMode="numeric" placeholder="0" value={suBanka} onChange={(e) => setSuBanka(fmtIn(e.target.value))} />
            </div>
            <div className="totalbox"><span className="cap">Toplam açılış</span><span className="tnum" style={{ fontSize: 20, fontWeight: 750 }}>{fmt(toplam)} ₺</span></div>
            <button className="save" disabled={saving || toplam <= 0} onClick={kurKasa} style={{ marginTop: 0 }}>{saving ? 'Kuruluyor…' : 'Kasayı kur ve başla'}</button>
          </div>
        </div></div>
      </div>
    );
  }

  if (error && !data) return (<div className="k2"><style>{CSS}</style><div className="wrap"><div className="app"><div className="err">{error}</div></div></div></div>);
  if (!data) return null;

  const bak = data.bakiye || { toplam: 0, nakit: 0, banka: 0 };
  const bugun = data.bugun || { giren: 0, cikan: 0 };
  const net = bugun.giren - bugun.cikan;
  const bugunTarih: string = data.bugunTarih || '';
  const aktifGun: string = data.gun || bugunTarih;
  const gunBugun = aktifGun === bugunTarih;              // bugünü mü izliyoruz
  const gunEtiket = gunAdi(aktifGun, bugunTarih);        // "Bugün" / "Dün" / "7 Temmuz"
  const sp = buildSpark(data.yillik?.aylar || [], metrik);
  const pointByI: Record<number, any> = {};
  if (sp) sp.points.forEach((p: any) => { pointByI[p.i] = p; });
  const sparkColor = metrik === 'gider' ? 'var(--neg)' : metrik === 'kar' ? 'var(--pos)' : 'var(--brand)';
  const metrikAd = metrik === 'gider' ? 'gider' : metrik === 'kar' ? 'kâr' : 'ciro';
  const nowAy = new Date().getMonth(); // 0-index; vurgulanacak ay
  const hareketler = data.hareketler || [];

  return (
    <div className="k2"><style>{CSS}</style>
      <div className="wrap"><div className="app">

        <div className="top"><span className="mark">ASPECT</span>
          <div className="who"><div className="nm"><b>{userName}</b><br /><span>Yönetici</span></div>
            <div className="avatar">{(userName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>

        <div className="titlerow"><h1>Kasa</h1><span className="day"><span className="live">canlı</span></span></div>

        {/* HERO */}
        <div className="card hero">
          <span className="cap">Elimde toplam</span>
          <div className="big tnum">{fmt(bak.toplam)}<span className="u">₺</span></div>
          <span className={`delta ${net >= 0 ? 'pos' : 'neg'}`}>{net >= 0 ? '▲' : '▼'} {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))} ₺ · {gunBugun ? 'bugün' : gunEtiket}</span>

          <div className="metrikbar">
            {([['ciro', 'Gelir'], ['gider', 'Gider'], ['kar', 'Kâr']] as const).map(([k, l]) => (
              <button key={k} className={`mtab ${metrik === k ? 'on' : ''}`} onClick={() => { setMetrik(k); setSelAy(null); }}>{l}</button>
            ))}
          </div>
          {sp ? (<>
            <div className="months">
              <span style={{ color: sparkColor, fontWeight: selAy != null ? 700 : 600 }}>
                {selAy != null && pointByI[selAy] ? `${AYLAR_KISA[selAy]} · ${fmt(pointByI[selAy].v)} ₺` : <span style={{ color: 'var(--mut)' }}>{data.yillik?.yil} · aylık {metrikAd}</span>}
              </span>
              <span>Ocak → Aralık</span>
            </div>
            <svg className="spark" viewBox="0 0 380 56" preserveAspectRatio="none">
              <defs><linearGradient id="k2sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sparkColor} stopOpacity=".26" /><stop offset="1" stopColor={sparkColor} stopOpacity="0" /></linearGradient></defs>
              <path d={sp.area} fill="url(#k2sg)" />
              <path d={sp.line} fill="none" stroke={sparkColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {sp.dashX2 > sp.endX && <path d={`M${sp.endX.toFixed(1)},${sp.endY.toFixed(1)} L${sp.dashX2.toFixed(1)},${sp.endY.toFixed(1)}`} stroke="var(--mut2)" strokeWidth="1.2" strokeDasharray="2 4" opacity=".45" fill="none" />}
              {sp.points.map((p: any) => (
                <g key={p.i} className="dot" onClick={() => setSelAy(selAy === p.i ? null : p.i)}>
                  <circle cx={p.x} cy={p.y} r="9" fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={selAy === p.i ? 4.4 : 2.7} fill={selAy === p.i ? '#fff' : sparkColor} stroke={sparkColor} strokeWidth={selAy === p.i ? 2 : 0} />
                </g>
              ))}
            </svg>
            <div className="months tnum">{AYLAR_KISA.map((a, i) => (
              <span key={a} onClick={() => { if (pointByI[i]) setSelAy(selAy === i ? null : i); }}
                style={{ color: selAy === i ? sparkColor : (selAy == null && i === nowAy) ? 'var(--brand)' : undefined, opacity: i > nowAy && selAy !== i ? .45 : 1, cursor: pointByI[i] ? 'pointer' : 'default', fontWeight: selAy === i ? 700 : 600 }}>{a}</span>
            ))}</div>
          </>) : (<div className="empty" style={{ padding: '18px 10px' }}>Bu yıl için {metrikAd} verisi yok.</div>)}

          {selAy != null && data.yillik?.detay?.[selAy] && (() => {
            const d = data.yillik.detay[selAy];
            const gelirTop = (d.gelir || []).reduce((s: number, x: any) => s + x.toplam, 0);
            const giderTop = (d.gider || []).reduce((s: number, x: any) => s + x.tutar, 0);
            const kar = gelirTop - giderTop;
            return (
              <div className="aydetay">
                <div className="adh">{AYLAR_KISA[selAy]} · {metrik === 'gider' ? 'Gider kırılımı' : metrik === 'kar' ? 'Ay özeti' : 'Gelir kırılımı'}</div>
                {metrik === 'kar' ? (
                  <div className="adkar">
                    <div><span>Gelir</span><b className="pos">+{fmt(gelirTop)} ₺</b></div>
                    <div><span>Gider</span><b className="neg">−{fmt(giderTop)} ₺</b></div>
                    <div><span>Kâr</span><b className={kar >= 0 ? 'pos' : 'neg'}>{kar >= 0 ? '+' : '−'}{fmt(Math.abs(kar))} ₺</b></div>
                  </div>
                ) : metrik === 'gider' ? (
                  (d.gider || []).length === 0
                    ? <div className="adbos">Bu ay kasadan çıkan gider yok.</div>
                    : d.gider.map((x: any, i: number) => (
                        <div className="adrow" key={i}>
                          <div className="adk"><b>{x.baslik}</b></div>
                          <span className="adv neg">−{fmt(x.tutar)} ₺</span>
                        </div>
                      ))
                ) : (
                  (d.gelir || []).length === 0
                    ? <div className="adbos">Bu ay gelir yok.</div>
                    : d.gelir.map((x: any, i: number) => (
                        <div className="adrow" key={i}>
                          <div className="adk">
                            <b>{x.isim}{x.elle ? ' · elle' : ''}</b>
                            <span className="adsub">
                              {x.nakit > 0 ? `nakit ${fmt(x.nakit)}` : ''}
                              {x.nakit > 0 && x.banka > 0 ? ' · ' : ''}
                              {x.banka > 0 ? `banka ${fmt(x.banka)}` : ''}
                              {x.nakit <= 0 && x.banka <= 0 ? '—' : ''}
                            </span>
                          </div>
                          <span className="adv pos">+{fmt(x.toplam)} ₺</span>
                        </div>
                      ))
                )}
              </div>
            );
          })()}

          <div className="hr" />
          <div className="daynav">
            <button className="dnav" disabled={!data.canPrev} onClick={() => stepGun(-1)} aria-label="Önceki gün">‹</button>
            <div className="dnlabel">{gunEtiket}{gunBugun && <small>canlı · sabah 7'de sıfırlanır</small>}{!gunBugun && <small>{aktifGun.split('-').reverse().join('.')}</small>}</div>
            <button className="dnav" disabled={!data.canNext} onClick={() => stepGun(1)} aria-label="Sonraki gün">›</button>
          </div>
          <div className="flow">
            <div className="fc"><span className="cap">{gunBugun ? 'Bugün giren' : 'Giren'}</span><div className="v pos tnum">+{fmt(bugun.giren)} ₺</div></div>
            <div className="fc"><span className="cap">{gunBugun ? 'Bugün çıkan' : 'Çıkan'}</span><div className="v neg tnum">−{fmt(bugun.cikan)} ₺</div></div>
          </div>
        </div>

        {/* MEVCUT KASA — nakit + banka toplamı (tek bakışta elde ne var) */}
        <div className="card mevcut"><span className="key" />
          <div className="lab">Mevcut Kasa <span className="live">canlı</span></div>
          <div className="amt tnum">{fmt(bak.toplam)} <span className="u">₺</span></div>
          <div className="sub">Nakit {fmt(bak.nakit)} {bak.banka < 0 ? '−' : '+'} Banka {fmt(Math.abs(bak.banka))} ₺</div>
        </div>

        {/* POTS */}
        <div className="pots">
          <div className="card pot nk"><span className="key" />
            <div className="lab">Nakit Kasa</div><div className="amt tnum">{fmt(bak.nakit)} <span className="u">₺</span></div><div className="sub">Cepteki fiziksel para</div>
            {(data.teslimatAcigi || 0) > 0 && (
              <div className="sub" style={{ color: 'var(--neg)', fontWeight: 650 }}>⚠️ Teslimat açığı −{fmt(data.teslimatAcigi)} ₺ düşüldü (tahsil edilince geri gelir)</div>
            )}
          </div>
          <div className="card pot bk"><span className="key" />
            <div className="lab">Banka</div><div className="amt tnum">{fmt(bak.banka)} <span className="u">₺</span></div><div className="sub">Kart · İban</div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="acts">
          <button className="btn primary" onClick={() => setShowGider(true)}>− Gider ekle</button>
          <button className="btn ghost" onClick={() => setShowGelir(true)}>+ Para girdi</button>
        </div>
        <button className="subbtn" onClick={openOdeme} style={{ width: '100%' }}>📅 Ödemeler — maaşlar</button>
        <div className="subacts">
          <button className="subbtn" onClick={openBorc}>⇄ Borç / Alacak</button>
          {data.ortakGorebilir && <button className="subbtn yon" onClick={openOrtak}>🔒 Ortaklar</button>}
          {isYonetici && <button className="subbtn yon" onClick={openGorunur}>🔒 Kimler görebilir</button>}
        </div>

        {/* LEDGER */}
        <div className="lhead"><h2>{gunBugun ? 'Bugünün hareketleri' : `${gunEtiket} hareketleri`}</h2><span className="n">{hareketler.length} kayıt</span></div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {hareketler.length === 0 && <div className="empty">{gunBugun ? 'Bugün henüz hareket yok.' : 'Bu gün hareket yok.'}</div>}
          {hareketler.map((h: any) => {
            const inRow = h.tip === 'satis' || h.tip === 'giris';
            return (
              <div className={`item ${inRow ? 'in' : 'out'}`} key={h.id}>
                <span className="k" />
                <div className="body">
                  <div className="t">{h.baslik}{h.tip === 'satis' && <span className="vtag">GÜNÜN SATIŞI</span>}</div>
                  <div className="m">
                    {h.tip === 'satis' ? (<>
                      <b style={{ color: 'var(--mut)' }}>{h.satisAdet} satış</b>
                      {h.nakit > 0 && <span className="mono">nakit {fmt(h.nakit)}</span>}
                      {h.banka > 0 && <span className="mono">kart {fmt(h.banka)}</span>}
                      <span className="live">canlı</span>
                    </>) : (<>
                      <span>{h.olusturan || '—'}</span>
                      {h.ts && <span className="mono">{String(h.ts).slice(11, 16)}</span>}
                      <span className={`potpill ${h.pot === 'banka' ? 'bk' : 'nk'}`}>{h.pot === 'banka' ? 'Banka' : 'Nakit'}</span>
                    </>)}
                  </div>
                </div>
                <div className={`amt2 ${inRow ? 'pos' : 'neg'}`}>{inRow ? '+' : '−'}{fmt(h.tutar)}</div>
                {h.tip !== 'satis' && isYonetici && <button className="geri" onClick={() => geriAl(h.id)}>Geri Al</button>}
              </div>
            );
          })}
        </div>

        {(() => {
          // İşlem geçmişi — gün gün: önce en yeni gün, "+1 gün" ile bir önceki gün açılır
          const gecmis: any[] = data.gecmis || [];
          if (gecmis.length === 0) return null;
          const gunSira: string[] = [];
          const gunGrup: Record<string, any[]> = {};
          for (const g of gecmis) {
            const t = g.tarih || '?';
            if (!gunGrup[t]) { gunGrup[t] = []; gunSira.push(t); }
            gunGrup[t].push(g);
          }
          const acikGunler = gunSira.slice(0, gecmisGunSayisi);
          const kalanGun = gunSira.length - acikGunler.length;
          const gunEtiketi = (t: string) => {
            if (t === data.bugunTarih) return 'Bugün';
            try { return new Date(t + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }); } catch { return t; }
          };
          return (<>
            <div className="lhead" style={{ marginTop: 10 }}><h2>İşlem geçmişi</h2><span className="n">{acikGunler.length}/{gunSira.length} gün</span></div>
            {acikGunler.map((t) => (
              <div key={t}>
                <div className="lhead" style={{ marginTop: 6 }}><h2 style={{ fontSize: 12.5, color: 'var(--mut)' }}>📅 {gunEtiketi(t)}</h2><span className="n">{gunGrup[t].length} işlem</span></div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  {gunGrup[t].map((g: any) => (
                    <div key={g.id} className="item" style={{ paddingLeft: 15 }}>
                      <span className="k" style={{ background: g.yon === 'giris' ? 'var(--pos)' : 'var(--neg)' }} />
                      <div className="body">
                        <div className="t">{g.baslik}</div>
                        <div className="m">{g.ts ? <span className="mono">{String(g.ts).slice(11, 16)}</span> : null}{g.olusturan ? ` · ${g.olusturan}` : ''}{g.kasaHaric ? <span style={{ color: 'var(--mut2)' }}> · geçmiş (kasa dışı)</span> : ''}</div>
                      </div>
                      <div className={`amt2 ${g.yon === 'giris' ? 'pos' : 'neg'}`}>{g.yon === 'giris' ? '+' : '−'}{fmt(g.tutar)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {kalanGun > 0 && (
              <button className="subbtn" style={{ width: '100%', marginTop: 8 }} onClick={() => setGecmisGunSayisi((n) => n + 1)}>
                +1 gün ({kalanGun} gün daha)
              </button>
            )}
          </>);
        })()}

        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button className="geri" onClick={() => fetchData()} style={{ borderColor: 'var(--line)' }}>↻ Yenile</button>
        </div>
      </div></div>

      {/* GIDER MODAL */}
      {showGider && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGider(false); }}>
          <div className="k2sheet" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="sh"><h3>Gider ekle</h3><button className="close" onClick={() => setShowGider(false)}>×</button></div>
            <div className="fld"><span className="cap">Tutar (₺)</span>
              {gOdeme !== 'karisik'
                ? <div className="amt on" onClick={() => setGField('tutar')}>
                    <span className={`val ${gTutar ? '' : 'z'}`}>{gTutar || '0'}</span><span className="cur">₺</span>
                  </div>
                : <div className="amtrow">
                    <div className={`amt ${gField === 'nakit' ? 'on' : ''}`} onClick={() => setGField('nakit')}>
                      <span className="lab">Nakit</span><span className={`val ${gNakit ? '' : 'z'}`}>{gNakit || '0'}</span><span className="cur">₺</span>
                    </div>
                    <div className={`amt ${gField === 'banka' ? 'on' : ''}`} onClick={() => setGField('banka')}>
                      <span className="lab">Banka</span><span className={`val ${gBanka ? '' : 'z'}`}>{gBanka || '0'}</span><span className="cur">₺</span>
                    </div>
                  </div>}
              <Numpad onKey={giderKey} />
            </div>
            <div className="fld"><span className="cap">Kategori</span>
              <div className="chips">{KATEGORILER_SIRALI.map((k) => (<span key={k.k} className={`ch ${gKat === k.k ? 'on' : ''}`} onClick={() => setGKat(k.k)}>{k.l}</span>))}</div>
            </div>
            {gKat === 'avans' && (
              <div className="fld"><span className="cap">Kime avans? (maaşından düşülür)</span>
                <div className="chips">
                  {(data.personeller || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--mut2)' }}>Maaş tanımlı personel yok.</span>}
                  {(data.personeller || []).map((p: any) => (<span key={p.id} className={`ch ${gPersonel?.id === p.id ? 'on' : ''}`} onClick={() => setGPersonel(p)}>{p.isim}</span>))}
                </div>
              </div>
            )}
            {gKat === 'kira' && (
              <div className="fld"><span className="cap">Hangi mekan?</span>
                <div className="chips">
                  {(data.mekanlar || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--mut2)' }}>Mekan yok.</span>}
                  {(data.mekanlar || []).map((m: any) => (<span key={m.id} className={`ch ${gMekan?.id === m.id ? 'on' : ''}`} onClick={() => setGMekan(m)}>{m.isim}</span>))}
                </div>
              </div>
            )}
            <div className="fld"><span className="cap">Ödeme kaynağı</span>
              <div className="seg">
                {(['nakit', 'banka', 'karisik'] as const).map((o) => (<div key={o} className={`s ${gOdeme === o ? 'on' : ''}`} onClick={() => { setGOdeme(o); setGField(o === 'karisik' ? 'nakit' : 'tutar'); }}>{o === 'nakit' ? 'Nakit' : o === 'banka' ? 'Banka' : 'Karışık'}</div>))}
              </div>
              {gOdeme === 'karisik' && <div style={{ fontSize: 11.5, color: 'var(--mut2)', marginTop: 8 }}>Yukarıdaki Nakit / Banka kutusuna dokun, tuş takımıyla gir.</div>}
            </div>
            <div className="fld"><span className="cap">Not — isteğe bağlı</span>
              <input className="in" style={{ fontSize: 14, fontWeight: 400 }} placeholder="ör. Shell benzinlik" value={gNot} onChange={(e) => setGNot(e.target.value)} />
            </div>
            <button className="save" disabled={saving} onClick={kaydetGider}>{saving ? 'Kaydediliyor…' : 'Gideri kaydet'}</button>
          </div>
        </div>
      )}

      {/* GELIR MODAL */}
      {showGelir && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGelir(false); }}>
          <div className="k2sheet" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="sh"><h3>Para girdi</h3><button className="close" onClick={() => setShowGelir(false)}>×</button></div>
            <div className="fld"><span className="cap">Tutar (₺)</span>
              <div className="amt on">
                <span className={`val ${glTutar ? '' : 'z'}`}>{glTutar || '0'}</span><span className="cur">₺</span>
              </div>
              <Numpad onKey={(k) => setGlTutar((prev) => padApply(prev, k))} />
            </div>
            <div className="fld"><span className="cap">Hangi bölmeye?</span>
              <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {(['nakit', 'banka'] as const).map((o) => (<div key={o} className={`s ${glPot === o ? 'on' : ''}`} onClick={() => setGlPot(o)}>{o === 'nakit' ? 'Nakit' : 'Banka'}</div>))}
              </div>
            </div>
            <div className="fld"><span className="cap">Açıklama</span>
              <input className="in" style={{ fontSize: 14, fontWeight: 400 }} placeholder="ör. dışarıdan tahsilat" value={glNot} onChange={(e) => setGlNot(e.target.value)} />
            </div>
            <button className="save" disabled={saving} onClick={kaydetGelir}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </div>
        </div>
      )}

      {/* ORTAKLAR PANEL (yönetici-only) */}
      {showOrtak && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOrtak(false); }}>
          <div className="k2sheet" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="sh"><h3>🔒 Ortaklar · Pay Dağıt</h3><button className="close" onClick={() => setShowOrtak(false)}>×</button></div>
            {!ortakData ? <div className="empty">Yükleniyor…</div> : (<>
              <div className="fld">
                <span className="cap">Pay Dağıt — dağıtılacak toplam</span>
                <input className="in tnum" inputMode="numeric" placeholder="0" value={payTutar} onChange={(e) => { setPayTutar(fmtIn(e.target.value)); setPayPlan(null); }} />
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
                  {(['banka', 'nakit'] as const).map((o) => (<div key={o} className={`s ${payPot === o ? 'on' : ''}`} onClick={() => { setPayPot(o); setPayPlan(null); }}>{o === 'banka' ? 'Banka' : 'Nakit'}</div>))}
                </div>
                {parseNum(payTutar) > 0 && !payPlan && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--mut2)', lineHeight: 1.6 }}>
                    {ortakData.ortaklar.map((o: any) => `${o.isim.split(' ')[0]} %${o.yuzde}: ${fmt(parseNum(payTutar) * o.yuzde / 100)} ₺`).join('  ·  ')}
                  </div>
                )}
                {payPlan ? (
                  <div style={{ marginTop: 10, background: 'rgba(154,124,255,.07)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                    <span className="cap" style={{ display: 'block', marginBottom: 6 }}>Dağıtım dökümü — onay bekliyor</span>
                    {payPlan.plan.map((x: any) => (
                      <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, lineHeight: 1.8 }}>
                        <span style={{ whiteSpace: 'nowrap' }}>{x.isim.split(' ')[0]} <span className="pct">%{x.yuzde}</span></span>
                        <span className="tnum" style={{ textAlign: 'right' }}>
                          {x.mahsup > 0
                            ? (x.nakit > 0
                              ? <>payı {fmt(x.pay)} → <b style={{ color: '#f5b544' }}>{fmt(x.mahsup)} borca mahsup</b> + <b>{fmt(x.nakit)} nakit</b></>
                              : <>payı {fmt(x.pay)} → <b style={{ color: '#f5b544' }}>tamamı borca mahsup</b> · <b>0 nakit</b>{x.yeniDenge < 0 ? ` (kalan borç ${fmt(-x.yeniDenge)})` : ''}</>)
                            : <>payı {fmt(x.pay)} → <b>{fmt(x.nakit)} nakit</b></>}
                        </span>
                      </div>
                    ))}
                    <div className="tnum" style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8, fontSize: 12.5, fontWeight: 700 }}>
                      Kasadan çıkacak: {fmt(payPlan.toplamNakit)} ₺{payPlan.toplamMahsup > 0 ? <span style={{ color: '#f5b544' }}> · Borca mahsup (kasada kalır): {fmt(payPlan.toplamMahsup)} ₺</span> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="save" disabled={saving} onClick={payDagit} style={{ flex: 1 }}>Onayla ve Dağıt</button>
                      <button className="geri" disabled={saving} onClick={() => setPayPlan(null)}>Vazgeç</button>
                    </div>
                  </div>
                ) : (
                  <button className="save" disabled={saving || parseNum(payTutar) <= 0} onClick={payOnizle} style={{ marginTop: 10 }}>Dökümü Gör</button>
                )}
              </div>

              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="cap">Ortak durumu</span>
                  {isYonetici && <button className="geri" onClick={ortakSifirla}>🔒 Sıfırla</button>}
                </div>
                {ortakData.ortaklar.map((o: any) => (
                  <div key={o.id} className="partner">
                    <div className="pa">{o.isim.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 650 }}>{o.isim} <span className="pct">%{o.yuzde}</span></div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 650, textAlign: 'right', color: o.denge > 0 ? 'var(--pos)' : o.denge < 0 ? 'var(--neg)' : 'var(--mut2)' }}>
                      {o.denge > 0 ? `${fmt(o.denge)} alacaklı` : o.denge < 0 ? `${fmt(-o.denge)} borçlu` : 'dengede'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="fld" style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <span className="cap">Ortak para çekti / koydu</span>
                <div className="chips" style={{ marginTop: 8 }}>
                  {ortakData.ortaklar.map((o: any) => (<span key={o.id} className={`ch ${ohOrtak === o.id ? 'on' : ''}`} onClick={() => setOhOrtak(o.id)}>{o.isim.split(' ')[0]}</span>))}
                </div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
                  <div className={`s ${ohYon === 'cikis' ? 'on' : ''}`} onClick={() => setOhYon('cikis')}>Çekti (çıkış)</div>
                  <div className={`s ${ohYon === 'giris' ? 'on' : ''}`} onClick={() => setOhYon('giris')}>Koydu (giriş)</div>
                </div>
                <input className="in tnum" inputMode="numeric" placeholder="Tutar" value={ohTutar} onChange={(e) => setOhTutar(fmtIn(e.target.value))} style={{ marginTop: 8 }} />
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
                  {(['nakit', 'banka'] as const).map((o) => (<div key={o} className={`s ${ohPot === o ? 'on' : ''}`} onClick={() => setOhPot(o)}>{o === 'nakit' ? 'Nakit' : 'Banka'}</div>))}
                </div>
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 8 }}>
                  <div className={`s ${ohKasa ? 'on' : ''}`} onClick={() => setOhKasa(true)}>Kasaya yansıt</div>
                  <div className={`s ${!ohKasa ? 'on' : ''}`} onClick={() => setOhKasa(false)}>Geçmiş · yansıtma</div>
                </div>
                {!ohKasa && <div style={{ fontSize: 10.5, color: 'var(--mut2)', marginTop: 6 }}>Sadece ortak dengesine işlenir, bugünkü kasa bakiyesi değişmez.</div>}
                <button className="save" disabled={saving || !ohOrtak || parseNum(ohTutar) <= 0} onClick={ortakHareket} style={{ marginTop: 10 }}>Kaydet</button>
              </div>
              {(ortakData.hareketler || []).length > 0 && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <span className="cap" style={{ display: 'block', marginBottom: 8 }}>Ortak işlem geçmişi</span>
                  {(ortakData.hareketler || []).map((h: any) => (
                    <div key={h.id} className="item" style={{ paddingLeft: 15 }}>
                      <span className="k" style={{ background: h.yon === 'giris' ? 'var(--pos)' : 'var(--neg)' }} />
                      <div className="body">
                        <div className="t">{h.aciklama || (h.yon === 'giris' ? 'Koydu' : 'Çekti')}</div>
                        <div className="m"><span className="mono">{h.tarih}</span>{h.kaynak === 'pay_dagitim' ? ' · pay dağıtımı' : h.kaynak === 'pay_mahsup' ? ' · payından borca mahsup (kasadan çıkmadı)' : ''}</div>
                      </div>
                      <div className={`amt2 ${h.yon === 'giris' ? 'pos' : 'neg'}`}>{h.yon === 'giris' ? '+' : '−'}{fmt(h.tutar)}</div>
                      {isYonetici && <button className="geri" onClick={() => ortakGeriAl(h.id)}>Geri Al</button>}
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </div>
        </div>
      )}

      {/* BORÇ / ALACAK PANEL */}
      {showBorc && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowBorc(false); }}>
          <div className="k2sheet" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="sh"><h3>Borç / Alacak</h3><button className="close" onClick={() => setShowBorc(false)}>×</button></div>
            {!borcData ? <div className="empty">Yükleniyor…</div> : (<>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, background: 'var(--posBg)', borderRadius: 10, padding: '10px 12px' }}><div className="cap">Alacak (bize borçlu)</div><div style={{ fontSize: 18, fontWeight: 750, color: 'var(--pos)' }} className="tnum">{fmt(borcData.toplamAlacak)} ₺</div></div>
                <div style={{ flex: 1, background: 'var(--negBg)', borderRadius: 10, padding: '10px 12px' }}><div className="cap">Verecek (biz borçlu)</div><div style={{ fontSize: 18, fontWeight: 750, color: 'var(--neg)' }} className="tnum">{fmt(borcData.toplamVerecek)} ₺</div></div>
              </div>
              <div className="fld">
                <span className="cap">Yeni kayıt</span>
                <input className="in" style={{ fontSize: 14, fontWeight: 400, marginTop: 8, marginBottom: 8 }} placeholder="Kişi / firma" value={bKisi} onChange={(e) => setBKisi(e.target.value)} />
                <div className="seg" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 8 }}>
                  <div className={`s ${bYon === 'alacak' ? 'on' : ''}`} onClick={() => setBYon('alacak')}>Bize borçlu</div>
                  <div className={`s ${bYon === 'verecek' ? 'on' : ''}`} onClick={() => setBYon('verecek')}>Biz borçluyuz</div>
                </div>
                <input className="in tnum" inputMode="numeric" placeholder="Tutar" value={bTutar} onChange={(e) => setBTutar(fmtIn(e.target.value))} style={{ marginBottom: 8 }} />
                <input className="in" style={{ fontSize: 14, fontWeight: 400 }} placeholder="Açıklama (ops.)" value={bAciklama} onChange={(e) => setBAciklama(e.target.value)} />
                <button className="save" disabled={saving || !bKisi || parseNum(bTutar) <= 0} onClick={borcEkle} style={{ marginTop: 10 }}>Ekle</button>
              </div>
              <div style={{ marginTop: 4 }}>
                {(borcData.borclar || []).length === 0 && <div className="empty">Kayıt yok.</div>}
                {(borcData.borclar || []).map((b: any) => (
                  <div key={b.id} className="item" style={{ paddingLeft: 15 }}>
                    <span className="k" style={{ background: b.yon === 'alacak' ? 'var(--pos)' : 'var(--neg)' }} />
                    <div className="body">
                      <div className="t">{b.kisi} <span className="potpill" style={{ color: b.yon === 'alacak' ? 'var(--pos)' : 'var(--neg)' }}>{b.yon === 'alacak' ? 'Alacak' : 'Verecek'}</span></div>
                      <div className="m">{b.aciklama || '—'} · kalan <b style={{ color: 'var(--ink)' }}>{fmt(b.kalan)} ₺</b></div>
                    </div>
                    <button className="geri" onClick={() => { setOdemeFor(b); setOdemeTutar(String(b.kalan)); setOdemePot('nakit'); }}>{b.yon === 'alacak' ? 'Tahsil' : 'Öde'}</button>
                    <button className="geri" onClick={() => borcSil(b.id)}>Sil</button>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* ÖDEME / TAHSİLAT MINI */}
      {odemeFor && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setOdemeFor(null); }} style={{ zIndex: 70 }}>
          <div className="k2sheet">
            <div className="sh"><h3>{odemeFor.yon === 'alacak' ? 'Tahsilat' : 'Ödeme'} — {odemeFor.kisi}</h3><button className="close" onClick={() => setOdemeFor(null)}>×</button></div>
            <div className="fld"><span className="cap">Tutar (kalan {fmt(odemeFor.kalan)} ₺)</span>
              <input className="in tnum" inputMode="numeric" value={odemeTutar} onChange={(e) => setOdemeTutar(fmtIn(e.target.value))} />
            </div>
            <div className="fld"><span className="cap">{odemeFor.yon === 'alacak' ? 'Hangi bölmeye girsin?' : 'Hangi bölmeden çıksın?'}</span>
              <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {(['nakit', 'banka'] as const).map((o) => (<div key={o} className={`s ${odemePot === o ? 'on' : ''}`} onClick={() => setOdemePot(o)}>{o === 'nakit' ? 'Nakit' : 'Banka'}</div>))}
              </div>
            </div>
            <button className="save" disabled={saving || parseNum(odemeTutar) <= 0} onClick={borcOdeme}>{odemeFor.yon === 'alacak' ? 'Tahsil et' : 'Öde'}</button>
          </div>
        </div>
      )}

      {/* ÖDEMELER (maaş/kira) PANEL */}
      {showOdeme && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowOdeme(false); }}>
          <div className="k2sheet" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="sh"><h3>📅 Ödemeler{odemeData?.ay ? ` — ${odemeData.ay}` : ''}</h3><button className="close" onClick={() => setShowOdeme(false)}>×</button></div>
            {!odemeData ? <div className="empty">Yükleniyor…</div> : (<>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, background: 'var(--negBg)', borderRadius: 10, padding: '10px 12px' }}><div className="cap">Bekleyen</div><div style={{ fontSize: 18, fontWeight: 750, color: 'var(--neg)' }} className="tnum">{fmt(odemeData.toplamBekleyen)} ₺</div></div>
                <div style={{ flex: 1, background: 'var(--posBg)', borderRadius: 10, padding: '10px 12px' }}><div className="cap">Bu ay ödenen</div><div style={{ fontSize: 18, fontWeight: 750, color: 'var(--pos)' }} className="tnum">{fmt(odemeData.toplamOdenen)} ₺</div></div>
              </div>
              {(odemeData.items || []).length === 0 && <div className="empty">Ödeme kalemi yok.<br />Maaşlar Maliyet Yönetimi'nden, hakedişler kotalardan gelir.</div>}
              {(odemeData.items || []).map((it: any) => (
                <div key={it.key} className="item" style={{ paddingLeft: 15, opacity: it.odendi ? .55 : 1 }}>
                  <span className="k" style={{ background: it.odendi ? 'var(--pos)' : it.gecikmis ? 'var(--neg)' : it.tip === 'kira' ? 'var(--amber)' : it.tip === 'hakedis' ? 'var(--brand2)' : 'var(--brand)' }} />
                  <div className="body">
                    <div className="t">{it.baslik}</div>
                    <div className="m">{it.tip === 'kira' ? 'Kira' : it.tip === 'hakedis' ? 'Hakediş' : 'Maaş'} · {it.ay}{it.tip === 'hakedis' && (it.keys?.length > 0) && <span style={{ color: 'var(--mut2)' }}> · {it.keys.length} kalem</span>}{it.avans > 0 && <span style={{ color: 'var(--amber)' }}> · bu ay avans −{fmt(it.avans)} (maaş {fmt(it.base)})</span>}{it.gecikmis && <span style={{ color: 'var(--neg)', fontWeight: 700 }}> · gecikmiş</span>}</div>
                  </div>
                  <div className="amt2" style={{ color: it.odendi ? 'var(--mut2)' : 'var(--ink)' }}>{fmt(it.tutar)} ₺</div>
                  {it.odendi ? <span style={{ fontSize: 11, color: 'var(--pos)', fontWeight: 650, marginLeft: 8 }}>ödendi ✓</span>
                    : (<>
                        {it.tip === 'hakedis' && <button className="geri" onClick={() => hakedisSil(it)}>Sil</button>}
                        <button className="ode" onClick={() => { setOdemeItem(it); setOdemeItemPot(it.tip === 'hakedis' ? 'nakit' : 'banka'); setOdemeTutarStr(fmtIn(String(it.tutar || 0))); }}>Öde</button>
                      </>)}
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--mut2)', marginTop: 12, lineHeight: 1.5 }}>Maaşlar Maliyet Yönetimi'nden, <b style={{ color: 'var(--mut)' }}>hakedişler kota/rotasyondan</b> otomatik gelir; ödediğinde kasadan düşer, hakediş Hakediş Takip'te de <b style={{ color: 'var(--pos)' }}>ödendi</b> işaretlenir. <b style={{ color: 'var(--mut)' }}>Kiralar burada değil</b> — kirayı "Gider ekle" ile manuel girersin.</div>
            </>)}
          </div>
        </div>
      )}
      {/* ödeme-yap mini */}
      {odemeItem && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setOdemeItem(null); }} style={{ zIndex: 70 }}>
          <div className="k2sheet">
            <div className="sh"><h3>Öde — {odemeItem.baslik}</h3><button className="close" onClick={() => setOdemeItem(null)}>×</button></div>
            <div className="fld"><span className="cap">Tutar — düzenleyebilirsin</span>
              <div className="amt on"><span className={`val ${odemeTutarStr ? '' : 'z'}`}>{odemeTutarStr || '0'}</span><span className="cur">₺</span></div>
              <Numpad onKey={(k) => setOdemeTutarStr((prev) => padApply(prev, k))} />
              {(() => {
                const yeni = parseNum(odemeTutarStr); const fark = yeni - (odemeItem.tutar || 0);
                return (
                  <div style={{ fontSize: 11.5, color: 'var(--mut2)', marginTop: 8, lineHeight: 1.55 }}>
                    {odemeItem.tip === 'hakedis'
                      ? <>Kota hesabı: <b style={{ color: 'var(--mut)' }}>{fmt(odemeItem.tutar)} ₺</b>{odemeItem.keys?.length > 0 ? ` · ${odemeItem.keys.length} kalem` : ''}</>
                      : <>Tanımlı net: <b style={{ color: 'var(--mut)' }}>{fmt(odemeItem.tutar)} ₺</b>{odemeItem.avans > 0 ? ` · maaş ${fmt(odemeItem.base)} − avans ${fmt(odemeItem.avans)}` : ''}</>}
                    {fark !== 0 && <><br /><b style={{ color: fark < 0 ? 'var(--neg)' : 'var(--pos)' }}>{fark < 0 ? `Kesinti −${fmt(-fark)} ₺` : `Fazla +${fmt(fark)} ₺`}</b> · ödenecek {fmt(yeni)} ₺</>}
                    {odemeItem.tip === 'hakedis' && <><br /><span style={{ color: 'var(--mut2)' }}>Ödeyince Hakediş Takip'te de ödendi olur.</span></>}
                  </div>
                );
              })()}
            </div>
            <div className="fld"><span className="cap">Hangi bölmeden çıksın?</span>
              <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {(['banka', 'nakit'] as const).map((o) => (<div key={o} className={`s ${odemeItemPot === o ? 'on' : ''}`} onClick={() => setOdemeItemPot(o)}>{o === 'banka' ? 'Banka' : 'Nakit'}</div>))}
              </div>
            </div>
            <button className="save" disabled={saving || parseNum(odemeTutarStr) <= 0} onClick={odemeYap}>{saving ? 'Ödeniyor…' : `${fmt(parseNum(odemeTutarStr))} ₺ Öde`}</button>
          </div>
        </div>
      )}

      {/* GÖRÜNÜRLÜK (kimler görebilir) — yönetici */}
      {showGorunur && (
        <div className="k2mod" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGorunur(false); }}>
          <div className="k2sheet" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="sh"><h3>🔒 Kimler görebilir</h3><button className="close" onClick={() => setShowGorunur(false)}>×</button></div>
            {!gorunurList ? <div className="empty">Yükleniyor…</div> : (<>
              <div style={{ fontSize: 12, color: 'var(--mut2)', marginBottom: 12, lineHeight: 1.5 }}>Her kişi için ayrı: <b style={{ color: 'var(--pos)' }}>Kasa</b> = ana kasa, <b style={{ color: '#c9b8ff' }}>Ortak</b> = ortaklar/pay dağıtımı. Sen (yönetici) her ikisini her zaman görürsün.</div>
              {gorunurList.length === 0 && <div className="empty">Üst müdür / müdür / idari personel yok.</div>}
              {gorunurList.map((u: any) => (
                <div key={u.id} className="partner">
                  <div className="pa">{(u.isim || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{u.isim}</div>
                    <div style={{ fontSize: 11, color: 'var(--mut2)', marginTop: 2 }}>{u.rol}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="geri" style={gorunurSet.has(u.id) ? { color: 'var(--pos)', borderColor: 'var(--pos)' } : undefined} onClick={() => toggleGorunur(u.id)}>Kasa{gorunurSet.has(u.id) ? ' ✓' : ''}</button>
                    <button className="geri" style={ortakSet.has(u.id) ? { color: '#c9b8ff', borderColor: 'var(--brand)' } : undefined} onClick={() => toggleOrtak(u.id)}>Ortak{ortakSet.has(u.id) ? ' ✓' : ''}</button>
                  </div>
                </div>
              ))}
              <button className="save" disabled={saving} onClick={saveGorunur} style={{ marginTop: 14 }}>Kaydet</button>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
