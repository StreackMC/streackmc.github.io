// pmd框架自定义设置项区 详见文档：https://kdxhub.github.io/PagesSober/ (有待更新)
const conf = {
  info: {
    /*浏览器语言检测覆写*/
    lang: "zh-cn",
    /*启用建站时长计时 [是否启用t/f,年,月,日]*/
    time: [true, 2024, 12, 25],
    /*左侧边栏·一言*/
    saying: `源于栈流，我们不断前行。`,
    licen: {
      /*文章授权协议*/
      what: `ARR`,
      /*文章授权协议链接*/
      link: `https://streack.top/about/legal/?selector=legal%3A%E7%89%88%E6%9D%83%E8%AE%B8%E5%8F%AF`,
    },
    /*自定义CSS样式*/
    style: `s-card#slot_2 {flex-wrap: wrap;flex-direction: row;}`,
    /* 单位偏好设置 */
    prefer: {
      /*存储单位进制，0为1000，1为1024*/
      storage: 0,
      /*温标，0为摄氏度，1为华氏度，2为开尔文*/
      temperature: 0,
    },
    /*允许将正文内的View on Github按钮转移*/
    view_on_github: true,
    /*Baidu站长统计JS地址（hm那一行的URL），为空禁用*/
    baidu: "",
    /*Google站长统计JS地址，为空禁用*/
    google: "",
  },
  code: {
  /*在代码块下方添加复制代码按钮*/
    enabled: true,
    /*代码块复制按钮默认文本*/
    tip: "Copy",
    /*代码块复制按钮点击后文本*/
    done: "Copied!",
  },
  img: {
    /*启用图片查看器*/
    view: true,
    /*允许在图片查看器中分享图片*/
    share: true,
    imgse_com: {
      /*启用查看原图对imgse图床的优化*/
      enabled: true,
      /*启用查看原图 跳转至imgse查看页而不是源文件*/
      detail: true,
    },
    /*图片加载失败后的占位符图片*/
    error: "https://rs.kdxiaoyi.top/res/images/load_err.svg",
    background: {
      /*背景图片（自动应用不透明遮罩）*/
      src: "https://s41.ax1x.com/2026/07/03/pm0mSYD.png",
      /*背景图片遮罩透明度，分别为亮色和暗色遮罩，范围0~1*/
      alpha: [0.8, 0.82],
      /*背景图片模糊度，为-1禁用*/
      blur: -1,
    },
  },
  sidebar: {
    solt_1: {
      /*左侧边栏·第1格·背景图片*/
      src: "https://s41.ax1x.com/2026/07/03/pm0mSYD.png",
      /*左侧边栏·第1格·背景图片描述*/
      alt: `栈流Streack`,
      /*左侧边栏·第1格·描述文案背景，依次亮色透明度、暗色透明度、亮色模糊度、暗色模糊度*/
      background: [0.8, 0.82, -1, -1],
      /*左侧边栏·第1格·图片标题（悬浮提示内容）*/
      title: "HERO",
    },
    solt_2: {
      /*左侧边栏·第2格内容*/
      innerHTML: `
<s-chip id="side_ship_0" onclick="openURL('https://streack.top/',true)" clickable="true" class="sidebar_btn">
<s-icon slot="start" name="home"></s-icon>
首页</s-chip>`,
      /*左侧边栏·第2格内容中没有按文档编写请启用此项*/
      preventDefault: false,
    },
    /*自定义边栏内容，禁用保持留空*/
    replacement: ``,
  },
  copy: {
  },
  hyper_markdown: {/*如果用不到这里的特性关掉可以加快加载*/
    /*在标题的最后添加一个按钮以复制链接指向这个标题*/
    header_link: true,
    /*在页面底端增加文章脚注，为空不额外添加*/
    footer: `
      Copyright © 2026,<wbr> kdxiaoyi &amp; Streack.<wbr> 保留所有权利。
      <span style="margin-left: 2em;">
        <a href="https://streack.top/about/legal/?selector=legal%3A%E7%89%88%E6%9D%83%E8%AE%B8%E5%8F%AF" target="_blank">版权许可</a> |
        <a href="https://streack.top/about/legal/" target="_blank">法律信息</a> |
        <a href="https://streack.top/about/legal/?selector=legal%3A%E7%94%A8%E6%88%B7%E5%8D%8F%E8%AE%AE" target="_blank">用户协议</a> |
        <a href="https://streack.top/about/legal/?selector=legal%3A%E9%9A%90%E7%A7%81%E6%94%BF%E7%AD%96" target="_blank">隐私政策</a>
      </span><br>
      此站点与Mojang Studio、<wbr>Microsoft<wbr>或<wbr>网易Netease<wbr>没有任何关联。
    `,
    /*检查引用部分高级语法，详见文档*/
    quotepro: [true,`#1A73E7`,`#FBC116`,`#E23B2E`,`#30C496`],
  },
  link: {
    arrow: {
      /*为所有在新标签页打开的链接添加右上箭头*/
      enabled: true,
      /*仅对含有 ↗ 或 $ 的链接生效*/
      replace: true,
      /*如果链接含有 ฿ 则将其修改为新标签页打开*/
      target_replace: true,
      /*外链图标*/
      icon: `<s-icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"></path></svg></s-icon>`,
    },
  },
  index: {
    /*启用目录统计，高级用法详见文档*/
    enabled: true,
    /*启用目录索引侧栏*/
    sidebar: true,
  },
};
/*在复制的文本结尾追加文字，见文档*/
conf.copy.endnote = `Copyright © 2026, kdxiaoyi & Streack.`;