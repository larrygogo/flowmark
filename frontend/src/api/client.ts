import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('flowmark-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/')) {
      localStorage.removeItem('flowmark-token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api

export async function login(password: string) {
  const { data } = await api.post<{ token: string }>('/auth/login', { password })
  return data
}

export async function setup(password: string) {
  const { data } = await api.post<{ token: string }>('/auth/setup', { password })
  return data
}

export async function checkAuth() {
  const { data } = await api.get<{ authenticated: boolean }>('/auth/me')
  return data
}
