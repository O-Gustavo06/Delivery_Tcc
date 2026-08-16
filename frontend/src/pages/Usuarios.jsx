import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function PairingQrPanel({ pairing, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(pairing.code, { width: 260, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [pairing.code])

  const expiresLabel = pairing.expiresAt
    ? new Date(pairing.expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="card section-card fade-in" style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
      <div className="section-head" style={{ width: '100%' }}>
        <div>
          <h2>QR de confirmacao — {pairing.name}</h2>
          <p>Mostre essa tela pro entregador bipar no app dele. Confirma que o aparelho e realmente dele.</p>
        </div>
        <button className="btn btn-light" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
      {qrDataUrl && <img src={qrDataUrl} alt={`QR de pareamento de ${pairing.name}`} width={260} height={260} />}
      <div className="login-demo-box">{pairing.code}</div>
      {expiresLabel && (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Valido ate {expiresLabel}. Uso unico.</p>
      )}
    </div>
  )
}

export default function Usuarios({ users, onCreateUser, onLoadUsers, onRegeneratePairingCode }) {
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [role, setRole] = useState('ADMIN')
  const [pairing, setPairing] = useState(null)

  useEffect(() => {
    void onLoadUsers()
  }, [onLoadUsers])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    setIsSaving(true)

    const formData = new FormData(form)
    const payload = {
      name: String(formData.get('name') || ''),
      role: String(formData.get('role') || 'cliente'),
      is_active: formData.get('is_active') === 'on',
    }

    if (payload.role === 'ENTREGADOR') {
      payload.telefone = String(formData.get('telefone') || '').trim()
    } else {
      payload.email = String(formData.get('email') || '')
      payload.password = String(formData.get('password') || '')
    }

    const result = await onCreateUser(payload)
    if (!result.ok) {
      setError(result.message)
    } else {
      form.reset()
      const activeToggle = form.querySelector('#userActive')
      if (activeToggle) activeToggle.checked = true
      setRole('ADMIN')

      if (result.user?.pairingCode) {
        setPairing({ name: result.user.name, code: result.user.pairingCode, expiresAt: result.user.pairingExpiresAt })
      }
    }

    setIsSaving(false)
  }

  const handleGenerateQr = async (user) => {
    const result = await onRegeneratePairingCode(user.id)
    if (result.ok && result.user?.pairingCode) {
      setPairing({ name: result.user.name, code: result.user.pairingCode, expiresAt: result.user.pairingExpiresAt })
    }
  }

  return (
    <section className="card users-card fade-in" style={{ display: 'grid', gap: 20 }}>
      {pairing && <PairingQrPanel pairing={pairing} onClose={() => setPairing(null)} />}

      <div className="users-grid">
        <div>
          <h2>Usuarios cadastrados</h2>
          <div className="users-table">
            <div className="users-row users-head">
              <span>Nome</span>
              <span>Email / Telefone</span>
              <span>Role</span>
              <span>Status</span>
            </div>
            {users.map((user) => (
              <div className="users-row" key={user.id}>
                <span>{user.name}</span>
                <span>{user.role === 'ENTREGADOR' ? user.telefone || '-' : user.email}</span>
                <span className="badge badge-muted">{user.role}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${user.isActive ? 'badge-green' : 'badge-red'}`}>
                    {user.isActive ? 'ativo' : 'inativo'}
                  </span>
                  {user.role === 'ENTREGADOR' && (
                    <button className="btn btn-light" type="button" onClick={() => handleGenerateQr(user)}>
                      {user.pareado ? 'Gerar novo QR' : 'Ver QR'}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2>Novo usuario</h2>
          <form id="userForm" className="users-form" onSubmit={handleSubmit}>
            <div className="filter-group">
              <label htmlFor="userName">Nome</label>
              <input id="userName" name="name" type="text" required />
            </div>
            <div className="filter-group">
              <label htmlFor="userRole">Role</label>
              <select id="userRole" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="ADMIN">Admin</option>
                <option value="GERENTE">Gerente</option>
                <option value="ATENDENTE">Atendente</option>
                <option value="ENTREGADOR">Entregador</option>
              </select>
            </div>

            {role === 'ENTREGADOR' ? (
              <div className="filter-group">
                <label htmlFor="userTelefone">Telefone</label>
                <input id="userTelefone" name="telefone" type="text" placeholder="(11) 99999-9999" required />
              </div>
            ) : (
              <>
                <div className="filter-group">
                  <label htmlFor="userEmail">Email</label>
                  <input id="userEmail" name="email" type="email" required />
                </div>
                <div className="filter-group">
                  <label htmlFor="userPassword">Senha</label>
                  <input id="userPassword" name="password" type="password" minLength={8} required />
                </div>
              </>
            )}

            {role === 'ENTREGADOR' && (
              <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: 0 }}>
                Entregador nao usa email/senha: depois de criar, um QR aparece aqui pra ele bipar no app e confirmar o aparelho.
              </p>
            )}

            <label className="users-toggle">
              <input id="userActive" name="is_active" type="checkbox" defaultChecked />
              <span>Usuario ativo</span>
            </label>
            <div className="users-actions">
              <button className="btn btn-primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Criar usuario'}
              </button>
            </div>
            <div id="userError" className="login-error" role="alert" aria-live="polite">
              {error}
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
