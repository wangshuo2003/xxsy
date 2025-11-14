// 简单的收藏功能实现，使用localStorage存储
export const simpleFavorites = {
  // 获取收藏列表
  getFavorites() {
    const favorites = localStorage.getItem('user_favorites')
    return favorites ? JSON.parse(favorites) : []
  },

  // 添加收藏
  addFavorite(targetType, targetId, title) {
    const favorites = this.getFavorites()
    const existing = favorites.find(f =>
      f.targetType === targetType && f.targetId === targetId
    )

    if (!existing) {
      favorites.push({
        id: Date.now(),
        targetType,
        targetId,
        title,
        createdAt: new Date().toISOString()
      })
      localStorage.setItem('user_favorites', JSON.stringify(favorites))
      return true
    }
    return false
  },

  // 移除收藏
  removeFavorite(targetType, targetId) {
    const favorites = this.getFavorites()
    const index = favorites.findIndex(f =>
      f.targetType === targetType && f.targetId === targetId
    )

    if (index > -1) {
      favorites.splice(index, 1)
      localStorage.setItem('user_favorites', JSON.stringify(favorites))
      return true
    }
    return false
  },

  // 检查是否已收藏
  isFavorited(targetType, targetId) {
    const favorites = this.getFavorites()
    return favorites.some(f =>
      f.targetType === targetType && f.targetId === targetId
    )
  },

  // 获取收藏统计
  getFavoriteStats() {
    const favorites = this.getFavorites()
    const policies = favorites.filter(f => f.targetType === 'policy')
    const activities = favorites.filter(f => f.targetType === 'activity')

    return {
      total: favorites.length,
      policies: policies.length,
      activities: activities.length
    }
  }
}