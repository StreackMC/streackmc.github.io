import { openURL } from "../frame/utils.js";

const TERM_CHECKBOX_ELE = document.getElementById('term-checkbox');
const PAYMENT_QR_CODE_ELE = document.getElementById('payment');
const PAYMENT_IMG_ELE = document.getElementById('payment-img');
const IMG_URL = 'https://rs.kdxiaoyi.top/res/images/donate.jpg';

// counting
let counts = 15;
const CHECKBOX_INTERVAL_UPDATE_TASK = setInterval(() => {
  counts--;
  if (counts <= 0) {
    PAYMENT_IMG_ELE.src = IMG_URL;
    TERM_CHECKBOX_ELE.innerText = `我已认真阅读并同意《赞助方针》。`;
    TERM_CHECKBOX_ELE.disabled = false;
    TERM_CHECKBOX_ELE.addEventListener('change', (e) => {
      if (TERM_CHECKBOX_ELE.checked) {
        PAYMENT_QR_CODE_ELE.folded = false;
        PAYMENT_QR_CODE_ELE.scrollIntoView({ behavior: 'smooth' });
      } else {
        PAYMENT_QR_CODE_ELE.folded = true;
      }
    });
    clearInterval(CHECKBOX_INTERVAL_UPDATE_TASK);
  } else {
    TERM_CHECKBOX_ELE.innerText = `我已认真阅读并同意《赞助方针》。(${counts})`;
  }
}, 1000);

// fullimg
PAYMENT_IMG_ELE.addEventListener('click', () => openURL(IMG_URL, false));

// preload
fetch(IMG_URL).catch().then().finally();