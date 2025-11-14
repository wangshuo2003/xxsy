import { defineStore } from 'pinia'
import { login, getUserInfo } from '@/api/auth'

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

    async getUserInfo() {
      try {
        console.log('UserStore: 开始获取用户信息...')
        const response = await getUserInfo()
        console.log('UserStore: 获取用户信息成功:', response.user)
        this.user = response.user

        // 验证用户信息完整性
        if (!response.user || !response.user.role) {
          console.error('UserStore: 用户信息不完整:', response)
          throw new Error('用户信息不完整')
        }

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