import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Button, NavBar, Tabbar, TabbarItem, Cell, CellGroup, Form, Field, Grid, GridItem, Card, Image, Divider, Tag, Swipe, SwipeItem, Loading, Dialog, Icon, Collapse, CollapseItem, setToastDefaultOptions } from 'vant'
import 'vant/lib/index.css'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

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

const commonToastOptions = { className: 'global-toast' }

setToastDefaultOptions(commonToastOptions)
setToastDefaultOptions('success', { className: 'global-toast global-toast-success' })
setToastDefaultOptions('fail', commonToastOptions)

app.mount('#app')
