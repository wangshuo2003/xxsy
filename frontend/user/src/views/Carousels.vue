<template>
  <div class="carousels-container">
    <van-swipe :autoplay="3000" indicator-color="white">
      <van-swipe-item v-for="carousel in carousels" :key="carousel.id">
        <div class="carousel-item" @click="handleCarouselClick(carousel)">
          <van-image
            :src="carousel.imageUrl"
            fit="cover"
            width="100%"
            height="200"
          />
          <div class="carousel-title">{{ carousel.title }}</div>
        </div>
      </van-swipe-item>
    </van-swipe>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '@/api/request'

const carousels = ref([])

const loadCarousels = async () => {
  try {
    const response = await request.get('/external/bing-cache')
    const { today, data } = response.data
    // 确保数据按日期排序，并限制为最多 4 张
    carousels.value = data.slice(0, 4)
  } catch (error) {
    console.error('加载 Bing 壁纸失败:', error)
  }
}

const handleCarouselClick = (carousel) => {
  if (carousel.linkUrl) {
    window.open(carousel.linkUrl, '_blank')
  }
}

onMounted(() => {
  loadCarousels()
})
</script>

<style scoped>
.carousels-container {
  margin-bottom: 16px;
}

.carousel-item {
  position: relative;
  cursor: pointer;
}

.carousel-title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  padding: 12px;
  font-size: 14px;
}
</style>