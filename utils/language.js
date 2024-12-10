const fs = require('fs');
const path = require('path');

const languages = {
  en: require('../languages/en.json'),
  fr: require('../languages/fr.json'),
  ar: require('../languages/ar.json')
};

const getText = (lang, key) => {
  return languages[lang]?.[key] || languages['en'][key];
};

module.exports = { getText }; 