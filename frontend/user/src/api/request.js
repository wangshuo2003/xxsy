import axios from 'axios'
import { showToast } from 'vant'
import router from '@/router'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          showToast({
            message: '登录已过期，请重新登录',
            type: 'fail'
          })
          localStorage.removeItem('token')
          router.push('/login')
          break
        case 403:
          showToast({
            message: '权限不足',
            type: 'fail'
          })
          break
        case 404:
          showToast({
            message: '请求的资源不存在',
            type: 'fail'
          })
          break
        case 500:
          showToast({
            message: '服务器错误',
            type: 'fail'
          })
          break
        default:
          showToast({
            message: data.error || '请求失败',
            type: 'fail'
          })
      }
    } else {
      showToast({
        message: '网络错误',
        type: 'fail'
      })
    }

    return Promise.reject(error)
  }
)

export default request
