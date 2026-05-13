import React, { useEffect, useState } from 'react'

export default function Usuarios({ users, onCreateUser, onLoadUsers }) {
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void onLoadUsers()
  }, [onLoadUsers])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    const formData = new FormData(event.currentTarget)
    const payload = {
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
      role: String(formData.get('role') || 'cliente'),
      is_active: formData.get('is_active') === 'on',
    }

    const result = await onCreateUser(payload)
    if (!result.ok) {
      setError(result.message)
    } else {
      event.currentTarget.reset()
      const activeToggle = event.currentTarget.querySelector('#userActive')
      if (activeToggle) activeToggle.checked = true
    }

    setIsSaving(false)
  }

  return (
    <section className="card users-card">
      <div className="users-grid">
        <div>
          <h2>Usuarios cadastrados</h2>
          <div className="users-table">
            <div className="users-row users-head">
              <span>Nome</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
            </div>
            {users.map((user) => (
              <div className="users-row" key={user.id}>
                <span>{user.name}</span>
                <span>{user.email}</span>
                <span className="badge badge-muted">{user.role}</span>
                <span className={`badge ${user.isActive ? 'badge-green' : 'badge-red'}`}>
                  {user.isActive ? 'ativo' : 'inativo'}
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
              <label htmlFor="userEmail">Email</label>
              <input id="userEmail" name="email" type="email" required />
            </div>
            <div className="filter-group">
              <label htmlFor="userPassword">Senha</label>
              <input id="userPassword" name="password" type="password" minLength={8} required />
            </div>
            <div className="filter-group">
              <label htmlFor="userRole">Role</label>
              <select id="userRole" name="role">
                <option value="admin">Admin</option>
                <option value="atendente">Atendente</option>
                <option value="motoboy">Motoboy</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
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
