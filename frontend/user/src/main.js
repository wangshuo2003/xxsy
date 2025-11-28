import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Button, NavBar, Tabbar, TabbarItem, Cell, CellGroup, Form, Field, Grid, GridItem, Card, Image, Divider, Tag, Swipe, SwipeItem, Loading, Dialog, Icon, Collapse, CollapseItem, ActionSheet, setToastDefaultOptions } from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import './style.css'
import axios from 'axios'
import { prefetchBingToday } from './utils/bingFallback'

// 每次构建带上构建标识，强制生成新入口 hash，避免浏览器误用旧缓存
const __BUILD_ID__ = 'tabbar-2025-11-27-02'

const app = createApp(App)
const pinia = createPinia()

// Only set a baseURL when provided as a full/absolute API host; otherwise
// keep request paths as-is (the code already prefixes with /api).
const apiBase = import.meta.env.VITE_API_BASE_URL
if (apiBase && !apiBase.startsWith('/api')) {
  axios.defaults.baseURL = apiBase
}

app.use(pinia)
app.use(router)
app.use(Button)
app.use(NavBar)
app.use(Tabbar)
app.use(TabbarItem)
app.use(Cell)
app.use(CellGroup)
app.use(Form)
app.use(Field)
app.use(Grid)
app.use(GridItem)
app.use(Card)
app.use(Image)
app.use(Divider)
app.use(Tag)
app.use(Swipe)
app.use(SwipeItem)
app.use(Loading)
app.use(Dialog)
app.use(Icon)
app.use(Collapse)
app.use(CollapseItem)
app.use(ActionSheet)

const commonToastOptions = { className: 'global-toast' }

setToastDefaultOptions(commonToastOptions)
setToastDefaultOptions('success', { className: 'global-toast global-toast-success' })
setToastDefaultOptions('fail', commonToastOptions)

// 优先下载今日 Bing 壁纸，随后后台拉取前三天，减少首屏等待
prefetchBingToday({ fast: true }).finally(() => {
  prefetchBingToday({ forceFull: true }).catch(() => {})
})

app.mount('#app')
