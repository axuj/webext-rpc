import App from './App.vue'
export default defineContentScript({
  matches: ['*://*.google.com/*', '*://*.google.com.hk/*'], // 2. Set cssInjectionMode
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('Content script is running')

    // 3. Define your UI
    const ui = await createShadowRootUi(ctx, {
      name: 'example-ui',
      position: 'inline',
      onMount: (container) => {
        // Define how your UI will be mounted inside the container
        const app = createApp(App)
        app.mount(container)
        return app
      },
      onRemove: (app) => {
        // Unmount the app when the UI is removed
        app?.unmount()
      },
    })

    // 4. Mount the UI
    ui.mount()
  },
})
