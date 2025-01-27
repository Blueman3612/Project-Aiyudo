import { useState } from 'react'

export function Tooltip({ content, children }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-[100] px-2 py-1 text-sm font-medium text-gray-700 dark:text-white bg-gray-100 dark:bg-gray-700 rounded-md shadow-lg -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          {content}
          <div className="absolute w-2 h-2 bg-gray-100 dark:bg-gray-700 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div>
        </div>
      )}
    </div>
  )
} 