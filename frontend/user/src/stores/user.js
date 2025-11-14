import { defineStore } from 'pinia'
import { login, register, getUserInfo } from '@/api/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state) => state.user?.role,
    userName: (state) => state.user?.name
  },

  actions: {
    async login(credentials) {
      try {
        const response = await login(credentials)
        const { user, token } = response

        this.user = user
        this.token = token
        localStorage.setItem('token', token)

        return response
      } catch (error) {
        throw error
      }
    },

    async register(userData) {
      try {
        const response = await register(userData)
        return response
      } catch (error) {
        throw error
      }
    },

    async getUserInfo() {
      try {
        console.log('UserStore: 开始获取用户信息...')
        const response = await getUserInfo()
        this.user = response.user
        console.log('UserStore: 获取用户信息成功:', this.user)
        return response
      } catch (error) {
        console.error('UserStore: 获取用户信息失败:', error)
        this.logout()
        throw error
      }
    },

    logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('token')
    }
  }
})