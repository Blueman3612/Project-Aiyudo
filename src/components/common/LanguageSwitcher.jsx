import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';

const languages = [
  {
    code: 'en',
    name: 'English',
    flag: (
      <svg className="w-5 h-5" viewBox="0 0 512 512">
        <path fill="#f0f0f0" d="M0 85.331h512v341.337H0z"/>
        <path fill="#D80027" d="M0 85.331h512v42.666H0zM0 170.663h512v42.666H0zM0 255.995h512v42.666H0zM0 341.327h512v42.666H0z"/>
        <path fill="#2E52B2" d="M0 85.331h256v183.797H0z"/>
        <path fill="#f0f0f0" d="M99.822 160.624L95.699 173.308 82.363 173.308 93.154 181.143 89.031 193.826 99.822 185.991 110.606 193.826 106.484 181.143 117.275 173.308 103.939 173.308z"/>
        <path fill="#f0f0f0" d="M103.939 219.08L99.822 206.397 95.699 219.08 82.363 219.08 93.154 226.916 89.031 239.599 99.822 231.763 110.606 239.599 106.484 226.916 117.275 219.08z"/>
        <path fill="#f0f0f0" d="M47.577 219.08L43.46 206.397 39.337 219.08 26.001 219.08 36.792 226.916 32.669 239.599 43.46 231.763 54.244 239.599 50.121 226.916 60.912 219.08z"/>
        <path fill="#f0f0f0" d="M43.46 160.624L39.337 173.308 26.001 173.308 36.792 181.143 32.669 193.826 43.46 185.991 54.244 193.826 50.121 181.143 60.912 173.308 47.577 173.308z"/>
        <path fill="#f0f0f0" d="M99.822 114.85L95.699 127.535 82.363 127.535 93.154 135.371 89.031 148.054 99.822 140.218 110.606 148.054 106.484 135.371 117.275 127.535 103.939 127.535z"/>
        <path fill="#f0f0f0" d="M43.46 114.85L39.337 127.535 26.001 127.535 36.792 135.371 32.669 148.054 43.46 140.218 54.244 148.054 50.121 135.371 60.912 127.535 47.577 127.535z"/>
        <path fill="#f0f0f0" d="M156.184 160.624L152.061 173.308 138.725 173.308 149.516 181.143 145.394 193.826 156.184 185.991 166.969 193.826 162.846 181.143 173.637 173.308 160.301 173.308z"/>
        <path fill="#f0f0f0" d="M210.471 160.624L206.348 173.308 193.012 173.308 203.803 181.143 199.68 193.826 210.471 185.991 221.255 193.826 217.133 181.143 227.924 173.308 214.588 173.308z"/>
        <path fill="#f0f0f0" d="M156.184 114.85L152.061 127.535 138.725 127.535 149.516 135.371 145.394 148.054 156.184 140.218 166.969 148.054 162.846 135.371 173.637 127.535 160.301 127.535z"/>
        <path fill="#f0f0f0" d="M210.471 114.85L206.348 127.535 193.012 127.535 203.803 135.371 199.68 148.054 210.471 140.218 221.255 148.054 217.133 135.371 227.924 127.535 214.588 127.535z"/>
        <path fill="#f0f0f0" d="M156.184 219.08L152.061 206.397 138.725 206.397 149.516 214.233 145.394 226.916 156.184 219.08 166.969 226.916 162.846 214.233 173.637 206.397 160.301 206.397z"/>
        <path fill="#f0f0f0" d="M210.471 219.08L206.348 206.397 193.012 206.397 203.803 214.233 199.68 226.916 210.471 219.08 221.255 226.916 217.133 214.233 227.924 206.397 214.588 206.397z"/>
      </svg>
    ),
  },
  {
    code: 'es',
    name: 'Español',
    flag: (
      <svg className="w-5 h-5" viewBox="0 0 512 512">
        <path fill="#FFDA44" d="M0 85.331h512v341.337H0z"/>
        <path fill="#D80027" d="M0 85.331h512v113.775H0zM0 312.882h512v113.775H0z"/>
      </svg>
    ),
  },
  {
    code: 'fr',
    name: 'Français',
    flag: (
      <svg className="w-5 h-5" viewBox="0 0 512 512">
        <path fill="#f0f0f0" d="M0 85.331h512v341.337H0z"/>
        <path fill="#0052B4" d="M0 85.331h170.663v341.337H0z"/>
        <path fill="#D80027" d="M341.337 85.331H512v341.337H341.337z"/>
      </svg>
    ),
  },
  {
    code: 'it',
    name: 'Italiano',
    flag: (
      <svg className="w-5 h-5" viewBox="0 0 512 512">
        <path fill="#f0f0f0" d="M0 85.331h512v341.337H0z"/>
        <path fill="#009246" d="M0 85.331h170.663v341.337H0z"/>
        <path fill="#D80027" d="M341.337 85.331H512v341.337H341.337z"/>
      </svg>
    ),
  },
  {
    code: 'de',
    name: 'Deutsch',
    flag: (
      <svg className="w-5 h-5" viewBox="0 0 512 512">
        <path fill="#D80027" d="M0 85.331h512v341.337H0z"/>
        <path fill="#000000" d="M0 85.331h512v113.775H0z"/>
        <path fill="#FFDA44" d="M0 312.882h512v113.775H0z"/>
      </svg>
    ),
  },
  {
    code: 'ru',
    name: 'Русский',
    flag: (
      <svg className="w-5 h-5" viewBox="0 0 512 512">
        <path fill="#f0f0f0" d="M0 85.331h512v341.337H0z"/>
        <path fill="#0052B4" d="M0 199.106h512v113.775H0z"/>
        <path fill="#D80027" d="M0 312.882h512v113.775H0z"/>
      </svg>
    ),
  },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        title={currentLanguage.name}
      >
        <span className="flex-shrink-0 w-5 h-5">{currentLanguage.flag}</span>
        <span className="text-sm">{currentLanguage.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => changeLanguage(language.code)}
              className={`w-full flex items-center px-4 py-2 text-sm ${
                i18n.language === language.code
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                  : 'bg-white hover:bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex-shrink-0 mr-2">{language.flag}</span>
              {language.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 