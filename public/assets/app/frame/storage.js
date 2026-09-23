// ============================================================
// 存储 API
// ============================================================

/**
 * 统一存储 API — 封装 Cookie / localStorage / sessionStorage 的常用操作
 * 所有值在写入时自动 JSON 序列化，读取时自动 JSON 反序列化
 */
export const pmdStorage = {
  /** Cookie 存储操作 */
  Cookies: {
    /** 设置 Cookie */
    set(key, value, maxAge, path) {
      const encoded = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      if (maxAge) {
        // 有过期时间时设置 expires
        const d = new Date(Date.now() + maxAge * 1000);
        document.cookie = `${encoded}; expires=${d.toUTCString()}; path=${path || "/"}`;
      } else {
        document.cookie = `${encoded}; path=${path || "/"}`;
      }
    },
    /** 获取指定 Cookie 的值 */
    get(key) {
      for (const pair of document.cookie.split("; ")) {
        const [k, v] = pair.split("=", 2);
        if (decodeURIComponent(k) === key) return decodeURIComponent(v);
      }
      return null;
    },
    /** 删除指定 Cookie */
    remove(key) { this.set(key, "", -1); },  // 设置 maxAge=-1 使 Cookie 立即过期
    /** 获取所有 Cookie */
    getAll() {
      const r = {};
      for (const pair of document.cookie.split("; ")) {
        const [k, v] = pair.split("=", 2);
        r[decodeURIComponent(k)] = decodeURIComponent(v);
      }
      return r;
    },
    /** 清除所有 Cookie（危险操作） */
    reset_dangerous() { Object.keys(this.getAll()).forEach((k) => this.remove(k)); },
  },
  /** localStorage 存储操作 */
  Local: {
    /** 设置值（自动 JSON 序列化） */
    set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    /** 获取值（自动 JSON 反序列化，失败时返回原始字符串） */
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return localStorage.getItem(key); }
    },
    /** 删除指定键 */
    remove(key) { localStorage.removeItem(key); },
    /** 获取所有键值对 */
    getAll() {
      const r = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        r[k] = this.get(k);
      }
      return r;
    },
    /** 清空所有本地存储（危险操作） */
    reset_dangerous() { localStorage.clear(); },
  },
  /** sessionStorage 存储操作 */
  Session: {
    /** 设置值（自动 JSON 序列化） */
    set(key, value) { sessionStorage.setItem(key, JSON.stringify(value)); },
    /** 获取值（自动 JSON 反序列化，失败时返回原始字符串） */
    get(key) {
      try { return JSON.parse(sessionStorage.getItem(key)); } catch { return sessionStorage.getItem(key); }
    },
    /** 删除指定键 */
    remove(key) { sessionStorage.removeItem(key); },
    /** 获取所有键值对 */
    getAll() {
      const r = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        r[k] = this.get(k);
      }
      return r;
    },
    /** 清空所有会话存储（危险操作） */
    reset_dangerous() { sessionStorage.clear(); },
  },
};
