import request from './request'

export const login = (credentials) => {
  return request.post('/auth/login', credentials)
}

export const register = (userData) => {
  return request.post('/auth/register', userData)
}

export const getUserInfo = () => {
  return request.get('/auth/me')
}

export const changePassword = (passwordData) => {
  return request.put('/auth/password', passwordData)
}