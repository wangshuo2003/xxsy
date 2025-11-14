<template>
  <div class="events-page">
    <!-- 活动类型标签页 -->
    <van-tabs v-model:active="activeTab" @change="handleTabChange">
      <van-tab title="赛事活动" name="COMPETITION">
        <EventList :event-type="COMPETITION" />
      </van-tab>
      <van-tab title="研学活动" name="STUDY_TOUR">
        <EventList :event-type="STUDY_TOUR" />
      </van-tab>
      <van-tab title="社会实践" name="SOCIAL_PRACTICE">
        <EventList :event-type="SOCIAL_PRACTICE" />
      </van-tab>
      <van-tab title="公益活动" name="PUBLIC_WELFARE">
        <EventList :event-type="PUBLIC_WELFARE" />
      </van-tab>
    </van-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import EventList from '@/components/EventList.vue'

const activeTab = ref('COMPETITION')

const handleTabChange = (name) => {
  activeTab.value = name
  console.log('切换到标签:', name)
}
</script>

<style scoped>
.events-page {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-top: 0;
}
</style>