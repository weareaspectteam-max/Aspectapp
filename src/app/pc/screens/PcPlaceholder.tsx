export function PcPlaceholder({ title }: { title: string }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 8,
      padding: 24,
      color: 'rgba(255,255,255,0.5)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 42 }}>🚧</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</div>
      <div style={{ fontSize: 12 }}>Bu ekran yakında PC paneline eklenecek.</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Şimdilik mobil uygulamadan devam edebilirsin.</div>
    </div>
  );
}
