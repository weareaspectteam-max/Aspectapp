old = """                  <Card style={{ padding: 18, marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 10px' }}>KOD İLE KATIL</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                        placeholder="AX47"
                        maxLength={4}
                        style={{
                          flex: 1, padding: '12px 14px', borderRadius: 12,
                          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                          color: '#fff', fontSize: 20, fontWeight: 900, textAlign: 'center',
                          outline: 'none', letterSpacing: '0.3em',
                        }}
                      />
                      <button
                        onClick={() => handleJoinRoom()}
                        disabled={joinCode.length < 4 || loading}
                        style={{
                          padding: '12px 20px', borderRadius: 12, cursor: joinCode.length === 4 ? 'pointer' : 'default',
                          background: joinCode.length === 4 ? `${C.cyan}25` : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${joinCode.length === 4 ? C.cyan + '50' : 'rgba(255,255,255,0.1)'}`,
                          color: joinCode.length === 4 ? C.cyan : 'rgba(255,255,255,0.3)',
                          fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap',
                        }}
                      >
                        Katıl
                      </button>
                    </div>
                  </Card>"""

new = """                  <Card style={{ padding: 18, marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 10px' }}>KOD İLE KATIL</p>
                    <input
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="AX47"
                      maxLength={4}
                      style={{
                        width: '100%', boxSizing: 'border-box' as const,
                        padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff', fontSize: 20, fontWeight: 900, textAlign: 'center' as const,
                        outline: 'none', letterSpacing: '0.3em',
                      }}
                    />
                    <button
                      onClick={() => handleJoinRoom()}
                      disabled={joinCode.length < 4 || loading}
                      style={{
                        width: '100%', marginTop: 8,
                        padding: '11px 0', borderRadius: 12, cursor: joinCode.length === 4 ? 'pointer' : 'default',
                        background: joinCode.length === 4 ? `${C.cyan}25` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${joinCode.length === 4 ? C.cyan + '50' : 'rgba(255,255,255,0.1)'}`,
                        color: joinCode.length === 4 ? C.cyan : 'rgba(255,255,255,0.3)',
                        fontWeight: 800, fontSize: 14,
                      }}
                    >
                      Katıl
                    </button>
                  </Card>"""

with open('/src/app/components/foto-tkm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

if old in content:
    content = content.replace(old, new)
    with open('/src/app/components/foto-tkm.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK")
else:
    print("NOT FOUND")
