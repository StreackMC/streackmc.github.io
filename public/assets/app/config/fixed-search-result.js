/** 结果覆写配置；若成功覆写，返回顺序即定义顺序 @type {Readonly<{reg: RegExp[], overwrite: import("../component/search.js").SearchSuggestionItem[], allow_external_search?: boolean}[]>} */
export const fixedSearchResult = Object.freeze([
  {
    reg: [/自(杀|残)/g, /zisha/ig, /suicide/ig, /kill.*myself/ig],
    overwrite: [
      {
        keywords: ['自杀', 'suicide'],
        title: '世界虽不完美，但我们仍可疗愈自己。',
        link: '/about/social_duty/mental_health_care/',
        summary: '世界虽不完美，但我们仍可疗愈自己。'
      }
    ],
    allow_external_search: false,
  }
]);