import api from './client'

export async function login(password: string) {
  const { data } = await api.post<{ token: string }>('/auth/login', { password })
  return data
}

export async function setup(password: string) {
  const { data } = await api.post<{ token: string }>('/auth/setup', { password })
  return data
}

export async function getMe() {
  const { data } = await api.get<{ authenticated: boolean }>('/auth/me')
  return data
}
