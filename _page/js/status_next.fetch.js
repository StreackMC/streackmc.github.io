class StreackServer {
  /**
   * 构建一个依赖APIHolders等后端的MC状态查询类
   * @param {String} address 目标地址
   * @param {Boolean} debug 是否开启调试模式
   */
  constructor(address, debug) {
    this.setAddress(address);
    this.meta.debug = debug || false;
  }
  /** 元数据 */
  meta = {
    address: "",
    cooldown: 0,
    debug: false,
  }
  /**
   * 设置地址
   * @param {String} address 目标地址
   */
  setAddress(address) {
    this.meta.address = address;
  }
  /**
   * 获取PlaceHolder值
   * @param {String} query PlaceHolder变量名
   * @param {String} target 目标
   * @returns {JSON} 返回的JSON数据
   * @throws {Error} 抛出请求错误
   */
  async getValue(query, target = "@WebConsole") {
    const url = `${this.meta.address}?query=${encodeURIComponent(query)}&target=${encodeURIComponent(target)}`;
    try {
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      if (!response.ok) {
        throw new Error(response.status);
      };
      let jsonData = await response.json();
      if (!jsonData.retrieved_at) { jsonData.retrieved_at = 1; };
      if (!!jsonData.expires_at) { jsonData.cacheTimeRemaining = Math.floor((jsonData.expires_at - Date.now()) / 1000 + 1); };
      if (this.meta.debug) { console.log("向", url, "获取数据于", Date.now(), "：", jsonData); };
      return jsonData;
    } catch (error) {
      console.error(error)
      throw error;
    };
  }
  /**
   * 获取服务器状态
   * @returns {JSON} 服务器状态JSON
   */
  async getStatus() {
    const [v_online, v_max] = await Promise.all([
      this.getValue("cmi_server_online").then(d => d.result.plain).catch(() => "unreachable"),
      this.getValue("cmi_server_max_players").then(d => d.result.plain).catch(() => -1),
    ]);
    const result = {
      online: true,
      players: {
        online: parseInt(v_online),
        max: parseInt(v_max),
      },
    };
    if (isNaN(result.players.online)) { result.online = false; }
    if (this.meta.debug) { console.log(`获取到 ${this.meta.address} 服务器状态：\n`, result); };
    return result;
  }
}