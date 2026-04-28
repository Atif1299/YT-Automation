const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getAuthStatus: () => ipcRenderer.invoke("auth:status"),
  getChannel: () => ipcRenderer.invoke("channel:get"),
  startAuth: () => ipcRenderer.invoke("oauth:start"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  postComment: (payload) => ipcRenderer.invoke("comment:post", payload),
  generateComment: (videoId) =>
    ipcRenderer.invoke("comment:generate", { videoId }),
  searchVideos: (query, options) =>
    ipcRenderer.invoke("videos:search", {
      query,
      maxResults: options?.maxResults,
      regionCode: options?.regionCode,
      year: options?.year,
      month: options?.month,
    }),
  trendingVideos: (options) =>
    ipcRenderer.invoke("videos:trending", {
      maxResults: options?.maxResults,
      regionCode: options?.regionCode,
      videoCategoryId: options?.videoCategoryId,
    }),
  listCategories: (options) =>
    ipcRenderer.invoke("categories:list", {
      regionCode: options?.regionCode,
    }),
  getPrompt: () => ipcRenderer.invoke("prompt:get"),
  setPrompt: (systemPrompt) => ipcRenderer.invoke("prompt:set", { systemPrompt }),
});
